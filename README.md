# Token Observatory

本地单页仪表盘,实时查看 Coding Plan 余量。**不持久化任何数据,不上传任何 Key。**

## 支持的 Provider

| Provider | 平台 | Key 格式 | 余量 API | 生产可用 |
|---|---|---|---|---|
| `minimax` | MiniMax | `eyJ...` / `sk-cp-...` | `/v1/api/openplatform/coding_plan/remains` | ✅ 直连(CORS OK) |
| `kimi` | Kimi Code | `sk-kimi-...` | `/coding/v1/usages` | 🟡 仅本地 dev;CF Pages 上为演示假数据 |
| `glm` | 智谱 GLM | `xxxxxxxx.yyyyyyyy` | `/api/monitor/usage/quota/limit` | ⚠️ 多数账号查不到(见下) |
| `deepseek` | DeepSeek | `sk-...` | `/user/balance` | ✅ 直连(CORS OK,查账户余额) |

> **Kimi Code 与 Moonshot 开放平台是两套独立服务,凭证不互通。**
> **DeepSeek 是预付费扣费模式**,没有 5h/周窗口概念,这里查的是账户余额(赠金 + 充值金)。
> **GLM 的用量查询接口对多数账号返回"不存在 coding plan"**(智谱未公开开放此 API,且 Coding Plan 限指定工具调用),详见 [KIMI-PROXY.md](KIMI-PROXY.md) 的同类问题说明。

### 各 Provider 的生产可用性说明

- **MiniMax / DeepSeek**:厂商 API 返回正确 CORS 头,浏览器直连即可,**纯前端、生产可用**。
- **Kimi**:厂商 API 的 OPTIONS 预检不发 CORS 头,浏览器无法绕过。
  - 本地 dev:走 Vite proxy,**可用**。
  - 生产(GitHub Pages):纯静态无代理,**完全不可用**。
  - 生产(Cloudflare Pages):有代理 Function,但被 Kimi 自身的 Cloudflare 拦截,改为**返回演示假数据**(UI 会显示"演示数据"横幅)。详见 [KIMI-PROXY.md](KIMI-PROXY.md)。
- **GLM**:接口可达、Key 鉴权通过,但用量端点对普通 Coding Plan Key 返回"不存在 coding plan",目前**查不到真实数据**。

## 核心功能

- **多 Provider 切换**:顶部 tab 一键切换 MiniMax / Kimi / GLM / DeepSeek,每个 provider 独立保存 Key。
- **自动刷新**:默认开启,每 60 秒轮询一次(可调,最小 10 秒)。切换 provider 或 Key 时自动触发首次查询。
- **模型余量卡片**:展示每个模型的 5h 滚动窗口 + 每周窗口的已用/剩余/重置倒计时。
- **账户余额视图**(DeepSeek 专属):预付费模式展示总余额、充值余额、赠金余额及赠金占比。
- **未订阅提示**:当 Key 有效但账号没开 Coding Plan 时,显示橙色提示卡(而非报错)。
- **演示数据标识**:Kimi 在 CF Pages 上返回假数据时,卡片上方显示琥珀色"演示数据"横幅,避免误认。
- **Raw Response 面板**:可展开查看上游原始 JSON 响应,便于调试。
- **隐私优先**:API Key 只存浏览器 localStorage(`zustand/persist`),响应数据纯内存,刷新即丢,不落盘、不上传。

## 快速开始

```bash
npm install
npm run dev      # 启动 Vite (5173 或顺延端口)
```

浏览器打开终端提示的 URL(如 `http://localhost:5174/CodingPlan/`),选 provider、填 Key、点保存并查询。

> **混合架构**:MiniMax / DeepSeek / GLM 走纯前端直连;Kimi 走 Vite dev proxy(仅 dev 期)。
> **生产部署限制**:GitHub Pages 上 Kimi 完全失效;Cloudflare Pages 上 Kimi 为演示假数据。MiniMax / DeepSeek 在所有环境均可用。

### 其他命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发模式(Vite HMR) |
| `npm run build` | 编译到 `dist/`(纯静态) |
| `npm run check` | TypeScript 类型检查(0 错才算过) |
| `npm run lint` | ESLint |
| `npm run deploy:cf` | 手动部署到 Cloudflare Pages(需先 `wrangler login`) |

### 部署

本项目支持**双轨部署**(详见 [DEPLOY.md](DEPLOY.md)):

- **GitHub Pages**:`git push main` 自动触发,访问 `https://zengsheng-git.github.io/CodingPlan/`。MiniMax / DeepSeek / GLM 可用,Kimi 不可用。
- **Cloudflare Pages**:`git push main` 自动触发,访问 `https://codingplan-9xg.pages.dev/`。MiniMax / DeepSeek 可用,Kimi 为演示假数据。

## 添加新 Provider

需要改动 **6 处**(不是 README 旧版说的"两个文件"):

### 1. `src/types/plan.ts` — 扩展 `ProviderId` 联合类型

```ts
export type ProviderId = 'minimax' | 'kimi' | 'glm' | 'deepseek' | 'yournew'
```

### 2. `src/lib/providers.ts` — 在 `PROVIDERS` 加配置

