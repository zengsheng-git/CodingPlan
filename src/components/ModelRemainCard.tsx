import { useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Clock,
  Hourglass,
  Image as ImageIcon,
  MessageSquare,
  Music,
  Sparkles,
  Timer,
  TrendingUp,
  Video,
  Zap,
} from 'lucide-react'
import ArcProgress from '@/components/ArcProgress'
import Tooltip, { TipApiField } from '@/components/Tooltip'
import { cn, formatCount } from '@/lib/format'
import { resolveLabel } from '@/lib/parse'
import type { ModelRemain } from '@/types/plan'

interface ModelRemainCardProps {
  model: ModelRemain
  index: number
}

function pickIcon(name: string) {
  const k = name.toLowerCase()
  if (k.includes('video')) return Video
  if (k.includes('image')) return ImageIcon
  if (k.includes('music')) return Music
  if (k.includes('speech') || k.includes('audio') || k.includes('tts')) return Sparkles
  return MessageSquare
}

function formatRemainDuration(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || !Number.isFinite(ms) || ms <= 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  if (days > 0) return `${days}天 ${hours}小时 ${minutes}分`
  if (hours > 0) return `${hours}小时 ${minutes}分`
  if (minutes > 0) return `${minutes}分`
  return `${totalSec}秒`
}

function formatPercent(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—'
  return `${v.toFixed(v >= 100 || v <= 0 ? 0 : 1)}%`
}

/**
 * 把千分制加成转成可读文本。1000‰ = 1 倍（基础）,1500‰ = 1.5 倍。
 * 同时给出「额外加成%」（相对基础 1x 的增量）。
 */
function formatPermille(v: number | undefined | null): string {
  if (v === undefined || v === null) return ''
  const multiple = v / 1000
  const extraPct = ((v - 1000) / 10).toFixed(0)
  return `${multiple.toFixed(2)}x（基础 +${extraPct}%）`
}

function formatTsFromMs(ms?: number, opts?: { withDate?: boolean }): string {
  if (!ms || !Number.isFinite(ms) || ms < 1e12) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', {
    month: opts?.withDate ? '2-digit' : '2-digit',
    day: opts?.withDate ? '2-digit' : '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatTsRange(startMs?: number, endMs?: number): string {
  if (!startMs || !endMs) return '—'
  return `${formatTsFromMs(startMs)} ~ ${formatTsFromMs(endMs)}`
}

function statusLabel(s: number | undefined): { text: string; tone: 'emerald' | 'amber' | 'rose' | 'neutral' } {
  if (s === undefined) return { text: '未知', tone: 'neutral' }
  if (s === 1) return { text: '可用', tone: 'emerald' }
  if (s === 0) return { text: '不可用', tone: 'rose' }
  return { text: `status=${s}`, tone: 'neutral' }
}

