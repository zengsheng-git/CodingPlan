import { Boxes, Eye, Inbox, KeyRound, Wallet } from 'lucide-react'
import { usePlanStore } from '@/store/planStore'
import ModelRemainCard, { ModelRemainCardSkeleton } from '@/components/ModelRemainCard'
import type { DeepseekBalanceInfo } from '@/types/plan'

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

  if (!plan) return null

  // DeepSeek 走预付费扣费模式: 没有 5h / 周窗口, 只显示账户余额
  if (plan.balance_infos && plan.balance_infos.length > 0) {
    return (
      <section className="mt-6">
        <BalanceHeader
          source={plan.source}
          isAvailable={plan.is_available !== false}
        />
        {plan.is_available === false && (
          <div className="mt-3 rounded-2xl border border-amber/30 bg-amber/5 px-4 py-2.5 text-sm text-amber-soft">
            账户已无可用余额,可能无法继续调用 API。
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {plan.balance_infos.map((info, i) => (
            <BalanceCard key={info.currency + i} info={info} index={i} />
          ))}
        </div>
      </section>
    )
  }

  if (plan.models.length === 0) return null

  return (
    <section className="mt-6">
      <Header count={plan.models.length} source={plan.source} />
      {plan.demo && <DemoBanner />}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plan.models.map((m, i) => (
          <ModelRemainCard key={m.model_name + i} model={m} index={i} />
        ))}
      </div>
    </section>
  )
}

/**
 * 演示数据横幅: 当 plan.demo === true 时显示。
 * 用于 Kimi 等因上游封锁无法真实查询、改返回假数据的场景。
 */
function DemoBanner() {
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber/30 bg-amber/5 px-4 py-2.5 text-sm text-amber-soft">
      <Eye size={16} className="mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold">演示数据</span>
        <span className="ml-1.5 text-amber-soft/80">
          这是示例假数据,不是真实用量。Kimi 上游因 Cloudflare 拦截无法在生产环境真实查询,
          此处用占位数据保证界面可预览。
        </span>
      </div>
    </div>
  )
}

function BalanceHeader({ source, isAvailable }: { source?: string; isAvailable: boolean }) {
  return (
    <header className="flex items-end justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-cyan/30">
            <Wallet size={14} />
          </div>
          <h2 className="font-display text-lg font-semibold text-text-primary">账户余额</h2>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          DeepSeek 为预付费扣费模式,显示账户余额(赠金 + 充值金)。调用记录请登录
          <a
            href="https://platform.deepseek.com/usage"
            target="_blank"
            rel="noreferrer noopener"
            className="mx-1 text-cyan hover:underline"
          >
            platform.deepseek.com/usage
          </a>
          查看(DeepSeek 未开放对应 API)
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className={`pill ${isAvailable ? '' : 'opacity-60'}`}>
          {isAvailable ? '可用' : '不可用'}
        </span>
        {source && <span className="pill">source · {source}</span>}
      </div>
    </header>
  )
}

function BalanceCard({ info, index }: { info: DeepseekBalanceInfo; index: number }) {
  const total = Number(info.total_balance)
  const granted = Number(info.granted_balance)
  const toppedUp = Number(info.topped_up_balance)
  const currencyLabel = info.currency === 'CNY' ? '¥' : '$'
  const unit = info.currency === 'CNY' ? 'CNY' : 'USD'

  const safe = Number.isFinite(total)
  const grantedSafe = Number.isFinite(granted) ? granted : 0
  const toppedUpSafe = Number.isFinite(toppedUp) ? toppedUp : 0

  // 渲染赠金占比 (可视化用)
  const grantedPct = safe && total > 0 ? Math.max(0, Math.min(100, (grantedSafe / total) * 100)) : 0

  return (
    <div
      className={`reveal-${Math.min(index + 2, 5)} animate-fade-in-up relative overflow-hidden rounded-2xl border border-ink-500/60 bg-ink-900/40 p-5 backdrop-blur`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-text-muted">{unit}</div>
          <div className="mt-1 font-display text-3xl font-semibold tabular-nums text-text-primary">
            {currencyLabel}{(safe ? total : 0).toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-text-muted">总可用余额</div>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">充值余额</span>
          <span className="tabular-nums text-text-primary">
            {currencyLabel}{toppedUpSafe.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">赠金余额</span>
          <span className="tabular-nums text-cyan-soft">
            {currencyLabel}{grantedSafe.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full bg-gradient-to-r from-cyan to-violet transition-all"
            style={{ width: `${grantedPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-text-muted">
          <span>赠金占比</span>
          <span>{grantedPct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
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