```ts
yournew: {
  id: 'yournew',
  name: 'YourNew',
  host: 'https://api.yournew.com',  // 留空则走相对路径(配合 dev proxy)
  path: '/v1/quota/remain',
  method: 'GET',
  confirmed: true,
}
```

### 3. `src/lib/parse.ts` — 实现 `normalizeYourNew` + 在 `bestPlan()` 加 dispatch

```ts
// bestPlan() 里加分支:
source.provider === 'yournew' ? normalizeYourNew(source) : ...
```

### 4. `src/components/ProviderSwitcher.tsx` — `OPTIONS` 数组加一项

### 5. `src/components/ApiKeyBar.tsx` — `PROVIDER_PLACEHOLDER` 加 Key 格式提示

### 6. `src/pages/Home.tsx` — `PROVIDER_INFO_LINK` 加订阅方案链接

> 如果新 provider 走 dev proxy(像 Kimi),还要在 `vite.config.ts` 的 `server.proxy` 加配置,以及(可选)在 `functions/api/` 加 CF Pages Function。

## 架构

```
浏览器
   │
   ├── MiniMax:    fetch(https://api.minimaxi.com/..., { Authorization: Bearer <Key> })
   │                直连 (厂商返回正确 CORS 头)
   │
   ├── DeepSeek:   fetch(https://api.deepseek.com/user/balance, { Authorization: Bearer <Key> })
   │                直连 (查账户余额, 预付费模式)
   │
   ├── GLM:        fetch(https://open.bigmodel.cn/api/monitor/usage/quota/limit, { Authorization: <Key> })
   │                直连 (但多数账号返回"不存在 coding plan")
   │
   └── Kimi:       fetch(/api/kimi-usages, ...)   ← 同源相对路径
                    │
                    ├── dev:  Vite proxy → https://api.kimi.com/coding/v1/usages  ✅
                    └── prod: Cloudflare Pages Function (functions/api/kimi-usages.ts)
                              └─ 被 Kimi 自身的 CF 拦截 → 返回演示假数据  🟡
```

### 数据流

1. 用户在 `ApiKeyBar` 输入 Key → `store.setApiKey`(存 localStorage)
2. `fetchPlan()` → `fetchUpstream()` 按 provider 配置 fetch 厂商 API(可同时打主 path + extraPaths)
3. 上游返回 JSON → `bestPlan()` 按 `source.provider` 派发到 `normalize` / `normalizeKimi` / `normalizeGlm` / `normalizeDeepseek`
4. 归一化成统一的 `NormalizedPlan` → `ModelGrid`(或余额视图)渲染
5. `detectNoSubscription()` 识别"未订阅"信号 → 显示橙色提示卡
6. 原始响应同时存到 `data`,供 `RawResponsePanel` 展开 查看

### 前端状态(zustand store)

| 字段 | 类型 | 说明 |
|---|---|---|
| `provider` | `ProviderId` | 当前选中的 provider |
| `apiKeys` | `Record<ProviderId, string>` | 每个 provider 各自的 Key,存 localStorage |
| `data` | `{ sources: UpstreamSource[] } \| null` | 原始响应(给 Raw 面板用) |
| `plan` | `NormalizedPlan \| null` | 归一化数据(给卡片用) |
| `loading` | `boolean` | 查询中 |
| `error` | `string \| null` | 错误信息 |
| `lastFetchedAt` | `string \| null` | 上次查询时间 |
| `autoRefresh` | `boolean` | 自动刷新开关(默认开),存 localStorage |
| `refreshIntervalSec` | `number` | 刷新间隔秒数(默认 60,最小 10),存 localStorage |
| `showRaw` | `boolean` | Raw 面板展开状态,存 localStorage |
| `noSubscription` | `{ code, message } \| null` | 未订阅提示 |

## 隐私

- **API Key** 只存在浏览器 `localStorage`(`zustand/persist`),**不会发到任何第三方**(除被查询的厂商本身)。
- **响应数据** 纯本地内存,刷新即丢。
- 任何 fetch 失败 / 网络错误只显示在 UI,不落盘。

## 目录结构

```
src/                前端(Vite + React)
├── components/     UI 组件(ApiKeyBar / ModelGrid / ProviderSwitcher / RawResponsePanel / ...)
├── lib/            parse(归一化) / providers(端点配置) / format / utils
├── pages/          路由页面(Home)
├── store/          zustand 全局状态(planStore)
├── types/          TypeScript 类型(plan)
└── main.tsx        启动入口

functions/api/      Cloudflare Pages Functions
└── kimi-usages.ts  Kimi 代理(当前返回演示假数据)

public/             静态资源(含 _redirects: CF Pages 的 SPA fallback)
index.html          HTML 入口
vite.config.ts      Vite 配置(base 读 VITE_BASE 环境变量;含 Kimi dev proxy)
vercel.json         Vercel 部署的 SPA fallback

.github/workflows/
├── deploy.yml              部署到 GitHub Pages
└── deploy-cloudflare.yml   部署到 Cloudflare Pages

DEPLOY.md           部署文档(GitHub Pages + Cloudflare Pages 操作手册)
KIMI-PROXY.md       Kimi 生产代理问题与方案记录
```