export default function ModelRemainCard({ model, index }: ModelRemainCardProps) {
  const [open, setOpen] = useState(false)
  const Icon = pickIcon(model.model_name)
  const label = model.display_label ?? resolveLabel(model.model_name)

  // 5h 窗口核心指标
  const intervalRemainingPct = model.interval_remaining_percent
  const intervalTotal = model.interval_total_count ?? 0
  const intervalUsed = model.interval_usage_count ?? 0
  const intervalUnlimited = intervalTotal === 0
  const intervalStatus = statusLabel(model.interval_status)
  const intervalCountExhausted = !intervalUnlimited && intervalUsed >= intervalTotal
  const intervalState: 'unavailable' | 'limited' | 'available' = model.interval_status === 0
    ? 'unavailable'
    : intervalCountExhausted
      ? 'limited'
      : 'available'

  // 周窗口核心指标
  const weeklyRemainingPct = model.weekly_remaining_percent
  const weeklyTotal = model.weekly_total_count ?? 0
  const weeklyUsed = model.weekly_usage_count ?? 0
  const weeklyUnlimited = weeklyTotal === 0
  const weeklyStatus = statusLabel(model.weekly_status)
  const weeklyCountExhausted = !weeklyUnlimited && weeklyUsed >= weeklyTotal
  const weeklyState: 'unavailable' | 'limited' | 'available' = model.weekly_status === 0
    ? 'unavailable'
    : weeklyCountExhausted
      ? 'limited'
      : 'available'

  // 圆环填充：5h 剩余%
  const ringValue =
    intervalRemainingPct !== undefined ? Math.max(0, Math.min(1, intervalRemainingPct / 100)) : 0

  // 加成
  const hasBoost =
    (model.interval_boost_permille ?? 0) > 0 || (model.weekly_boost_permille ?? 0) > 0

  return (
    <div
      className={cn(
        'glass-panel glass-panel-hover reveal-3 animate-fade-in-up group flex flex-col gap-4 p-5',
        'transition-transform duration-300 hover:-translate-y-0.5',
      )}
      style={{ animationDelay: `${0.1 + index * 0.05}s` }}
    >
      {/* ===== 头部 ===== */}
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl ring-1',
              intervalState === 'available'
                ? 'bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-cyan/30'
                : intervalState === 'limited'
                  ? 'bg-gradient-to-br from-amber/20 to-rose/20 text-amber ring-amber/30'
                  : 'bg-gradient-to-br from-rose/20 to-rose/10 text-rose ring-rose/30',
            )}
          >
            <Icon size={18} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="stat-label">类目</p>
              <StatusPill tone={intervalStatus.tone}>{intervalStatus.text}</StatusPill>
            </div>
            <h3 className="font-display text-lg font-semibold leading-tight text-text-primary">
              {label}
            </h3>
            <p className="font-mono text-[10px] text-text-muted">{model.model_name}</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md border border-ink-500 text-text-muted transition-all',
            'hover:border-cyan/40 hover:text-cyan',
            open && 'rotate-90 border-cyan/50 text-cyan',
          )}
          aria-label="查看原始数据"
        >
          <ChevronRight size={14} />
        </button>
      </header>

      {/* ===== Hero：5h 剩余额度（大圆盘）====== */}
      <section className="flex items-center gap-5 rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/5 to-violet/5 p-4">
        <Tooltip
          width={300}
          content={
            <div>
              <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">
                5h 剩余额度
              </div>
              <div>
                来自 API 字段 <code className="font-mono text-cyan">current_interval_remaining_percent</code>。
                这是反映"还剩多少可用额度"的核心指标。
              </div>
              <div className="mt-1 text-text-muted">
                圆环颜色按状态变化:可用→青紫,受限→琥珀玫红。
              </div>
              <TipApiField name="current_interval_remaining_percent" />
            </div>
          }
        >
          <ArcProgress
            value={ringValue}
            size={120}
            stroke={9}
            label={
              intervalRemainingPct !== undefined ? `${intervalRemainingPct}%` : undefined
            }
            gradient={
              intervalState === 'unavailable' || intervalState === 'limited'
                ? 'amber-rose'
                : ringValue > 0.5
                  ? 'cyan-violet'
                  : ringValue > 0.2
                    ? 'cyan-amber'
                    : 'amber-rose'
            }
          />
        </Tooltip>
        <div className="flex-1 space-y-2">
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              5h 窗口
            </p>
            <p className="font-mono text-[11px] text-text-secondary">
              {formatTsRange(model.interval_start_time, model.interval_end_time)}
            </p>
          </div>
          {model.interval_remains_ms !== undefined && model.interval_remains_ms > 0 && (
            <p className="flex items-center gap-1.5 font-mono text-xs text-violet-soft">
              <Timer size={12} />
              <span>距重置 {formatRemainDuration(model.interval_remains_ms)}</span>
            </p>
          )}
        </div>
      </section>

      {/* ===== 5h 窗口明细 ===== */}
      <Section
        title="5h 窗口明细"
        icon={<Clock size={12} />}
        apiFields="current_interval_status / current_interval_usage_count / current_interval_total_count / interval_boost_permille"
      >
        <InfoRow
          label="状态"
          value={
            <span className="flex items-center gap-2">
              <StatusPill tone={intervalStatus.tone}>{intervalStatus.text}</StatusPill>
              <span className="font-mono text-[10px] text-text-muted">
                status={model.interval_status ?? '—'}
              </span>
            </span>
          }
        />
        <InfoRow
          label="剩余额度"
          value={
            <span
              className={cn(
                'font-mono font-semibold tabular-nums',
                intervalState === 'limited' || intervalState === 'unavailable'
                  ? 'text-amber'
                  : 'text-cyan',
              )}
            >
              {intervalRemainingPct !== undefined ? formatPercent(intervalRemainingPct) : '—'}
            </span>
          }
        />
        <InfoRow
          label="已用 / 配额"
          value={
            <span className="font-mono tabular-nums text-text-primary">
              {intervalUnlimited
                ? `${formatCount(intervalUsed)}（无次数限制）`
                : `${formatCount(intervalUsed)} / ${formatCount(intervalTotal)}`}
            </span>
          }
        />
        <InfoRow
          label="窗口区间"
          value={
            <span className="font-mono text-[11px] text-text-secondary">
              {formatTsRange(model.interval_start_time, model.interval_end_time)}
            </span>
          }
        />
        <InfoRow
          label="距重置"
          value={
            <span className="font-mono text-[11px] text-text-secondary">
              {model.interval_remains_ms !== undefined && model.interval_remains_ms > 0
                ? formatRemainDuration(model.interval_remains_ms)
                : '—'}
            </span>
          }
        />
        {model.interval_boost_permille !== undefined && model.interval_boost_permille > 0 && (
          <InfoRow
            label="5h 加成"
            value={
              <span className="font-mono text-[11px] text-cyan-soft">
                {formatPermille(model.interval_boost_permille)}
              </span>
            }
          />
        )}
      </Section>

      {/* ===== 周窗口明细 ===== */}
      <Section
        title="周窗口明细"
        icon={<Hourglass size={12} />}
        apiFields="current_weekly_remaining_percent / current_weekly_usage_count / current_weekly_total_count / weekly_boost_permille"
      >
        <InfoRow
          label="状态"
          value={
            <span className="flex items-center gap-2">
              <StatusPill tone={weeklyStatus.tone}>{weeklyStatus.text}</StatusPill>
              <span className="font-mono text-[10px] text-text-muted">
                status={model.weekly_status ?? '—'}
              </span>
            </span>
          }
        />
        <InfoRow
          label="剩余额度"
          value={
            <span
              className={cn(
                'font-mono font-semibold tabular-nums',
                weeklyState === 'limited' || weeklyState === 'unavailable'
                  ? 'text-amber'
                  : 'text-cyan',
              )}
            >
              {weeklyRemainingPct !== undefined ? formatPercent(weeklyRemainingPct) : '—'}
            </span>
          }
        />
        <InfoRow
          label="已用 / 配额"
          value={
            <span className="font-mono tabular-nums text-text-primary">
              {weeklyUnlimited
                ? `${formatCount(weeklyUsed)}（无次数限制）`
                : `${formatCount(weeklyUsed)} / ${formatCount(weeklyTotal)}`}
            </span>
          }
        />
        <InfoRow
          label="窗口区间"
          value={
            <span className="font-mono text-[11px] text-text-secondary">
              {formatTsRange(model.weekly_start_time, model.weekly_end_time)}
            </span>
          }
        />
        <InfoRow
          label="距重置"
          value={
            <span className="font-mono text-[11px] text-text-secondary">
              {model.weekly_remains_ms !== undefined && model.weekly_remains_ms > 0
                ? formatRemainDuration(model.weekly_remains_ms)
                : '—'}
            </span>
          }
        />
        {model.weekly_boost_permille !== undefined && model.weekly_boost_permille > 0 && (
          <InfoRow
            label="周加成"
            value={
              <span className="font-mono text-[11px] text-amber-soft">
                {formatPermille(model.weekly_boost_permille)}
              </span>
            }
          />
        )}
      </Section>

      {/* ===== 加成总览（如果有）====== */}
      {hasBoost && (
        <Section title="加成总览" icon={<Zap size={12} />}>
          <div className="flex flex-wrap gap-2">
            {model.interval_boost_permille !== undefined && model.interval_boost_permille > 0 && (
              <Tooltip
                width={260}
                content={
                  <div>
                    <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">
                      5h 临时加成
                    </div>
                    <div>5h 窗口的额外容量加成系数(千分制)。</div>
                    <div className="mt-1 text-text-muted">
                      1000‰ = 1 倍(基础);1500‰ = 1.5 倍(+50%);2000‰ = 2 倍(+100%)。
                    </div>
                    <TipApiField name="interval_boost_permille" />
                  </div>
                }
              >
                <span className="pill border-cyan/40 bg-cyan/5 text-cyan-soft">
                  <TrendingUp size={11} /> 5h {formatPermille(model.interval_boost_permille)}
                </span>
              </Tooltip>
            )}
            {model.weekly_boost_permille !== undefined && model.weekly_boost_permille > 0 && (
              <Tooltip
                width={260}
                content={
                  <div>
                    <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">
                      周窗口加成
                    </div>
                    <div>周窗口的额外容量加成系数(千分制)。</div>
                    <div className="mt-1 text-text-muted">
                      1000‰ = 1 倍(基础);1500‰ = 1.5 倍(+50%)。
                    </div>
                    <TipApiField name="weekly_boost_permille" />
                  </div>
                }
              >
                <span className="pill border-amber/40 bg-amber/5 text-amber-soft">
                  <TrendingUp size={11} /> 周 {formatPermille(model.weekly_boost_permille)}
                </span>
              </Tooltip>
            )}
          </div>
        </Section>
      )}

      {/* ===== 原始数据（折叠）====== */}
      {open && (
        <pre className="max-h-56 overflow-auto rounded-lg border border-ink-500/40 bg-ink-950/60 p-3 text-[11px] leading-relaxed text-text-secondary">
          {JSON.stringify(model.raw, null, 2)}
        </pre>
      )}
    </div>
  )
}

