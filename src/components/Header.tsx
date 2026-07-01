import { Activity, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePlanStore } from '@/store/planStore'
import type { ProviderId } from '@/types/plan'

const PROVIDER_PLATFORM_LABEL: Record<ProviderId, string> = {
  minimax: '前往 MiniMax 平台',
  kimi: '前往 Kimi/Moonshot 平台',
  glm: '前往智谱开放平台',
  deepseek: '前往 DeepSeek 平台',
}

interface HeaderProps {
  infoLink: string
}

export default function Header({ infoLink }: HeaderProps) {
  const lastFetchedAt = usePlanStore(s => s.lastFetchedAt)
  const loading = usePlanStore(s => s.loading)
  const error = usePlanStore(s => s.error)
  const provider = usePlanStore(s => s.provider)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' })

  return (
    <header className="reveal-1 animate-fade-in-up flex flex-col gap-4 pt-6 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-cyan">Token Observatory</p>
            <h1 className="font-display text-3xl font-semibold leading-tight text-text-primary md:text-4xl">
              <span className="gradient-text">Coding Plan</span>
              <span className="ml-2 text-text-secondary">余量仪表</span>
            </h1>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          实时调用上游 Coding Plan 余量 API,把每个类目的 5h / 周窗口余量、boost 加成都搬到你眼前。
        </p>
      </div>
      <div className="flex flex-col items-end gap-2 text-right">
        <div className="flex items-center gap-2">
          <Activity
            size={14}
            className={loading ? 'animate-pulse-soft text-cyan' : error ? 'text-rose' : 'text-cyan/70'}
          />
          <span className="font-mono text-sm text-text-primary">{time}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>{date}</span>
          <span className="pill">
            {loading ? 'fetching' : error ? 'error' : lastFetchedAt ? 'online' : 'idle'}
          </span>
          <span className="pill border-cyan/30 text-cyan-soft">
            {provider}
          </span>
        </div>
        <a
          href={infoLink}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-text-secondary transition-colors hover:text-cyan"
        >
          <ExternalLink size={12} /> {PROVIDER_PLATFORM_LABEL[provider]}
        </a>
      </div>
    </header>
  )
}

function LogoMark() {
  return (
    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-700 to-ink-900 ring-1 ring-cyan/30 shadow-glow">
      <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5EE6E6" />
            <stop offset="60%" stopColor="#9B6BFF" />
            <stop offset="100%" stopColor="#F5B14C" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="10" stroke="url(#logo-grad)" strokeWidth="2" strokeDasharray="48 18" strokeLinecap="round" transform="rotate(-90 16 16)" />
        <circle cx="16" cy="16" r="3" fill="url(#logo-grad)" />
      </svg>
    </div>
  )
}
