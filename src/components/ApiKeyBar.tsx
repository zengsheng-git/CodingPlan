import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, RotateCcw, Save, Sparkles } from 'lucide-react'
import { usePlanStore } from '@/store/planStore'
import { cn } from '@/lib/format'
import type { ProviderId } from '@/types/plan'

const PROVIDER_PLACEHOLDER: Record<ProviderId, string> = {
  minimax: 'eyJhbGciOi...  或  sk-cp-xxxx...',
  kimi: 'sk-kimi-xxxx...  (Kimi Code 平台专用,以 sk-kimi- 开头)',
  glm: '您的智谱 GLM API Key...',
  deepseek: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
}

export default function ApiKeyBar() {
  const provider = usePlanStore(s => s.provider)
  const apiKey = usePlanStore(s => s.apiKeys[provider])
  const setApiKey = usePlanStore(s => s.setApiKey)
  const clearKey = usePlanStore(s => s.clearKey)
  const loading = usePlanStore(s => s.loading)
  const fetchPlan = usePlanStore(s => s.fetchPlan)
  const autoRefresh = usePlanStore(s => s.autoRefresh)
  const setAutoRefresh = usePlanStore(s => s.setAutoRefresh)
  const [draft, setDraft] = useState(apiKey ?? '')
  const [reveal, setReveal] = useState(false)

  // Reset draft when the user switches provider.
  useEffect(() => {
    setDraft(apiKey ?? '')
  }, [provider, apiKey])

  const handleSave = async () => {
    setApiKey(draft ?? '')
    if ((draft ?? '').trim()) {
      await fetchPlan()
    }
  }

  return (
    <div className="glass-panel glass-panel-hover reveal-1 animate-fade-in-up p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2 md:w-auto">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-cyan/30">
            <KeyRound size={16} />
          </div>
          <div className="hidden flex-col leading-tight md:flex">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
              API Key
            </span>
            <span className="text-sm text-text-secondary">
              {apiKey
                ? '已连接 · 点击保存以重新查询'
                : `请输入 ${provider === 'kimi' ? 'Kimi/Moonshot' : provider === 'glm' ? '智谱 GLM' : provider === 'deepseek' ? 'DeepSeek' : 'MiniMax'} 平台 API Key`}
            </span>
          </div>
        </div>

        <div className="relative flex flex-1 items-center">
          <input
            type={reveal ? 'text' : 'password'}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void handleSave()
            }}
            placeholder={PROVIDER_PLACEHOLDER[provider]}
            className={cn(
              'w-full rounded-xl border border-ink-500 bg-ink-900/60 px-3.5 py-2.5 pr-20',
              'font-mono text-sm text-text-primary placeholder:text-text-muted',
              'transition-all focus:border-cyan/60 focus:bg-ink-900/80 focus:shadow-glow focus:outline-none',
            )}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setReveal(v => !v)}
            className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-ink-700 hover:text-cyan"
            aria-label={reveal ? '隐藏' : '显示'}
          >
            {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-ink-500 bg-ink-800/60 px-3 py-2 text-xs text-text-secondary transition-colors hover:border-cyan/40">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            <span
              className={cn(
                'h-4 w-7 rounded-full bg-ink-600 transition-colors',
                autoRefresh && 'bg-gradient-to-r from-cyan to-violet',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 ml-0.5 block h-3 w-3 rounded-full bg-white transition-transform',
                  autoRefresh && 'translate-x-3',
                )}
              />
            </span>
            <span>自动刷新</span>
          </label>

          {apiKey && (
            <button
              type="button"
              onClick={clearKey}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-500 bg-ink-800/60 text-text-secondary transition-colors hover:border-rose/40 hover:text-rose"
              aria-label="清除 API Key"
            >
              <RotateCcw size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !(draft ?? '').trim()}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-all',
              'border-cyan/40 bg-gradient-to-r from-cyan/15 to-violet/15 text-cyan',
              'hover:border-cyan/60 hover:from-cyan/25 hover:to-violet/25 hover:shadow-glow',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            {loading ? (
              <Sparkles size={14} className="animate-spin-slow" />
            ) : (
              <Save size={14} />
            )}
            <span>{loading ? '查询中' : '保存并查询'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
