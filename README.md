# Token Observatory

本地单页仪表盘,实时查看 Coding Plan 余量。**不持久化任何数据,不上传任何 Key。**

## 支持的 Provider

| Provider | 平台 | Key 格式 | 余量 API |
|---|---|---|---|
| `minimax` | MiniMax | `eyJ...` / `sk-cp-...` | `/v1/api/openplatform/coding_plan/remains` |
| `kimi`    | Kimi Code | `sk-kimi-...` | `/coding/v1/usages` |

> Kimi Code 与 Moonshot 开放平台是两套独立服务,凭证不互通。

## 快速开始

```bash
npm install
npm run dev      # 同时启动前端 (Vite :5173) 和后端 (Express :3001)
```

浏览器打开 `http://localhost:5173`,选 provider、填 Key、点保存并查询。

### 其他命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发模式(HMR + nodemon) |
| `npm run build` | 编译到 `dist/` |
| `npm run check` | TypeScript 类型检查(0 错才算过) |
| `npm run lint` | ESLint |

## 添加新 Provider

只需改两个文件:

### 1. 后端 [api/providers/registry.ts](api/providers/registry.ts)

```ts
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  // ... 已有 ...
  yournew: {
    id: 'yournew',
    name: 'YourNew',
    host: 'https://api.yournew.com',
    path: '/v1/quota/remain',
    confirmed: true,
  },
}
```

### 2. 前端 [src/lib/parse.ts](src/lib/parse.ts) — 实现 parser

每个 provider 响应结构不同(参考现有的 `normalize` 给 MiniMax 的、`normalizeKimi` 给 Kimi 的),把上游响应映射成 `NormalizedPlan`:

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

然后在 [src/types/plan.ts](src/types/plan.ts) 的 `ProviderId` 联合类型加一项,`bestPlan()` 里 dispatch 一下。

## 架构

```
浏览器(5173)
   │  fetch('/api/plan/remains', { provider, apiKey })
   ▼
Vite 代理(/api → 3001)
   │
   ▼
Express 代理(api/routes/plan.ts)
   │  按 provider 查 registry,转发到对应上游
   ▼
上游 API(MiniMax / Kimi / ...)
```

### 为什么需要代理

上游不发 CORS 头,浏览器跨域直接请求会被拦。代理顺手把 Key 放 `Authorization: Bearer` 头里,加上 15s 超时,后端不做任何持久化。

### 数据流

1. 用户在 `ApiKeyBar` 输入 Key → store.setApiKey
2. `fetchPlan()` → `POST /api/plan/remains` 带 `{ provider, apiKey }`
3. 后端从 registry 拿到 host/path,fetch 上游,原样回 JSON
4. 前端 `bestPlan()` 按 `source.provider` 派发到 `normalize` / `normalizeKimi` / ...
5. `ModelGrid` 渲染归一化后的 `NormalizedPlan`

### 前端状态

- `provider` 当前选中的 provider
- `apiKeys: Record<ProviderId, string>` 每个 provider 各自的 Key,只存 localStorage
- `data` 原始响应(给 RawResponse 面板用)
- `plan` 归一化后的数据(给 ModelGrid 用)

## 隐私

- **API Key** 只存在浏览器 `localStorage`(`zustand/persist`),**后端不写盘、不记日志**
- **响应数据** 同上,后端只做转发
- 任何 fetch 失败 / 网络错误也只显示在 UI,不落盘
- 后端 `app.ts` 没有任何数据库连接

## 目录结构

```
api/                后端(Express + tsx)
├── providers/      provider 注册表(单数据源)
├── routes/         HTTP 路由
├── app.ts          Express app 配置
└── server.ts       启动入口

src/                前端(Vite + React)
├── components/     UI 组件
├── lib/            parse / format / utils
├── pages/          路由页面(目前只有 Home)
├── store/          zustand 全局状态
├── types/          TypeScript 类型
└── main.tsx        启动入口
```