/* ====== 内部小组件 ====== */

function StatusPill({
  tone,
  children,
}: {
  tone: 'emerald' | 'amber' | 'rose' | 'cyan' | 'neutral'
  children: ReactNode
}) {
  const cls: Record<typeof tone, string> = {
    emerald: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber/40 bg-amber/10 text-amber',
    rose: 'border-rose/40 bg-rose/10 text-rose',
    cyan: 'border-cyan/40 bg-cyan/10 text-cyan',
    neutral: 'border-ink-500 bg-ink-700/40 text-text-secondary',
  } as const
  return (
    <span className={cn('pill text-[10px]', cls[tone])}>{children}</span>
  )
}

function Section({
  title,
  icon,
  apiFields,
  children,
}: {
  title: string
  icon?: ReactNode
  apiFields?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-ink-500/40 bg-ink-900/30 p-3">
      <header className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          {icon}
          {title}
        </h4>
        {apiFields && (
          <Tooltip
            width={300}
            content={
              <div>
                <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">
                  对应 API 字段
                </div>
                <code className="font-mono text-[10px] text-cyan break-all">{apiFields}</code>
              </div>
            }
          >
            <span className="cursor-help font-mono text-[9px] text-text-muted">API</span>
          </Tooltip>
        )}
      </header>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

export function ModelRemainCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="glass-panel reveal-3 animate-fade-in-up p-5"
      style={{ animationDelay: `${0.1 + index * 0.05}s` }}
    >
      <div className="h-4 w-24 animate-pulse rounded bg-ink-700" />
      <div className="mt-4 flex gap-4">
        <div className="h-[120px] w-[120px] animate-pulse rounded-full bg-ink-700/60" />
        <div className="flex-1 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-ink-700/60" />
          ))}
        </div>
      </div>
    </div>
  )
}
