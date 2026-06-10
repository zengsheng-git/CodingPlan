import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NormalizedPlan, ProviderId, UpstreamSource } from '@/types/plan'
import { getProvider } from '@/lib/providers'

interface NoSubscriptionInfo {
  code: number
  message: string
}

interface PlanState {
  provider: ProviderId
  apiKeys: Record<ProviderId, string>
  loading: boolean
  data: { ok: boolean; sources: UpstreamSource[] } | null
  plan: NormalizedPlan | null
  error: string | null
  lastFetchedAt: string | null
  autoRefresh: boolean
  refreshIntervalSec: number
  showRaw: boolean
  noSubscription: NoSubscriptionInfo | null
  setProvider: (provider: ProviderId) => void
  setApiKey: (key: string) => void
  clearKey: () => void
  setAutoRefresh: (on: boolean) => void
  setRefreshInterval: (sec: number) => void
  setShowRaw: (show: boolean) => void
  fetchPlan: () => Promise<void>
}

const REQUEST_TIMEOUT_MS = 15_000

async function fetchUpstream(
  providerId: ProviderId,
  apiKey: string,
): Promise<UpstreamSource> {
  const provider = getProvider(providerId)
  if (!provider) {
    return {
      provider: providerId,
      endpoint: '',
      status: 0,
      raw: null,
      ok: false,
      error: `Unknown provider: ${providerId}`,
      fetchedAt: new Date().toISOString(),
    }
  }
  const url = `${provider.host}${provider.path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const init: RequestInit = {
      method: provider.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
    }
    const res = await fetch(url, init)
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      json = { _non_json: text.slice(0, 4096) }
    }
    const baseResp =
      typeof json === 'object' && json !== null
        ? (json as Record<string, unknown>).base_resp
        : undefined
    const statusCode =
      typeof baseResp === 'object' && baseResp !== null
        ? Number((baseResp as Record<string, unknown>).status_code ?? -1)
        : -1
    const ok = res.status >= 200 && res.status < 300 && (statusCode === 0 || statusCode === -1)
    return {
      provider: provider.id,
      endpoint: provider.path,
      status: res.status,
      raw: json,
      ok,
      fetchedAt: new Date().toISOString(),
    }
  } catch (err) {
    return {
      provider: provider.id,
      endpoint: provider.path,
      status: 0,
      raw: null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      fetchedAt: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      provider: 'minimax',
      apiKeys: { minimax: '', kimi: '' },
      loading: false,
      data: null,
      plan: null,
      error: null,
      lastFetchedAt: null,
      autoRefresh: true,
      refreshIntervalSec: 60,
      showRaw: false,
      noSubscription: null,
      setProvider: provider => {
        // Clear current data when switching so the old provider's results
        // don't bleed into the new provider's view.
        set({ provider, data: null, plan: null, error: null, lastFetchedAt: null, noSubscription: null })
      },
      setApiKey: key =>
        set(state => ({
          apiKeys: { ...state.apiKeys, [state.provider]: key.trim() },
        })),
      clearKey: () =>
        set(state => ({
          apiKeys: { ...state.apiKeys, [state.provider]: '' },
          data: null,
          plan: null,
          error: null,
          lastFetchedAt: null,
          noSubscription: null,
        })),
      setAutoRefresh: on => set({ autoRefresh: on }),
      setRefreshInterval: sec => set({ refreshIntervalSec: Math.max(10, sec) }),
      setShowRaw: show => set({ showRaw: show }),
      /**
       * Fetch quota for the current provider + key directly from the upstream
       * API (no backend proxy). The response is normalized via `bestPlan()`
       * and stored as `plan`; the raw response is also kept as `data` for
       * the RawResponse panel. If the upstream returns a known "no
       * subscription" code, that signal is exposed via `noSubscription`.
       */
      fetchPlan: async () => {
        const state = get()
        const key = state.apiKeys[state.provider]
        if (!key) {
          set({ error: '请先在上方输入 API Key', loading: false, noSubscription: null })
          return
        }
        set({ loading: true, error: null, noSubscription: null })
        try {
          const source = await fetchUpstream(state.provider, key)
          const json = { ok: source.ok, sources: [source] }
          const { bestPlan, detectNoSubscription } = await import('@/lib/parse')
          let plan = bestPlan(json.sources)
          const noSub = detectNoSubscription(json.sources)
          // 过滤掉用户不关心的模型（当前需求：只看 general）
          if (plan) {
            plan = {
              ...plan,
              models: plan.models.filter(m => m.model_name !== 'video'),
            }
          }
          set({
            data: json,
            plan,
            noSubscription: noSub,
            // No subscription is its own state — don't show the generic "未识别" error.
            error: plan
              ? null
              : noSub
                ? null
                : source.error
                  ? `请求失败: ${source.error}`
                  : '未找到可识别的套餐数据,请检查 Key 是否有效或展开 Raw Response 查看',
            lastFetchedAt: new Date().toISOString(),
            loading: false,
          })
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : String(err),
            loading: false,
          })
        }
      },
    }),
    {
      name: 'minimax-tokenplan-store',
      partialize: state => ({
        provider: state.provider,
        apiKeys: state.apiKeys,
        autoRefresh: state.autoRefresh,
        refreshIntervalSec: state.refreshIntervalSec,
        showRaw: state.showRaw,
      }),
    },
  ),
)