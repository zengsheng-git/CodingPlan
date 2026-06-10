/**
 * Provider registry — single source of truth for upstream API endpoints.
 * 前端直接调用厂商 API（无后端代理），所以 registry 必须放在前端。
 * 添加新 provider：1) 在 PROVIDERS 加一项；2) 在 src/lib/parse.ts 加对应 parser。
 */
export type ProviderId = 'minimax' | 'kimi'

export interface ProviderConfig {
  id: ProviderId
  /** 中文显示名 */
  name: string
  /**
   * 完整 host（带协议），例如 https://api.minimaxi.com。
   * 留空表示走 Vite dev proxy（用于绕过 CORS preflight）。
   */
  host: string
  /**
   * 路径部分：
   * - 直接调用厂商 API 时：例如 `/v1/api/openplatform/coding_plan/remains`
   * - 走 Vite dev proxy 时：以 `/` 开头的相对路径，例如 `/api/kimi-usages`
   */
  path: string
  /** 调用方法 */
  method: 'GET' | 'POST'
  /** 是否已确认可用 */
  confirmed: boolean
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    host: 'https://api.minimaxi.com',
    path: '/v1/api/openplatform/coding_plan/remains',
    method: 'GET',
    confirmed: true,
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    // host 留空 → 走 Vite dev proxy（见 vite.config.ts）。
    // Kimi 的 OPTIONS preflight 不发 CORS 头,无法纯前端绕过。
    host: '',
    path: '/api/kimi-usages',
    method: 'GET',
    confirmed: true,
  },
}

export const DEFAULT_PROVIDER: ProviderId = 'minimax'

export function getProvider(id: string | undefined | null): ProviderConfig | null {
  if (!id) return null
  return PROVIDERS[id as ProviderId] ?? null
}

export function listProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS)
}