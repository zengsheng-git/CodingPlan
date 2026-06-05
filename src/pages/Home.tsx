import { useEffect, useMemo, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import Header from '@/components/Header'
import ApiKeyBar from '@/components/ApiKeyBar'
import ProviderSwitcher from '@/components/ProviderSwitcher'
import ModelGrid from '@/components/ModelGrid'
import RawResponsePanel from '@/components/RawResponsePanel'
import BackgroundFx from '@/components/BackgroundFx'
import { usePlanStore } from '@/store/planStore'

const PROVIDER_INFO_LINK: Record<string, string> = {
  minimax: 'https://platform.minimaxi.com/subscribe/token-plan',
  kimi: 'https://kimi.com',
}
const PROVIDER_API_HOST: Record<string, string> = {
  minimax: 'api.minimaxi.com',
  kimi: 'api.kimi.com',
}

export default function Home() {
  const provider = usePlanStore(s => s.provider)
  const apiKey = usePlanStore(s => s.apiKeys[provider])
  const loading = usePlanStore(s => s.loading)
  const error = usePlanStore(s => s.error)
  const autoRefresh = usePlanStore(s => s.autoRefresh)
  const refreshIntervalSec = usePlanStore(s => s.refreshIntervalSec)
  const fetchPlan = usePlanStore(s => s.fetchPlan)

  useEffect(() => {
    if (!autoRefresh || !apiKey) return
    const ms = Math.max(10, refreshIntervalSec) * 1000
    const id = setInterval(() => {
      void fetchPlan()
    }, ms)
    return () => clearInterval(id)
  }, [autoRefresh, apiKey, refreshIntervalSec, fetchPlan])

  // StrictMode-safe auto-fetch keyed by (provider, key).
  const lastFetchedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!apiKey) return
    const tag = `${provider}:${apiKey}`
    if (lastFetchedFor.current === tag) return
    lastFetchedFor.current = tag
    void fetchPlan()
  }, [apiKey, provider, fetchPlan])

  const footerHost = useMemo(() => PROVIDER_API_HOST[provider] ?? 'api.minimaxi.com', [provider])
  const infoLink = useMemo(() => PROVIDER_INFO_LINK[provider] ?? '#', [provider])

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-4 md:px-8">
      <BackgroundFx />
      <div className="canvas-grid pointer-events-none absolute inset-0 -z-10 opacity-50" />

      <Header infoLink={infoLink} />
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <ProviderSwitcher />
        <ApiKeyBar />
      </div>

      {error && !loading && (
        <div className="reveal-2 animate-fade-in-up flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose-soft">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">请求出现异常</p>
            <p className="text-rose/80">{error}</p>
          </div>
        </div>
      )}

      <ModelGrid />
      <RawResponsePanel />

      <footer className="reveal-6 animate-fade-in-up mt-4 flex flex-col items-start justify-between gap-2 border-t border-ink-500/40 pt-4 text-[11px] text-text-muted md:flex-row md:items-center">
        <span>
          Token Observatory · Built with React + Vite + Express · 仅供开发者本地使用
        </span>
        <span>
          数据来源:{footerHost} · 本服务不做任何持久化存储
        </span>
      </footer>
    </div>
  )
}
