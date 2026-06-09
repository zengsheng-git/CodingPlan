import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/format'

interface ArcProgressProps {
  /** 0..1 */
  value: number
  size?: number
  stroke?: number
  /** outer track color */
  trackClassName?: string
  /** used arc gradient class list (overrides default) */
  gradient?: 'cyan-violet' | 'amber-rose' | 'cyan-amber'
  showLabel?: boolean
  /**
   * 自定义圆盘中央文字内容。传 `string|number` 会被当作字面量显示;
   * 不传时按 `value * 100%` 渲染。传 `null` 等同于 `showLabel={false}`。
   */
  label?: ReactNode
  labelClassName?: string
  className?: string
}

const GRADIENTS: Record<NonNullable<ArcProgressProps['gradient']>, [string, string]> = {
  'cyan-violet': ['#5EE6E6', '#9B6BFF'],
  'amber-rose': ['#F5B14C', '#FF6B9B'],
  'cyan-amber': ['#5EE6E6', '#F5B14C'],
}

const RADIUS_RATIO = 0.78

export default function ArcProgress({
  value,
  size = 160,
  stroke = 10,
  trackClassName = 'stroke-ink-600/70',
  gradient = 'cyan-violet',
  showLabel = true,
  label,
  labelClassName,
  className,
}: ArcProgressProps) {
  const safe = Math.max(0, Math.min(1, value || 0))
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(safe))
    return () => cancelAnimationFrame(id)
  }, [safe])

  const r = (size / 2) * RADIUS_RATIO
  const cx = size / 2
  const cy = size / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - animated)
  const [c1, c2] = GRADIENTS[gradient]
  const gradId = `arc-grad-${gradient}`

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
          <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className={trackClassName}
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          filter="url(#arc-glow)"
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {showLabel && label !== null && (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center',
            labelClassName,
          )}
        >
          {label !== undefined ? (
            <span className="font-mono text-2xl font-semibold tracking-tight text-text-primary">{label}</span>
          ) : (
            <span className="font-mono text-2xl font-semibold tracking-tight text-text-primary">
              {(safe * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}
