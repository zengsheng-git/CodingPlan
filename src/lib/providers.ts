/**
 * Provider registry — single source of truth for upstream API endpoints.
 * 前端直接调用厂商 API（无后端代理），所以 registry 必须放在前端。
 * 添加新 provider：1) 在 PROVIDERS 加一项；2) 在 src/lib/parse.ts 加对应 parser。
 */
export type ProviderId = 'minimax' | 'kimi' | 'glm' | 'deepseek'

export interface ProviderConfig {
  id: ProviderId
  /** 中文显示名 */
  name: string
  /**
   * 完整 host（带协议），例如 https://api.minimaxi.com。
   * 留空表示走 Vite dev proxy（用于绕过 CORS preflight）。
   */
  host: string
  /**
   * 路径部分：
   * - 直接调用厂商 API 时：例如 `/v1/api/openplatform/coding_plan/remains`
   * - 走 Vite dev proxy 时：以 `/` 开头的相对路径，例如 `/api/kimi-usages`
   */
  path: string
  /** 调用方法 */
  method: 'GET' | 'POST'
  /** 是否已确认可用 */
  confirmed: boolean
  /**
   * 次要 endpoints: 同时调用的次要查询路径, 比如 DeepSeek 在查余额之外,
   * 还可以查 /v1/usage (CSDN 文章提到, 实际响应结构待用户验证)。
   * 每个 endpoint 产生独立的 UpstreamSource。
   */
  extraPaths?: string[]
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    host: 'https://api.minimaxi.com',
    path: '/v1/api/openplatform/coding_plan/remains',
    method: 'GET',
    confirmed: true,
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    // host 留空 → 走 Vite dev proxy（见 vite.config.ts）。
    // Kimi 的 OPTIONS preflight 不发 CORS 头,无法纯前端绕过。
    host: '',
    path: '/api/kimi-usages',
    method: 'GET',
    confirmed: true,
  },
  glm: {
    id: 'glm',
    name: 'GLM (智谱)',
    // ✅ 真实 endpoint (来自开源包 glm-quota-line 源码验证)
    // 国内: open.bigmodel.cn  国际: api.z.ai (同一个 monitor 服务)
    // ⚠️ 关键: 认证 header 是 "Authorization: <token>" 不带 Bearer 前缀
    // token 类型是 ANTHROPIC_AUTH_TOKEN (Claude Code / TRAE IDE 兼容协议),
    // 不是普通 API Key
    host: 'https://open.bigmodel.cn',
    path: '/api/monitor/usage/quota/limit',
    method: 'GET',
    confirmed: true,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    // ✅ 官方文档: https://api-docs.deepseek.com/zh-cn/api/get-user-balance
    // CORS 完美支持 + Bearer Token 认证
    // 响应: { is_available, balance_infos: [{currency, total_balance, granted_balance, topped_up_balance}] }
    // 注意: DeepSeek 是预付费扣费模式,没有 5h 窗口/周窗口概念,
    //      这里查询的是账户余额(包括赠金 + 充值金)
    host: 'https://api.deepseek.com',
    path: '/user/balance',
    method: 'GET',
    confirmed: true,
    // DeepSeek 没有公开调用记录 API, 完整 usage 详情(每次调用的 token 数、
    // 时间、请求 ID 等)只能登录 https://platform.deepseek.com/usage 查看。
    // 之前的 CSDN 文章提到 /v1/usage, 实际验证 404。
    // ProviderConfig.extraPaths 字段保留, 留给未来其他 provider 用。
  },
}

export const DEFAULT_PROVIDER: ProviderId = 'minimax'

export function getProvider(id: string | undefined | null): ProviderConfig | null {
  if (!id) return null
  return PROVIDERS[id as ProviderId] ?? null
}

export function listProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS)
}