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
  /** 完整 host（带协议），例如 https://api.minimaxi.com */
  host: string
  /** 路径部分，例如 /v1/api/openplatform/coding_plan/remains */
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
    method: 'POST',
    confirmed: true,
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    host: 'https://api.kimi.com',
    path: '/coding/v1/usages',
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