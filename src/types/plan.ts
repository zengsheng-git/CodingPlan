/**
 * Shared types between the proxy server and the React client.
 * The exact shape returned by upstream is not guaranteed, so the client
 * parser is defensive and degrades gracefully when fields are missing.
 */

export type ProviderId = 'minimax' | 'kimi' | 'glm' | 'deepseek'

export interface UpstreamSource {
  provider: ProviderId
  endpoint: string
  status: number
  raw: unknown
  ok: boolean
  error?: string
  fetchedAt: string
}

export interface PlanQueryResponse {
  ok: boolean
  sources: UpstreamSource[]
}

/**
 * DeepSeek 余额信息。
 * 注意 DeepSeek 是预付费扣费模式(没有 5h / 周窗口),
 * 只查账户余额(余额 = 赠金余额 + 充值余额)。
 */
export interface DeepseekBalanceInfo {
  currency: 'CNY' | 'USD'
  total_balance: string
  granted_balance: string
  topped_up_balance: string
}

export interface ModelRemain {
  /** Backend category, e.g. "general", "video", "image" */
  model_name: string
  /** Friendlier display label derived from model_name */
  display_label?: string

  // 5h rolling interval window
  interval_total_count?: number
  interval_usage_count?: number
  interval_remaining_percent?: number
  interval_status?: number
  interval_start_time?: number
  interval_end_time?: number
  interval_remains_ms?: number
  interval_boost_permille?: number

  // Weekly window
  weekly_total_count?: number
  weekly_usage_count?: number
  weekly_remaining_percent?: number
  weekly_status?: number
  weekly_start_time?: number
  weekly_end_time?: number
  weekly_remains_ms?: number
  weekly_boost_permille?: number

  // Legacy aliases
  current_count?: number
  total_count?: number
  current_interval_count?: number
  reset_at?: string
  raw: Record<string, unknown>
}

export interface NormalizedPlan {
  provider: ProviderId
  /** "MiniMax" | "Kimi" etc. */
  source_label: string
  total_credits?: number
  used_credits?: number
  remaining_credits?: number
  avg_remaining_percent?: number
  next_reset_at?: number
  weekly_reset_at?: number
  /**
   * DeepSeek 等预付费平台使用: 不显示 5h / 周窗口,
   * 而是显示账户余额表格(每种货币一行,带赠金/充值金明细)。
   */
  balance_infos?: DeepseekBalanceInfo[]
  /**
   * DeepSeek `is_available`: 账户是否还有余额可调用 API
   */
  is_available?: boolean
  models: ModelRemain[]
  source: string
  raw: unknown
}
