import type {
  DeepseekBalanceInfo,
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
  glm: 'GLM',
  deepseek: 'DeepSeek',
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

/**
 * MiniMax `base_resp.status_code` values that mean the user has no active
 * Coding Plan subscription (as opposed to a network/auth/parse error).
 * Surfaced separately so the UI can show a "renew your plan" banner
 * instead of a generic "fetch failed" message.
 *
 *   2062 — no active token plan subscription
 *   2063 — quota exhausted (also blocks the endpoint even if a plan exists)
 *   2064 — token plan expired
 */
const NO_SUBSCRIPTION_CODES = new Set<number>([2062, 2063, 2064])

/**
 * Inspect raw responses for an "account has no active subscription" signal.
 * Returns the code + message so the UI can show exactly what MiniMax said.
 */
export function detectNoSubscription(
  sources: UpstreamSource[],
): { code: number; message: string } | null {
  for (const source of sources) {
    if (!source.raw || typeof source.raw !== 'object') continue
    const raw = source.raw as Record<string, unknown>

    // MiniMax: base_resp.status_code
    const baseResp = raw.base_resp
    if (baseResp && typeof baseResp === 'object') {
      const code = Number((baseResp as Record<string, unknown>).status_code ?? -1)
      if (NO_SUBSCRIPTION_CODES.has(code)) {
        const message = String(
          (baseResp as Record<string, unknown>).status_msg ?? 'subscription not active',
        )
        return { code, message }
      }
    }

    // GLM: { code: xxxx, msg: "...", success: false }
    // 已知"无 Coding Plan"错误码:code !== 0 且 msg 含 "coding plan" 字样
    if (source.provider === 'glm' && raw.code !== undefined && raw.success === false) {
      const code = Number(raw.code)
      const msg = String(raw.msg ?? '')
      if (/coding\s*plan/i.test(msg) || /不存在/i.test(msg)) {
        return { code, message: msg }
      }
    }
  }
  return null
}

/**
 * Pick the first usable source and normalize it. Dispatches to the
 * provider-specific parser based on `source.provider`.
 * Add a new provider: extend the `ProviderId` union, implement a
 * `normalizeXxx()` and add a branch here.
 */
export function bestPlan(sources: UpstreamSource[]): NormalizedPlan | null {
  for (const source of sources) {
    if (!source.ok) continue
    const plan =
      source.provider === 'kimi'
        ? normalizeKimi(source)
        : source.provider === 'glm'
          ? normalizeGlm(source)
          : source.provider === 'deepseek'
            ? normalizeDeepseek(source)
            : normalize(source)
    if (plan && (plan.models.length > 0 || (plan.balance_infos && plan.balance_infos.length > 0))) return plan
  }
  // Fallback: 主 endpoint 没数据时, 尝试把 extra endpoint (如 DeepSeek /v1/usage)
  // 的响应归一化为统计卡。即便这只是展示原始 raw, 也比完全空着好。
  for (const source of sources) {
    const plan = normalizeExtraUsage(source)
    if (plan && plan.models.length > 0) return plan
  }
  return null
}

/**
 * 把 extra endpoint (如 DeepSeek /v1/usage) 的响应也归一化,
 * 让 UI 能展示调用次数/Token 等用量数据, 不依赖主 endpoint 的结构。
 *
 * 响应结构待真实 Key 验证后再细化。目前先做一个激进探测:
 * 尝试识别几种常见的 usage 字段名, 任何字段找到了就显示原始 raw。
 */
export function normalizeExtraUsage(source: UpstreamSource): NormalizedPlan | null {
  if (!source.ok || !source.raw || typeof source.raw !== 'object') return null
  const raw = source.raw as Record<string, unknown>

  // 先判断是不是 usage 类型 (有提示字段)
  const hasUsageSignal =
    'usage' in raw ||
    'stats' in raw ||
    'consumption' in raw ||
    'calls' in raw ||
    'records' in raw ||
    'logs' in raw ||
    'data' in raw
  if (!hasUsageSignal) return null

  const usageFields: Record<string, number | string | undefined> = {
    total_tokens: pickNum(raw.total_tokens) ?? pickNum((raw as any).totalTokens),
    prompt_tokens: pickNum(raw.prompt_tokens) ?? pickNum((raw as any).promptTokens),
    completion_tokens:
      pickNum(raw.completion_tokens) ?? pickNum((raw as any).completionTokens),
    total_calls: pickNum(raw.total_calls) ?? pickNum((raw as any).totalCalls),
    cache_hit: pickNum(raw.cache_hit) ?? pickNum((raw as any).cacheHit),
    cache_miss: pickNum(raw.cache_miss) ?? pickNum((raw as any).cacheMiss),
    amount: pickNum(raw.amount),
  }

  return {
    provider: source.provider,
    source_label: `${source.endpoint.split('/').pop() ?? 'usage'} (extra)`,
    models: [
      {
        model_name: '调用统计',
        interval_remaining_percent: 100,
        // 把找到的数字 flatten 到 raw 字段里, UI 不需要专门组件也能显示
        raw: raw,
        ...Object.fromEntries(
          Object.entries(usageFields).filter(([, v]) => v !== undefined),
        ) as Record<string, unknown>,
      } as ModelRemain,
    ],
    source: source.endpoint,
    raw,
  }
}

function pickNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
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

/**
 * GLM (智谱 AI) Coding Plan 响应归一化。
 *
 * 响应结构(来自开源包 glm-quota-line 源码验证):
 * {
 *   success: true,
 *   data: {
 *     level: 'Lite' | 'Pro' | 'Max' | ...,
 *     limits: [
 *       { type: 'TOKENS_LIMIT', number: 5, usage, remaining, currentValue, percentage, nextResetTime },  // 5h
 *       { type: 'TOKENS_LIMIT', usage, remaining, currentValue, percentage, nextResetTime },             // week
 *       { type: 'MCP_LIMIT' | 'TIME_LIMIT', ... }
 *     ]
 *   }
 * }
 *
 * 时间戳单位: 毫秒 (JS Date.now() 风格)
 *
 * 失败响应示例:
 *   { success: false, code: 1001|401, msg: '...' }   → 鉴权失败
 *   { success: false, code: 500, msg: '当前用户不存在coding plan' }  → Key 类型错
 */
export function normalizeGlm(source: UpstreamSource): NormalizedPlan | null {
  if (!source.ok || !source.raw || typeof source.raw !== 'object') return null
  const raw = source.raw as Record<string, unknown>

  if (raw.success !== true) return null

  const data = raw.data as Record<string, unknown> | undefined
  if (!data || typeof data !== 'object') return null

  const level = typeof data.level === 'string' ? data.level : ''
  const limits = Array.isArray(data.limits) ? (data.limits as Record<string, unknown>[]) : []
  if (limits.length === 0) return null

  const asFinite = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const clampPercent = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

  const computePercentages = (limit: Record<string, unknown>) => {
    const usage = asFinite(limit.usage)
    const remaining = asFinite(limit.remaining)
    const currentValue = asFinite(limit.currentValue)
    const totalFromParts =
      remaining !== null && currentValue !== null ? remaining + currentValue : null
    const total = totalFromParts !== null && totalFromParts > 0 ? totalFromParts : usage

    if (total !== null && total > 0) {
      if (remaining !== null && remaining >= 0 && remaining <= total) {
        const leftPercent = clampPercent((remaining / total) * 100)
        return { leftPercent, usedPercent: 100 - leftPercent }
      }
      if (currentValue !== null && currentValue >= 0 && currentValue <= total) {
        const usedPercent = clampPercent((currentValue / total) * 100)
        return { leftPercent: 100 - usedPercent, usedPercent }
      }
    }
    const usedPercent = clampPercent(asFinite(limit.percentage) ?? -1)
    if (usedPercent < 0) return null
    return { leftPercent: 100 - usedPercent, usedPercent }
  }

  // 找 5h 和 week 两个 TOKENS_LIMIT
  const tokenLimits = limits.filter(l => l?.type === 'TOKENS_LIMIT')
  const explicit5h = tokenLimits.find(l => Number(l?.number) === 5)
  const fiveHourLimit = explicit5h ?? tokenLimits[0]
  const weekLimit = tokenLimits.find(l => l !== fiveHourLimit) ?? tokenLimits[1]

  if (!fiveHourLimit) return null

  const fiveHourPct = computePercentages(fiveHourLimit)
  if (!fiveHourPct) return null

  const weekPct = weekLimit ? computePercentages(weekLimit) : null
  const fiveHourReset = asFinite((fiveHourLimit as Record<string, unknown>).nextResetTime)
  const weekReset = weekLimit
    ? asFinite((weekLimit as Record<string, unknown>).nextResetTime)
    : null

  const model: ModelRemain = {
    model_name: level ? `GLM ${level}` : 'GLM Coding Plan',
    interval_remaining_percent: fiveHourPct.leftPercent,
    interval_total_count: asFinite((fiveHourLimit as Record<string, unknown>).usage) ?? 0,
    interval_usage_count:
      asFinite((fiveHourLimit as Record<string, unknown>).currentValue) ?? 0,
    interval_end_time: fiveHourReset !== null ? Math.floor(fiveHourReset / 1000) : undefined,
    weekly_remaining_percent: weekPct?.leftPercent ?? null,
    weekly_total_count: weekLimit ? asFinite((weekLimit as Record<string, unknown>).usage) : null,
    weekly_usage_count: weekLimit
      ? asFinite((weekLimit as Record<string, unknown>).currentValue)
      : null,
    weekly_end_time: weekReset !== null ? Math.floor(weekReset / 1000) : undefined,
    raw: fiveHourLimit,
  }

  return {
    provider: 'glm',
    source_label: level ? `GLM ${level}` : 'GLM Coding Plan',
    avg_remaining_percent: fiveHourPct.leftPercent,
    next_reset_at: fiveHourReset !== null ? Math.floor(fiveHourReset / 1000) : null,
    weekly_reset_at: weekReset !== null ? Math.floor(weekReset / 1000) : null,
    models: [model],
    source: source.endpoint,
    raw,
  }
}

/**
 * DeepSeek 余额归一化。
 *
 * 响应结构(官方文档 https://api-docs.deepseek.com/zh-cn/api/get-user-balance):
 * {
 *   is_available: true,
 *   balance_infos: [
 *     { currency: 'CNY', total_balance: '110.00', granted_balance: '10.00', topped_up_balance: '100.00' }
 *   ]
 * }
 *
 * DeepSeek 是预付费扣费模式, 没有 5h 窗口 / 周窗口 / 重置时间概念。
 * 余额数值是字符串('110.00' 风格), 我们原样保留作为 UI 展示。
 *
 * 由于没有窗口概念, models 字段保持为空数组,
 * 真正的数据放在 balance_infos / is_available 字段。
 * bestPlan() 已适配: 任一字段非空就返回这个 plan。
 */
export function normalizeDeepseek(source: UpstreamSource): NormalizedPlan | null {
  if (!source.ok || !source.raw || typeof source.raw !== 'object') return null
  const raw = source.raw as Record<string, unknown>

  const isAvailable = raw.is_available === true
  const rawBalanceInfos = Array.isArray(raw.balance_infos)
    ? (raw.balance_infos as Record<string, unknown>[])
    : []

  const balanceInfos: DeepseekBalanceInfo[] = []
  for (const info of rawBalanceInfos) {
    const currency = info.currency
    if (currency !== 'CNY' && currency !== 'USD') continue
    const total = typeof info.total_balance === 'string' ? info.total_balance : ''
    const granted = typeof info.granted_balance === 'string' ? info.granted_balance : ''
    const toppedUp = typeof info.topped_up_balance === 'string' ? info.topped_up_balance : ''
    if (!total && !granted && !toppedUp) continue
    balanceInfos.push({
      currency,
      total_balance: total,
      granted_balance: granted,
      topped_up_balance: toppedUp,
    })
  }

  if (balanceInfos.length === 0 && !isAvailable) return null

  return {
    provider: 'deepseek',
    source_label: 'DeepSeek',
    is_available: isAvailable,
    balance_infos: balanceInfos,
    // DeepSeek 没有 5h / 周窗口,
    // 谎报给主 UI 一个 100% 让它不显示 "0%" 警告
    avg_remaining_percent: isAvailable ? 100 : 0,
    models: [],
    source: source.endpoint,
    raw,
  }
}
