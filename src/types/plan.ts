/**
 * Shared types between the proxy server and the React client.
 * The exact shape returned by upstream is not guaranteed, so the client
 * parser is defensive and degrades gracefully when fields are missing.
 */

export type ProviderId = 'minimax' | 'kimi'

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
  models: ModelRemain[]
  source: string
  raw: unknown
}
