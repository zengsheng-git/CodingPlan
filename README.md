# Token Observatory

本地单页仪表盘，实时查看 Coding Plan 余量。**不持久化任何数据，不上传任何 Key。**

## 支持的 Provider

| Provider | 平台 | Key 格式 | 余量 API |
|---|---|---|---|
| `minimax` | MiniMax | `eyJ...` / `sk-cp-...` | `/v1/api/openplatform/coding_plan/remains` |
| `kimi`    | Kimi Code | `sk-kimi-...` | `/coding/v1/usages` |

> Kimi Code 与 Moonshot 开放平台是两套独立服务，凭证不互通。

## 快速开始

```bash
npm install
npm run dev      # 只启动前端 (Vite :5173)
```

浏览器打开 `http://localhost:5173`，选 provider、填 Key、点保存并查询。

> **纯前端架构**：浏览器直接调用厂商 API，没有后端代理。**前提**是厂商 API 已开启 CORS（MiniMax 和 Kimi 已实测支持）。

### 其他命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发模式 (Vite HMR) |
| `npm run build` | 编译到 `dist/`（纯静态，可部署到任意静态托管）|
| `npm run check` | TypeScript 类型检查 (0 错才算过) |
| `npm run lint` | ESLint |

### 部署到静态托管

```bash
npm run build
# 把 dist/ 整个目录上传到 GitHub Pages / Vercel / Netlify / Cloudflare Pages 即可
```

## 添加新 Provider

只需改两个文件：

### 1. 前端 [src/lib/providers.ts](src/lib/providers.ts)

```ts
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  // ... 已有 ...
  yournew: {
    id: 'yournew',
    name: 'YourNew',
    host: 'https://api.yournew.com',
    path: '/v1/quota/remain',
    method: 'GET',  // 或 'POST'
    confirmed: true,
  },
}
```

### 2. 前端 [src/lib/parse.ts](src/lib/parse.ts) — 实现 parser

每个 provider 响应结构不同（参考现有的 `normalize` 给 MiniMax 的、`normalizeKimi` 给 Kimi 的），把上游响应映射成 `NormalizedPlan`：

```ts
export function normalizeYourNew(source: UpstreamSource): NormalizedPlan | null {
  // ... 映射 ...
  return {
    provider: 'yournew',
    source_label: 'YourNew',
    models: [/* 一个或多个 ModelRemain */],
    // ...
  }
}
```

然后在 [src/types/plan.ts](src/types/plan.ts) 的 `ProviderId` 联合类型加一项，`bestPlan()` 里 dispatch 一下。

## 架构

```
浏览器 (5173)
   │  fetch(https://api.minimaxi.com/..., { Authorization: Bearer <Key> })
   │  (直接调用,无后端)
   ▼
上游 API (MiniMax / Kimi / ...)
```

### 为什么不走代理

上游 MiniMax (`Access-Control-Allow-Origin`) 和 Kimi (`*`) 均已开启 CORS，浏览器可以直接跨域调用。**省掉后端 = 部署简单、运维简单、攻击面更小**。

如果以后厂商改了 CORS 策略，前端会挂；届时再加一个轻量代理即可。

### 数据流

1. 用户在 `ApiKeyBar` 输入 Key → `store.setApiKey`
2. `fetchPlan()` → 浏览器直接 fetch 厂商 API,带 `Authorization: Bearer <Key>` 头
3. 上游返回 JSON → 前端 `bestPlan()` 按 `source.provider` 派发到 `normalize` / `normalizeKimi` / ...
4. `ModelGrid` 渲染归一化后的 `NormalizedPlan`

### 前端状态

- `provider` 当前选中的 provider
- `apiKeys: Record<ProviderId, string>` 每个 provider 各自的 Key,只存 `localStorage`
- `data` 原始响应(给 RawResponse 面板用)
- `plan` 归一化后的数据(给 ModelGrid 用)

## 隐私

- **API Key** 只存在浏览器 `localStorage` (`zustand/persist`)，**不会发到任何第三方**
- **响应数据** 同上,纯本地内存,刷新即丢
- 任何 fetch 失败 / 网络错误也只显示在 UI,不落盘

## 目录结构

```
src/                前端(Vite + React)
├── components/     UI 组件
├── lib/            parse / format / utils / providers
├── pages/          路由页面(目前只有 Home)
├── store/          zustand 全局状态
├── types/          TypeScript 类型
└── main.tsx        启动入口

public/             静态资源
index.html          HTML 入口
vite.config.ts      Vite 配置(无 proxy,纯前端)
vercel.json         Vercel 静态托管路由配置
```