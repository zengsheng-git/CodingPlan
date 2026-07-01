import { useEffect, useMemo, useRef } from 'react'
import { AlertTriangle, CreditCard, ExternalLink } from 'lucide-react'
import Header from '@/components/Header'
import ApiKeyBar from '@/components/ApiKeyBar'
import ProviderSwitcher from '@/components/ProviderSwitcher'
import ModelGrid from '@/components/ModelGrid'
import RawResponsePanel from '@/components/RawResponsePanel'
import BackgroundFx from '@/components/BackgroundFx'
import { usePlanStore } from '@/store/planStore'
import { getProvider, type ProviderId } from '@/lib/providers'

const PROVIDER_INFO_LINK: Record<ProviderId, string> = {
  minimax: 'https://platform.minimaxi.com/subscribe/token-plan',
  kimi: 'https://kimi.com',
  glm: 'https://open.bigmodel.cn',
  deepseek: 'https://platform.deepseek.com',
}

export default function Home() {
  const provider = usePlanStore(s => s.provider)
  const apiKey = usePlanStore(s => s.apiKeys[provider])
  const noSubscription = usePlanStore(s => s.noSubscription)
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

  const footerHost = useMemo(() => {
    const host = getProvider(provider)?.host ?? ''
    return host.replace(/^https?:\/\//, '') || 'api.minimaxi.com'
  }, [provider])
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

      {noSubscription && !loading && (
        <div className="reveal-2 animate-fade-in-up flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber/5 px-4 py-3 text-sm">
          <CreditCard size={16} className="mt-0.5 shrink-0 text-amber" />
          <div className="flex-1">
            <p className="font-medium text-text-primary">Coding Plan 订阅未启用</p>
            <p className="mt-0.5 text-amber-soft/90">
              {provider === 'glm' ? (
                <>
                  此 Key 关联的账号在智谱 monitor 系统里<strong className="font-medium">没有 Coding Plan 订阅</strong>。
                  可能原因:这是普通 API Key 不是 Coding Plan Key,或 Coding Plan 在其他账号下。
                  <br />
                  <span className="text-text-muted">
                   智谱 Coding Plan 订阅是绑定到具体账号的,需要账户主人在 dashboard 创建专用 Coding Plan Key。
                  </span>
                </>
              ) : (
                <>
                  {provider === 'kimi' ? 'Kimi' : 'MiniMax'} API Key 有效,<strong className="font-medium">仍可使用普通 API 余额调用模型</strong>;
                  当前账户未开 Coding Plan 订阅,所以本仪表盘没有额度可显示。
                </>
              )}
              <span className="ml-2 font-mono text-xs text-text-muted">upstream status {noSubscription.code}</span>
            </p>
            <a
              href={infoLink}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan transition-colors hover:underline"
            >
              <ExternalLink size={12} /> 查看 Coding Plan 订阅方案
            </a>
          </div>
        </div>
      )}

      {error && !loading && !noSubscription && (
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
          Token Observatory · Built with React + Vite · 仅供开发者本地使用
        </span>
        <span>
          数据来源:{footerHost} · 本服务不做任何持久化存储
        </span>
      </footer>
    </div>
  )
}
