export type ProviderId = 'minimax' | 'kimi'

export interface ProviderConfig {
  id: ProviderId
  name: string
  host: string
  path: string
  confirmed: boolean
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    host: 'https://api.minimaxi.com',
    path: '/v1/api/openplatform/coding_plan/remains',
    confirmed: true,
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    host: 'https://api.kimi.com',
    path: '/coding/v1/usages',
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
