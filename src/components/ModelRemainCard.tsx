import { useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Clock,
  Image as ImageIcon,
  MessageSquare,
  Music,
  Sparkles,
  Video,
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
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) return `${hours}小时 ${minutes}分`
  if (minutes > 0) return `${minutes}分 ${seconds}秒`
  return `${seconds}秒`
}

function formatPercent(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—'
  return `${v.toFixed(v >= 100 || v <= 0 ? 0 : 1)}%`
}

function permilleToPercent(v: number | undefined | null): string {
  if (v === undefined || v === null) return ''
  return `+${(v / 10).toFixed(1)}% boost`
}

function formatTsFromMs(ms?: number): string {
  if (!ms || !Number.isFinite(ms) || ms < 1e12) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export default function ModelRemainCard({ model, index }: ModelRemainCardProps) {
  const [open, setOpen] = useState(false)
  const Icon = pickIcon(model.model_name)
  const label = model.display_label ?? resolveLabel(model.model_name)

  const intervalUsed = model.interval_usage_count ?? 0
  const intervalTotal = model.interval_total_count ?? 0
  const intervalPercent = model.interval_remaining_percent ?? 0
  const ringValue = Math.max(0, Math.min(1, intervalPercent / 100))

  const weeklyUsed = model.weekly_usage_count
  const weeklyTotal = model.weekly_total_count
  const weeklyPercent = model.weekly_remaining_percent
  const hasWeekly = weeklyPercent !== undefined

  const hasBoost = (model.interval_boost_permille ?? 0) > 0 || (model.weekly_boost_permille ?? 0) > 0

  return (
    <div
      className={cn(
        'glass-panel glass-panel-hover reveal-3 animate-fade-in-up group flex flex-col gap-4 p-5',
        'transition-transform duration-300 hover:-translate-y-0.5',
      )}
      style={{ animationDelay: `${0.1 + index * 0.05}s` }}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-cyan/30">
            <Icon size={18} />
          </div>
          <Tooltip
            placement="bottom"
            width={260}
            content={
              <div>
                <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">类目 ID</div>
                <div>
                  后端 <code className="font-mono text-cyan">model_name</code> 字段的中文映射。
                  完整 ID 见下方等宽字。
                </div>
                <div className="mt-1 text-text-muted">已知映射:general→通用对话、video→视频生成、speech→语音、image→图像、music→音乐、multimodal→多模态。</div>
                <TipApiField name="model_name" />
              </div>
            }
          >
            <div>
              <p className="stat-label">类目</p>
              <h3 className="font-display text-lg font-semibold leading-tight text-text-primary">
                {label}
              </h3>
              <p className="font-mono text-[10px] text-text-muted">{model.model_name}</p>
            </div>
          </Tooltip>
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

      <div className="flex items-center gap-5">
        <Tooltip
          width={280}
          content={
            <div>
              <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">5h 剩余容量</div>
              <div>当前 5h 滚动窗口内该类目的剩余容量百分比(含 boost 加成)。</div>
              <div className="mt-1 text-text-muted">
                圆环颜色随余量变化:&gt; 50% 青紫渐变、20~50% 青琥珀、&lt; 20% 琥珀玫红。
              </div>
              <TipApiField name="current_interval_remaining_percent" />
            </div>
          }
        >
          <ArcProgress
            value={ringValue}
            size={108}
            stroke={8}
            gradient={ringValue > 0.5 ? 'cyan-violet' : ringValue > 0.2 ? 'cyan-amber' : 'amber-rose'}
          />
        </Tooltip>
        <div className="flex-1 space-y-2.5">
          <Metric
            label="5h 剩余"
            value={formatPercent(intervalPercent)}
            tone="cyan"
            big
            tipContent={
              <div>
                <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">5h 剩余百分比</div>
                <div>5h 滚动窗口剩余容量,含 boost 加成后的真实剩余。</div>
                <div className="mt-1 text-text-muted">
                  0% = 基础配额用尽;100% = 满血。注意:即便这里显示 100%,你可能已用完基础配额,只是 boost 还没动。
                </div>
                <TipApiField name="current_interval_remaining_percent" />
              </div>
            }
          />
          <Metric
            label="5h 计数"
            value={
              intervalTotal > 0
                ? `${formatCount(intervalUsed)} / ${formatCount(intervalTotal)}`
                : formatCount(intervalUsed)
            }
            tone="neutral"
            tipContent={
              <div>
                <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">5h 任务计数</div>
                <div>5h 窗口内已用任务数 / 基础任务数(不含 boost)。</div>
                <div className="mt-1 text-text-muted">
                  <code className="font-mono text-cyan">0 / 0</code> 可能意味着该类目不限速,或不在本计费体系。
                  <code className="font-mono text-cyan">3 / 3</code> 表示基础 3 个任务已用完。
                </div>
                <TipApiField name="current_interval_usage_count / current_interval_total_count" />
              </div>
            }
          />
          {model.interval_remains_ms !== undefined && (
            <Metric
              label="5h 重置"
              value={formatRemainDuration(model.interval_remains_ms)}
              tone="violet"
              tipContent={
                <div>
                  <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">5h 倒计时</div>
                  <div>距 5h 窗口刷新的剩余时间。归零时窗口会滚动,已用计数重置。</div>
                  {model.interval_end_time && (
                    <div className="mt-1 text-text-muted">
                      预计重置时刻: <code className="font-mono text-cyan">{formatTsFromMs(model.interval_end_time)}</code>
                    </div>
                  )}
                  <TipApiField name="remains_time" />
                </div>
              }
            />
          )}
        </div>
      </div>

      {hasWeekly && (
        <Tooltip
          width={300}
          content={
            <div>
              <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">周窗口(约 1 周)</div>
              <div>比 5h 窗口额度更大,周期约为 1 周(到下个周日 00:00 归零)。</div>
              <div className="mt-1 text-text-muted">
                进度条琥珀→玫红,宽度对应该类目的「已用比例」(<code className="font-mono text-cyan">100 − 剩余%</code>)。空条=健康,满条=已耗尽。
              </div>
              <TipApiField name="current_weekly_remaining_percent / current_weekly_usage_count / current_weekly_total_count" />
            </div>
          }
        >
          <div className="rounded-xl border border-ink-500/60 bg-ink-800/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="stat-label flex items-center gap-1">
                <Clock size={11} /> 周窗口
              </span>
              <span className="font-mono text-text-secondary">
                {formatPercent(weeklyPercent!)} · {formatCount(weeklyUsed ?? 0)} /{' '}
                {formatCount(weeklyTotal ?? 0)}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-700/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber to-rose transition-[width] duration-700"
                style={{ width: `${Math.max(0, Math.min(100, 100 - (weeklyPercent ?? 0)))}%` }}
              />
            </div>
            {model.weekly_remains_ms !== undefined && (
              <p className="mt-2 font-mono text-[10px] text-text-muted">
                距周重置: {formatRemainDuration(model.weekly_remains_ms)}
              </p>
            )}
          </div>
        </Tooltip>
      )}

      {hasBoost && (
        <div className="flex flex-wrap items-center gap-2">
          {model.interval_boost_permille !== undefined && model.interval_boost_permille > 0 && (
            <Tooltip
              width={260}
              content={
                <div>
                  <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">5h 临时加成</div>
                  <div>5h 窗口的额外容量加成。</div>
                  <div className="mt-1 text-text-muted">
                    数值是千分制(‰),除以 10 得到百分比。例:2000‰ = 200%,代表可用容量为基础配额的 3 倍。
                  </div>
                  <TipApiField name="interval_boost_permille" />
                </div>
              }
            >
              <span className="pill border-cyan/40 bg-cyan/5 text-cyan-soft">
                5h {permilleToPercent(model.interval_boost_permille)}
              </span>
            </Tooltip>
          )}
          {model.weekly_boost_permille !== undefined && model.weekly_boost_permille > 0 && (
            <Tooltip
              width={260}
              content={
                <div>
                  <div className="mb-1 font-display text-[11px] font-semibold text-text-primary">周窗口临时加成</div>
                  <div>周窗口的额外容量加成。</div>
                  <div className="mt-1 text-text-muted">
                    数值是千分制(‰),除以 10 得到百分比。
                  </div>
                  <TipApiField name="weekly_boost_permille" />
                </div>
              }
            >
              <span className="pill border-amber/40 bg-amber/5 text-amber-soft">
                周 {permilleToPercent(model.weekly_boost_permille)}
              </span>
            </Tooltip>
          )}
        </div>
      )}

      {open && (
        <pre className="max-h-56 overflow-auto rounded-lg border border-ink-500/40 bg-ink-950/60 p-3 text-[11px] leading-relaxed text-text-secondary">
          {JSON.stringify(model.raw, null, 2)}
        </pre>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
  big,
  tipContent,
}: {
  label: string
  value: string
  tone: 'cyan' | 'violet' | 'amber' | 'neutral'
  big?: boolean
  tipContent?: ReactNode
}) {
  const toneText: Record<typeof tone, string> = {
    cyan: 'text-cyan',
    violet: 'text-violet-soft',
    amber: 'text-amber',
    neutral: 'text-text-primary',
  } as const
  const content = (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <span className={cn('font-mono font-semibold tabular-nums', toneText[tone], big && 'text-base')}>
        {value}
      </span>
    </div>
  )
  if (!tipContent) return content
  return (
    <Tooltip content={tipContent} className="block w-full">
      {content}
    </Tooltip>
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
        <div className="h-[108px] w-[108px] animate-pulse rounded-full bg-ink-700/60" />
        <div className="flex-1 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-ink-700/60" />
          ))}
        </div>
      </div>
    </div>
  )
}
