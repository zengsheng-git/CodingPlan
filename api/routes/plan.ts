/**
 * Plan query proxy — forwards quota requests to the upstream identified by
 * the `provider` field. Proxied because upstreams don't emit CORS headers.
 * Add new providers in `../providers/registry.ts`.
 */
import { Router, type Request, type Response } from 'express'
import { DEFAULT_PROVIDER, getProvider, type ProviderId } from '../providers/registry.js'

const router = Router()

interface UpstreamSource {
  provider: ProviderId
  endpoint: string
  status: number
  raw: unknown
  ok: boolean
  error?: string
  fetchedAt: string
}

function extractApiKey(req: Request): string | null {
  const fromHeader = (req.header('X-Api-Key') ?? '').trim()
  if (fromHeader) return fromHeader
  const bodyKey =
    typeof req.body === 'object' && req.body !== null
      ? String((req.body as Record<string, unknown>).apiKey ?? '').trim()
      : ''
  if (bodyKey) return bodyKey
  const auth = (req.header('Authorization') ?? '').trim()
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return null
}

function extractProvider(req: Request): ProviderId {
  const fromQuery = (typeof req.query.provider === 'string' ? req.query.provider : '').trim()
  if (fromQuery) return fromQuery as ProviderId
  const fromBody =
    typeof req.body === 'object' && req.body !== null
      ? String((req.body as Record<string, unknown>).provider ?? '').trim()
      : ''
  if (fromBody) return fromBody as ProviderId
  return DEFAULT_PROVIDER
}

async function callUpstream(
  url: string,
  apiKey: string,
  controller: AbortController,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    signal: controller.signal,
  })
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    json = { _non_json: text.slice(0, 4096) }
  }
  return { status: res.status, json }
}

/**
 * GET  /api/plan/providers           — list configured providers
 * POST /api/plan/remains             — body: { provider?, apiKey }
 * GET  /api/plan/remains?provider=…  — header X-Api-Key
 */
async function handleQuery(req: Request, res: Response, next: (e?: unknown) => void): Promise<void> {
  const apiKey = extractApiKey(req)
  if (!apiKey) {
    res.status(400).json({
      ok: false,
      error: 'Missing API key. Provide it in the X-Api-Key header or in the request body as { apiKey }.',
    })
    return
  }

  const providerId = extractProvider(req)
  const provider = getProvider(providerId)
  if (!provider) {
    res.status(400).json({
      ok: false,
      error: `Unknown provider: ${providerId}`,
    })
    return
  }

  const sources: UpstreamSource[] = []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  const url = `${provider.host}${provider.path}`

  try {
    try {
      const { status, json } = await callUpstream(url, apiKey, controller)
      const baseResp =
        typeof json === 'object' && json !== null
          ? (json as Record<string, unknown>).base_resp
          : undefined
      const statusCode =
        typeof baseResp === 'object' && baseResp !== null
          ? Number((baseResp as Record<string, unknown>).status_code ?? -1)
          : -1
      const ok = status >= 200 && status < 300 && (statusCode === 0 || statusCode === -1)
      sources.push({
        provider: provider.id,
        endpoint: provider.path,
        status,
        raw: json,
        ok,
        fetchedAt: new Date().toISOString(),
      })
    } catch (err) {
      sources.push({
        provider: provider.id,
        endpoint: provider.path,
        status: 0,
        raw: null,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        fetchedAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    return next(err)
  } finally {
    clearTimeout(timeout)
  }

  res.status(200).json({
    ok: sources.some(s => s.ok),
    sources,
  })
}

router.get('/providers', (_req, res) => {
  // Imported lazily to avoid a circular import
  import('../providers/registry.js').then(({ listProviders }) => {
    res.json({ providers: listProviders() })
  })
})

router.get('/remains', (req, res, next) => {
  handleQuery(req, res, next).catch(next)
})
router.post('/remains', (req, res, next) => {
  handleQuery(req, res, next).catch(next)
})

export default router
