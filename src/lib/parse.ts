import type {
  ModelRemain,
  NormalizedPlan,
  ProviderId,
  UpstreamSource,
} from '@/types/plan'

/** Maps the backend category id to a Chinese display label. */
export const MODEL_LABEL_MAP: Record<string, string> = {
  general: '通用对话',
  speech: '语音合成',
  video: '视频生成',
  image: '图像生成',
  music: '音乐生成',
  vision: '视觉理解',
  multimodal: '多模态',
  reasoning: '深度推理',
  embedding: '向量检索',
  realtime: '实时对话',
  'kimi-coding': 'Kimi Coding',
}

const PROVIDER_NAME: Record<ProviderId, string> = {
  minimax: 'MiniMax',
  kimi: 'Kimi',
}

/** Kimi/Moonshot membership level → 中文. Unknown levels fall back to raw. */
const KIMI_LEVEL_MAP: Record<string, string> = {
  LEVEL_TRIAL: '试用',
  LEVEL_FREE: '免费',
  LEVEL_BASIC: '基础',
  LEVEL_STANDARD: '标准',
  LEVEL_INTERMEDIATE: '中级',
  LEVEL_ADVANCED: '高级',
  LEVEL_PRO: '专业',
  LEVEL_UNLIMITED: '无限',
}

export function resolveLabel(modelName: string): string {
  const key = modelName.toLowerCase().trim()
  return MODEL_LABEL_MAP[key] ?? modelName
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v)
  }
  return undefined
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

function pickMsTimestamp(v: unknown): number | undefined {
  const n = num(v)
  if (n === undefined) return undefined
  return n < 1e12 ? n * 1000 : n
}

function extractModelRemains(input: unknown): ModelRemain[] {
  if (!input || typeof input !== 'object') return []
  const root = input as Record<string, unknown>
  const candidates: unknown[] = []
  if (Array.isArray(root.model_remains)) candidates.push(root.model_remains)
  if (Array.isArray(root.modelRemains)) candidates.push(root.modelRemains)
  const data = root.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.model_remains)) candidates.push(d.model_remains)
    if (Array.isArray(d.modelRemains)) candidates.push(d.modelRemains)
  }
  if (Array.isArray(root.data)) candidates.push(root.data)

  const seen = new Set<string>()
  const out: ModelRemain[] = []
  for (const candidate of candidates) {
    for (const item of candidate as unknown[]) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const name =
        pickString(obj.model_name) ??
        pickString(obj.name) ??
        pickString(obj.model) ??
        'unnamed-model'
      if (seen.has(name)) continue
      seen.add(name)

      const intervalTotal = num(obj.current_interval_total_count)
      const intervalUsed = num(obj.current_interval_usage_count)
      const intervalPercent = num(obj.current_interval_remaining_percent)
      const weeklyTotal = num(obj.current_weekly_total_count)
      const weeklyUsed = num(obj.current_weekly_usage_count)
      const weeklyPercent = num(obj.current_weekly_remaining_percent)

      out.push({
        model_name: name,
        display_label: resolveLabel(name),
        interval_total_count: intervalTotal,
        interval_usage_count: intervalUsed,
        interval_remaining_percent: intervalPercent,
        interval_status: num(obj.current_interval_status),
        interval_start_time: num(obj.start_time),
        interval_end_time: num(obj.end_time),
        interval_remains_ms: num(obj.remains_time),
        interval_boost_permille: num(obj.interval_boost_permille),
        weekly_total_count: weeklyTotal,
        weekly_usage_count: weeklyUsed,
        weekly_remaining_percent: weeklyPercent,
        weekly_status: num(obj.current_weekly_status),
        weekly_start_time: num(obj.weekly_start_time),
        weekly_end_time: num(obj.weekly_end_time),
        weekly_remains_ms: num(obj.weekly_remains_time),
        weekly_boost_permille: num(obj.weekly_boost_permille),
        total_count: intervalTotal,
        current_count: intervalUsed,
        current_interval_count: intervalUsed,
        reset_at: pickString(obj.reset_at) ?? pickString(obj.next_reset_at),
        raw: obj,
      })
    }
    if (out.length) break
  }
  return out
}

function pickResetAt(input: unknown): number | undefined {
  if (!input || typeof input !== 'object') return undefined
  const root = input as Record<string, unknown>
  const candidates = [
    root.reset_at,
    root.next_reset_at,
    root.next_reset,
    root.end_time,
    root.weekly_end_time,
  ]
  for (const c of candidates) {
    const n = pickMsTimestamp(c)
    if (n !== undefined) return n
  }
  return undefined
}

/**
 * Normalize a MiniMax-style upstream response (per-category `model_remains[]`)
 * into the common `NormalizedPlan` shape. Returns null if the source is
 * empty or not ok. Use `bestPlan()` to dispatch across providers.
 */
