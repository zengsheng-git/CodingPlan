import { Boxes, Inbox, KeyRound } from 'lucide-react'
import { usePlanStore } from '@/store/planStore'
import ModelRemainCard, { ModelRemainCardSkeleton } from '@/components/ModelRemainCard'

export default function ModelGrid() {
  const plan = usePlanStore(s => s.plan)
  const loading = usePlanStore(s => s.loading)
  const provider = usePlanStore(s => s.provider)
  const apiKey = usePlanStore(s => s.apiKeys[provider])

  if (!apiKey) {
    return (
      <section className="reveal-3 animate-fade-in-up mt-6 flex flex-col items-center gap-3 rounded-2xl border border-ink-500/60 bg-ink-900/40 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-cyan/30">
          <KeyRound size={20} />
        </div>
        <div>
          <p className="font-display text-base font-semibold text-text-primary">
            请先在上方输入 API Key
          </p>
          <p className="mt-1 text-xs text-text-muted">
            填好后点击「保存并查询」即可拉取余量数据。Key 仅保存在你的浏览器本地,不会上传。
          </p>
        </div>
      </section>
    )
  }

  if (loading && !plan) {
    return (
      <section className="mt-6">
        <Header />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ModelRemainCardSkeleton key={i} index={i} />
          ))}
        </div>
      </section>
    )
  }

  if (!plan || plan.models.length === 0) return null

  return (
    <section className="mt-6">
      <Header count={plan.models.length} source={plan.source} />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plan.models.map((m, i) => (
          <ModelRemainCard key={m.model_name + i} model={m} index={i} />
        ))}
      </div>
    </section>
  )
}

function Header({ count, source }: { count?: number; source?: string }) {
  return (
    <header className="flex items-end justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-cyan/30">
            <Boxes size={14} />
          </div>
          <h2 className="font-display text-lg font-semibold text-text-primary">模型余量</h2>
        </div>
        <p className="mt-1 text-xs text-text-muted">每个模型独立的窗口余量与总配额,展开可查看原始数据</p>
      </div>
      {typeof count === 'number' && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="pill">
            <Inbox size={12} /> {count} entries
          </span>
          {source && <span className="pill">source · {source}</span>}
        </div>
      )}
    </header>
  )
}
