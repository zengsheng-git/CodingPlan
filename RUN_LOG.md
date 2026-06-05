# Token Observatory — 启动记录

> 记录这次是怎么把项目跑起来的,方便后续复现 / 排错。

## 1. 项目信息

- **项目名**:`trae-project`(包名见 `package.json`)
- **技术栈**:
  - 前端:Vite 6 + React 18 + TypeScript + TailwindCSS + Zustand
  - 后端:Express 4 + tsx(开发时由 nodemon 监听热重启)
  - 同时启动两个进程,通过 `concurrently` 并行
- **端口约定**:
  - 前端(Vite dev server):`http://localhost:5173`
  - 后端(Express 代理):`http://localhost:3001`
  - Vite 已配置代理:`/api/*` → `http://localhost:3001`,所以前端只连 5173 即可

## 2. 启动前的环境

| 工具 | 版本 |
|---|---|
| Node.js | v22.16.0 |
| npm     | 10.9.4 |
| OS      | Windows |

> 仓库里没有 `.env`、没有 Dockerfile,也没有 `engines` 字段限制 Node 版本。`nodemon.json` 里强制设了 `NODE_ENV=development`,不需要额外配置环境变量。

## 3. 启动步骤(从零到跑起来)

```powershell
# 1) 进入项目目录
cd c:\w\CodingPlan

# 2) 安装依赖(首次或拉了新依赖后都要执行)
npm install

# 3) 一键起前端 + 后端(开发模式,HMR + nodemon 热重启)
npm run dev
```

### 这次实际跑出来的日志

```
> trae-project@0.0.0 dev
> concurrently "npm run client:dev" "npm run server:dev"

[1] > trae-project@0.0.0 server:dev
[1] > nodemon

[0] > trae-project@0.0.0 client:dev
[0] > vite

[0]   VITE v6.4.3  ready in 1019 ms
[0]
[0]   ➜  Local:   http://localhost:5173/
[1] [nodemon] 3.1.14
[1] [nodemon] watching path(s): api\**\*
[1] [nodemon] watching extensions: ts,mts,js,json
[1] [nodemon] starting `tsx api/server.ts`
[1] Server ready on port 3001
```

### 健康检查

| 探测 | 命令 | 实际返回 |
|---|---|---|
| 前端首页 | `Invoke-WebRequest http://localhost:5173/` | `200` |
| 后端健康 | `Invoke-WebRequest http://localhost:3001/api/health` | `200` |

> 后端的 `app.ts` 注册了 `/api/health`(可对照代码确认),Express 直接返回 200 表示进程已就绪、路由可正常分发。

## 4. npm scripts 一览

| 命令 | 作用 |
|---|---|
| `npm run dev` | **首选**。`concurrently` 并行起 `client:dev` + `server:dev` |
| `npm run client:dev` | 只起前端 Vite(:5173) |
| `npm run server:dev` | 只起后端 nodemon + tsx(:3001) |
| `npm run build` | `tsc -b && vite build`,产物在 `dist/` |
| `npm run preview` | Vite 预览构建产物 |
| `npm run check` | `tsc --noEmit` 类型检查(0 错才算过) |
| `npm run lint` | ESLint |

## 5. 架构与数据流(摘录自 README,这里再贴一遍方便排错)

```
浏览器(:5173)
   │  fetch('/api/plan/remains', { provider, apiKey })
   ▼
Vite 代理(/api → :3001)
   ▼
Express 代理(api/routes/plan.ts)
   │  按 provider 查 registry,转发到对应上游
   ▼
上游 API(MiniMax / Kimi / ...)
```

- 上游不发 CORS 头,必须经 `:3001` 代理转发。
- API Key 由前端塞到 `Authorization: Bearer` 头,后端只做转发,15s 超时,不落盘。
- Key 只存浏览器 `localStorage`(zustand/persist),后端 `app.ts` 没有任何数据库连接。

## 6. 怎么验证"真的跑起来了"

1. 浏览器打开 `http://localhost:5173`,应看到 Token Observatory 的 Home 页面(Provider 切换条 + API Key 输入框 + 仪表盘)。
2. 选 provider(默认 `minimax`),填一个 Key,点"保存并查询"。
3. 正常情况下会展示归一化后的 `NormalizedPlan`(模型列表 + 剩余额度);失败时会在 UI 里展示后端透传的错误信息,不会写入磁盘。
4. 后端日志会持续打出代理行(由 `vite.config.ts` 的 `proxyReq/proxyRes` 钩子产生),形如:
   ```
   Sending Request to the Target: POST /api/plan/remains
   Received Response from the Target: <status> /api/plan/remains
   ```

## 7. 常见踩坑(以后再起时优先看这里)

1. **5173 / 3001 端口被占**
   - 改 `vite.config.ts` 里的 `server.port`、或后端 `api/server.ts` 里的监听端口,并同步修改 `vite.config.ts` 的 `proxy.target`。
2. **`npm install` 慢 / 失败**
   - 项目无私有源要求,直接用默认 npm registry 即可。本次实测 25s 装完 463 个包。
3. **后端看不到 `.env`**
   - 当前实现**不需要**任何 `.env`。`nodemon.json` 只注入了 `NODE_ENV=development`,上游的 Key 全部由前端在请求时透传。
4. **修改后端代码没生效**
   - `nodemon` 监听 `api/**/*.{ts,mts,js,json}`(见 `nodemon.json`)。前端改完 Vite 会 HMR 自动刷新,不需要手动重启。
5. **类型/语法错误想看完整信息**
   - `npm run check`(全量 tsc `--noEmit`)或 `npm run lint`。

## 8. 关闭服务

- 在跑 `npm run dev` 的终端按 `Ctrl + C`(`concurrently` 会把两个子进程一并结束)。
- 强制清理端口:
  ```powershell
  # 查占用
  netstat -ano | findstr ":5173"
  netstat -ano | findstr ":3001"
  # 杀进程(把 <PID> 换成上一步查到的 PID)
  taskkill /F /PID <PID>
  ```

## 9. 复现清单(给"明天的自己"看)

- [x] `node -v` → v22.16.0
- [x] `npm -v` → 10.9.4
- [x] `npm install` → 463 packages, 25s
- [x] `npm run dev` → Vite :5173 + Express :3001 均起
- [x] `curl /`(:5173)→ 200
- [x] `curl /api/health`(:3001)→ 200

> 启动时间:2026-06-05(本次会话)