export function normalize(source: UpstreamSource): NormalizedPlan | null {
  if (!source.ok || !source.raw) return null
  const models = extractModelRemains(source.raw)
  const providerName = PROVIDER_NAME[source.provider] ?? source.provider

  let totalSum: number | undefined
  let usedSum: number | undefined
  for (const m of models) {
    if (m.interval_total_count !== undefined) {
      totalSum = (totalSum ?? 0) + m.interval_total_count
    }
    if (m.interval_usage_count !== undefined) {
      usedSum = (usedSum ?? 0) + m.interval_usage_count
    }
  }
  const remainingSum =
    totalSum !== undefined && usedSum !== undefined ? Math.max(0, totalSum - usedSum) : undefined

  const percents = models
    .map(m => m.interval_remaining_percent)
    .filter((v): v is number => v !== undefined)
  const avgPercent = percents.length
    ? percents.reduce((a, b) => a + b, 0) / percents.length
    : undefined

  const resets = models
    .map(m => m.interval_end_time)
    .filter((v): v is number => v !== undefined && v > 0)
  const nextReset = resets.length ? Math.min(...resets) : undefined
  const weeklyResets = models
    .map(m => m.weekly_end_time)
    .filter((v): v is number => v !== undefined && v > 0)
  const weeklyReset = weeklyResets.length ? Math.min(...weeklyResets) : undefined

  return {
    provider: source.provider,
    source_label: providerName,
    total_credits: totalSum,
    used_credits: usedSum,
    remaining_credits: remainingSum,
    avg_remaining_percent: avgPercent,
    next_reset_at: nextReset ?? pickResetAt(source.raw),
    weekly_reset_at: weeklyReset,
    models,
    source: source.endpoint,
    raw: source.raw,
  }
}

export function bestPlan(sources: UpstreamSource[]): NormalizedPlan | null {
  for (const source of sources) {
    if (!source.ok) continue
    const plan = source.provider === 'kimi' ? normalizeKimi(source) : normalize(source)
    if (plan && plan.models.length > 0) return plan
  }
  return null
}

function numFromUnknown(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v)
  }
  return undefined
}

function msFromIso(v: unknown): number | undefined {
  if (typeof v !== 'string' || v.trim() === '') return undefined
  const d = new Date(v)
  const ms = d.getTime()
  return Number.isFinite(ms) ? ms : undefined
}

/**
 * Kimi Code (`/coding/v1/usages`) returns aggregate account-level data,
 * not per-model. Map it into a single synthetic `ModelRemain` so the
 * existing ModelRemainCard renders it without UI changes.
 */
export function normalizeKimi(source: UpstreamSource): NormalizedPlan | null {
  if (!source.ok || !source.raw || typeof source.raw !== 'object') return null
  const raw = source.raw as Record<string, unknown>

  // 5h rolling window — find the matching entry in limits[]
  const limits = Array.isArray(raw.limits) ? (raw.limits as Array<Record<string, unknown>>) : []
  const fiveHourEntry = limits.find(l => {
    const w = l?.window as Record<string, unknown> | undefined
    return w?.duration === 300 && w?.timeUnit === 'TIME_UNIT_MINUTE'
  })
  const fiveHourDetail = fiveHourEntry?.detail as Record<string, unknown> | undefined

  // Billing-cycle usage (the top-level usage object)
  const cycle = raw.usage as Record<string, unknown> | undefined

  // Plan tier
  const user = raw.user as Record<string, unknown> | undefined
  const membership = user?.membership as Record<string, unknown> | undefined
  const rawLevel = pickString(membership?.level) ?? 'kimi-coding'
  const levelLabel = KIMI_LEVEL_MAP[rawLevel] ?? rawLevel

  const intervalEndTs = msFromIso(fiveHourDetail?.resetTime)
  const weeklyEndTs = msFromIso(cycle?.resetTime)
  const intervalRemainingPercent = numFromUnknown(fiveHourDetail?.remaining)
  const weeklyRemainingPercent = numFromUnknown(cycle?.remaining)

  // Synthetic single model that represents the whole account
  const model: ModelRemain = {
    model_name: 'kimi-coding',
    display_label: `${levelLabel} 套餐`,
    interval_total_count: numFromUnknown(fiveHourDetail?.limit),
    interval_usage_count: numFromUnknown(fiveHourDetail?.used),
    interval_remaining_percent: intervalRemainingPercent,
    interval_end_time: intervalEndTs,
    interval_remains_ms: intervalEndTs ? intervalEndTs - Date.now() : undefined,
    weekly_total_count: numFromUnknown(cycle?.limit),
    weekly_usage_count: numFromUnknown(cycle?.used),
    weekly_remaining_percent: weeklyRemainingPercent,
    weekly_end_time: weeklyEndTs,
    weekly_remains_ms: weeklyEndTs ? weeklyEndTs - Date.now() : undefined,
    total_count: numFromUnknown(fiveHourDetail?.limit),
    current_count: numFromUnknown(fiveHourDetail?.used),
    raw,
  }

  return {
    provider: 'kimi',
    source_label: 'Kimi Code',
    avg_remaining_percent: intervalRemainingPercent,
    next_reset_at: intervalEndTs,
    weekly_reset_at: weeklyEndTs,
    models: [model],
    source: source.endpoint,
    raw,
  }
}
