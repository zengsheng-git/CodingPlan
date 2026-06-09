import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NormalizedPlan, PlanQueryResponse, ProviderId } from '@/types/plan'

interface NoSubscriptionInfo {
  code: number
  message: string
}

interface PlanState {
  provider: ProviderId
  apiKeys: Record<ProviderId, string>
  loading: boolean
  data: PlanQueryResponse | null
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
       * Fetch quota for the current provider + key. If the key is empty,
       * sets an error message instead of issuing a request. The response
       * is normalized via `bestPlan()` and stored as `plan`; the raw
       * response is also kept as `data` for the RawResponse panel.
       * If the upstream returns a known "no subscription" code, that
       * signal is exposed via `noSubscription` (UI shows a renew banner
       * instead of the generic error).
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
          const res = await fetch('/api/plan/remains', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: state.provider, apiKey: key }),
          })
          if (!res.ok) {
            throw new Error(`代理服务返回 HTTP ${res.status}`)
          }
          const json = (await res.json()) as PlanQueryResponse
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
