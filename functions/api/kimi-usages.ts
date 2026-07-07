/**
 * Cloudflare Pages Function: Kimi 用量查询代理
 *
 * 为什么需要这个代理:
 * Kimi 的 /coding/v1/usages 接口在 OPTIONS 预检时不发 CORS 头,
 * 浏览器无法绕过 preflight,所以纯前端直连会失败。
 * 本函数在服务端转发请求,绕开浏览器的 CORS 限制。
 *
 * 对应 dev 期的 Vite proxy (见 vite.config.ts),路径保持一致
 * (/api/kimi-usages),前端 providers.ts / planStore.ts 零改动。
 *
 * 上游契约:
 *   GET https://api.kimi.com/coding/v1/usages
 *   Headers: Authorization: Bearer <apiKey>, Content-Type, Accept
 *   响应体由 normalizeKimi (src/lib/parse.ts) 消费,原样透传即可。
 */

// CF Pages Functions 运行时类型 (无需额外依赖,运行时自带)
interface PagesFunction<Env = Record<string, unknown>> {
  request: Request
  env: Env
  ctx: { waitUntil(promise: Promise<unknown>): void }
}

const UPSTREAM_URL = 'https://api.kimi.com/coding/v1/usages'
const REQUEST_TIMEOUT_MS = 15_000 // 与 planStore.ts 的 REQUEST_TIMEOUT_MS 对齐

// 允许的请求头 (CORS 预检响应)
const ALLOWED_HEADERS = ['authorization', 'content-type', 'accept']

/** 统一的 CORS 响应头。生产域名固定后可收紧为具体 origin。 */
function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
    'Access-Control-Max-Age': '86400',
    ...extra,
  }
}

/** 构造 JSON 错误响应 (HTTP 状态码 + 结构化 body) */
function errorResponse(status: number, message: string, detail?: unknown): Response {
  return new Response(
    JSON.stringify({ error: message, detail: detail ?? null }),
    {
      status,
      headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
    },
  )
}

export const onRequestOptions: PagesFunction = async () => {
  // CORS 预检:Kimi 上游就是卡在这里 (不发 CORS 头),这里直接放行
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const auth = request.headers.get('authorization')

  // 透传前端带的 Authorization 头 (Bearer <apiKey>)
  if (!auth) {
    return errorResponse(401, 'missing Authorization header')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'GET',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    // 透传上游响应体,补上 CORS 头 (这是浏览器能读到响应的关键)
    const body = await upstream.text()
    const contentType =
      upstream.headers.get('content-type') ?? 'application/json; charset=utf-8'

    return new Response(body, {
      status: upstream.status,
      headers: corsHeaders({ 'Content-Type': contentType }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // AbortController 触发时 message 通常是 'The operation was aborted'
    if (err instanceof Error && err.name === 'AbortError') {
      return errorResponse(504, 'upstream timeout (kimi)')
    }
    return errorResponse(502, 'upstream fetch failed', message)
  } finally {
    clearTimeout(timeout)
  }
}

// 兜底:其他方法一律拒绝
export const onRequest: PagesFunction = () =>
  errorResponse(405, 'method not allowed')
