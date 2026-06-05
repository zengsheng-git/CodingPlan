export { cn } from '@/lib/utils'

/** Format an integer / big-number into a compact human string. */
export function formatCount(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_0000_0000) return `${(value / 1_0000_0000).toFixed(2)} 亿`
  if (abs >= 10_000) return `${(value / 10_000).toFixed(2)} 万`
  if (abs >= 1_000) return value.toLocaleString('en-US')
  return String(value)
}

/** Format a ratio (0-1) into a percentage string. */
export function formatPercent(ratio: number | undefined | null, digits = 1): string {
  if (ratio === undefined || ratio === null || Number.isNaN(ratio)) return '—'
  return `${(ratio * 100).toFixed(digits)}%`
}

export function formatTimestamp(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatTimeShort(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
