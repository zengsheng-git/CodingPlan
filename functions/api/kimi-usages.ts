/**
 * Cloudflare Pages Function: Kimi 用量查询代理
 *
 * ⚠️ 当前状态: 返回 DEMO (假) 数据
 *
 * 原因: Kimi 上游 (api.kimi.com) 自己也部署在 Cloudflare 后面,
 * 会拦截来自 Cloudflare Workers 数据中心出口 IP 的请求。
 * 本地 IP 直连 Kimi 正常, 但 CF Function 转发时被 Kimi 的 CF 拦截
 * (返回 "Attention Required! | Cloudflare")。
 * 这是 "CF 拦 CF" 的架构性死结, 跟代码无关。
 *
 * 临时方案: 返回一份结构上与真实响应一致的假数据, 让前端
 * ModelGrid 能正常渲染 (而不是空白/报错), 便于演示和 UI 开发。
 * 响应里明确标注 demo: true, 前端可据此显示 "示例数据" 标签。
 *
 * 待恢复真实查询: 换一个出口 IP 不被 Kimi 封的平台
 * (如 Vercel / Netlify / 自建 VPS), 把本函数逻辑搬过去即可。
 */

interface PagesFunction<Env = Record<string, unknown>> {
  request: Request
  env: Env
  ctx: { waitUntil(promise: Promise<unknown>): void }
}

/** CORS 头: 让浏览器能读取本函数的响应 */
function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, accept',
    'Access-Control-Max-Age': '86400',
    ...extra,
  }
}

/** 计算一个未来时间点 (当前时间 + hours 小时), 返回 ISO 字符串 */
function isoInFuture(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString()
}

/**
 * 构造一份假数据, 结构与 Kimi /coding/v1/usages 真实响应一致。
 * normalizeKimi (src/lib/parse.ts) 能直接消费。
 */
function buildDemoResponse() {
  return {
    // 标记: 让前端能识别这是演示数据
    demo: true,
    user: {
      userId: 'demo-user',
      region: 'REGION_CN',
      membership: { level: 'LEVEL_INTERMEDIATE' },
      businessId: '',
    },
    // 计费周期用量 (对应 weekly 窗口)
    usage: {
      limit: '100',
      used: '27',
      remaining: '73',
      resetTime: isoInFuture(48), // 2 天后重置
    },
    // 滚动窗口数组 (normalizeKimi 靠 duration===300 + TIME_UNIT_MINUTE 找 5h 窗口)
    limits: [
      {
        window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
        detail: {
          limit: '100',
          used: '5',
          remaining: '95',
          resetTime: isoInFuture(3), // 3 小时后重置
        },
      },
    ],
    parallel: { limit: '20', details: [] },
    totalQuota: { limit: '100', remaining: '99' },
    authentication: { method: 'METHOD_API_KEY', scope: 'FEATURE_CODING' },
    subType: 'TYPE_PURCHASE',
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export const onRequestGet: PagesFunction = async () => {
  const body = JSON.stringify(buildDemoResponse())
  return new Response(body, {
    status: 200,
    headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
  })
}

// 兜底: 其他方法一律拒绝
export const onRequest: PagesFunction = () =>
  new Response(JSON.stringify({ error: 'method not allowed' }), {
    status: 405,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  })
