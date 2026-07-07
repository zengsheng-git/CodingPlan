# 部署到 GitHub Pages

本项目使用 **GitHub Actions** 自动构建并部署到 GitHub Pages。
代码 push 到 `main` 分支即触发,无需手动发布。

> 📍 部署 URL: `https://<your-github-username>.github.io/CodingPlan/`

## 📋 一次性配置

GitHub repo 端只需要配一次:

1. 进入 https://github.com/zengsheng-git/CodingPlan/settings/pages
2. **Source** 选 **"GitHub Actions"** (不要选 "Deploy from a branch")
3. 保存即可。后续所有部署都自动通过 workflow 完成。

## 🚀 部署流程

每次 `git push origin main` 触发以下流程:

```
代码 push
   │
   ▼
┌─────────────────────────────────────────────────────┐
│  Job 1: build (在 GitHub 提供的 Ubuntu runner 上)  │
├─────────────────────────────────────────────────────┤
│  1. checkout          拉取仓库代码                    │
│  2. setup-node        安装 Node.js 20 + npm 缓存      │
│  3. npm ci            干净安装依赖 (锁定 lockfile)     │
│  4. npm run check     TypeScript 类型检查 (0 错才算过) │
│  5. npm run build     tsc 编译 + Vite 打包到 dist/    │
│  6. cp dist/index.html dist/404.html  SPA fallback   │
│  7. configure-pages   准备 Pages 部署上下文            │
│  8. upload-artifact   把 dist/ 上传为部署产物          │
└─────────────────────────────────────────────────────┘
   │
   ▼  (build 成功才往下走)
┌─────────────────────────────────────────────────────┐
│  Job 2: deploy (在独立 runner 上)                    │
├─────────────────────────────────────────────────────┤
│  9. deploy-pages      把产物发布到 GitHub Pages      │
│                       返回 page_url, 写入 environment│
└─────────────────────────────────────────────────────┘
   │
   ▼
https://zengsheng-git.github.io/CodingPlan/  (约 1-2 分钟内生效)
```

## 🔍 查看部署状态

- 实时日志: https://github.com/zengsheng-git/CodingPlan/actions
- 环境记录: https://github.com/zengsheng-git/CodingPlan/deployments
- 部署历史: repo → Environments → `github-pages`

## 📁 相关文件

| 文件 | 作用 |
|------|------|
| [.github/workflows/deploy.yml](.github/workflows/deploy.yml) | 🐙 GitHub Actions workflow 定义 |
| [vite.config.ts](vite.config.ts) | Vite 配置,`base: '/CodingPlan/'` 必须和仓库名一致 |
| [vercel.json](vercel.json) | Vercel 部署时的 SPA fallback (本项目用 GitHub Pages 时不需要) |
| [src/App.tsx](src/App.tsx) | `<Router basename={import.meta.env.BASE_URL}>` 自动和 vite base 同步 |

## 📝 yml 逐行解释

```yaml
name: Deploy to GitHub Pages
```
**workflow 显示名**。在 GitHub Actions 页面看到的标题。

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```
**触发条件**:
- `push.branches: [main]` — 任何代码 push 到 main 分支时自动触发
- `workflow_dispatch` — 允许在 GitHub Actions 页面手动点 "Run workflow" 按钮触发

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```
**权限声明** (最小权限原则):
- `contents: read` — 允许 checkout 代码
- `pages: write` — 允许 deploy 到 GitHub Pages
- `id-token: write` — OIDC token, deploy-pages action 需要

> ⚠️ 这三个权限是官方 `actions/deploy-pages` 要求的,缺一不可。

```yaml
concurrency:
  group: pages
  cancel-in-progress: false
```
**并发控制**:
- `group: pages` — 所有 pages 相关的 workflow run 共用一个并发组
- `cancel-in-progress: false` — 新 push 进来时,正在跑的部署**不会被打断**,排队等前面跑完
  (避免半发布的中间态)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
```
**build job**:
- `runs-on: ubuntu-latest` — 使用 GitHub 最新的 Ubuntu runner (免费额度内)

```yaml
    steps:
      - name: Checkout
        uses: actions/checkout@v4
```
**step 1: 拉代码**。`actions/checkout@v4` 是 GitHub 官方 action,克隆仓库到 runner。

```yaml
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
```
**step 2: 装 Node**。
- `node-version: '20'` — Node.js 20 LTS
- `cache: 'npm'` — 缓存 `~/.npm` 目录,加速后续 `npm ci`

```yaml
      - name: Install dependencies
        run: npm ci
```
**step 3: 装依赖**。
- `npm ci` 严格按 `package-lock.json` 装(比 `npm install` 更适合 CI,可重复构建)

```yaml
      - name: Type check
        run: npm run check
```
**step 4: 类型检查**。`tsc --noEmit` 0 错才算过,**类型错就提前 fail,不浪费 build 时间**。

```yaml
      - name: Build
        run: npm run build
```
**step 5: 打包**。
- `tsc -b` 编译 TypeScript
- `vite build` 打包到 `dist/` 目录
- 产物: `dist/index.html` + `dist/assets/*.js` + `dist/assets/*.css`

```yaml
      - name: SPA fallback (404.html)
        run: cp dist/index.html dist/404.html
```
**step 6: SPA fallback**。
- 把 `index.html` 复制一份为 `404.html`
- GitHub Pages 在找不到资源时会返回 `404.html`,但内容是 React app
- React Router 接管路由,实现 SPA 体验
- (否则用户刷新 `/CodingPlan/some-page` 会看到 GitHub 自带 404 页面)

```yaml
      - name: Setup Pages
        uses: actions/configure-pages@v5
```
**step 7: 准备 Pages 上下文**。这个 action 会在 runner 上设置 `github-pages` 环境变量,后面 deploy 步骤要用。

```yaml
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
```
**step 8: 上传产物**。
- 把整个 `dist/` 目录打包成 artifact 上传
- 产物在 GitHub 内部存储,**不会**走外网传输给下一步

```yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
```
**deploy job**:
- `needs: build` — 必须等 build job 成功完成才跑
- 单独一个 job,这样并发控制粒度更细

```yaml
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
```
**部署环境**。
- `name: github-pages` — 绑定到 GitHub 的 `github-pages` environment
- `url: ...` — 部署完成后,这个 environment 卡片会显示最终 URL

```yaml
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
**step 9: 部署**。
- `id: deployment` — 给这个 step 起 id,前面 `${{ steps.deployment.outputs.page_url }}` 才能引用
- `actions/deploy-pages@v4` 是官方 action,会拿到前一步的 artifact,推送到 GitHub Pages CDN

## ⚠️ 注意事项

### 1. Kimi 在生产环境失效
Kimi 走 Vite dev proxy(仅 dev 模式),生产部署到 GitHub Pages 后切到 Kimi 会报错。
**MiniMax 不受影响,继续可用**。如要让 Kimi 在生产也能用,需要部署到支持 serverless functions 的平台(Vercel/Netlify/Cloudflare Workers),写个轻量代理。

### 2. `vite.config.ts` 的 `base` 必须和仓库名一致
本项目是 `CodingPlan`,所以 `base: '/CodingPlan/'`。如果以后改了仓库名,记得同步改这里。

### 3. localStorage 按域名隔离
GitHub Pages 部署后是 `zengsheng-git.github.io` 域名,localStorage 不会和 `localhost:5173` 共享。
第一次访问需要重新填 API Key。

### 4. 部署后等 1-2 分钟
GitHub Pages CDN 缓存刷新有延迟。改了代码后 push,可能需要等一两分钟才能看到最新版本。

## 🛠️ 手动触发部署

不想 push 代码,只想重跑一次部署?在 https://github.com/zengsheng-git/CodingPlan/actions/workflows/deploy.yml 点 **"Run workflow"** 按钮即可。

## 🔄 回滚到上一个版本

GitHub Pages 不直接支持回滚,但 workflow 跑过的产物会在 Actions 里保留一段时间。可以:

1. 去 https://github.com/zengsheng-git/CodingPlan/actions
2. 找到上一次成功的 build run
3. 下载那个 run 的 artifact(`dist/`)
4. 手动 push 到 `gh-pages` 分支(临时方案)
5. 或者 git revert + push 自动重新部署

## ☁️ 部署到 Cloudflare Pages (让 Kimi 生产可用)

GitHub Pages 是纯静态托管, 无法提供后端代理。而 Kimi 的 `/coding/v1/usages` 接口在 OPTIONS 预检时不发 CORS 头, 浏览器无法绕过 preflight, 所以 Kimi 只能 dev 期靠 Vite proxy 用, 生产环境失效。

**解决方案**: 同一个仓库再部署一份到 Cloudflare Pages, 用 [Pages Functions](https://developers.cloudflare.com/pages/functions/) 跑一个轻量代理函数, 接管 `/api/kimi-usages` 路径转发到 Kimi 上游。

### 双轨架构

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Pages (deploy.yml, 现有, 不动)                       │
│  https://zengsheng-git.github.io/CodingPlan/                │
│  ✅ MiniMax / DeepSeek / GLM (厂商 CORS OK, 纯前端直连)     │
│  ❌ Kimi (无后端代理, 失效)                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (deploy-cloudflare.yml, 新增)             │
│  https://codingplan.pages.dev/                              │
│  ✅ MiniMax / DeepSeek / GLM (同上)                         │
│  ✅ Kimi (functions/api/kimi-usages.ts 代理, 生产可用)      │
└─────────────────────────────────────────────────────────────┘
```

两个部署各管各的, 互不干扰。想要 Kimi 就访问 Cloudflare Pages 那个域名。

### 一次性配置 (3 步)

#### 1. 在 Cloudflare 创建 Pages 项目

```bash
# 本地装好依赖后, 用 wrangler 创建项目 (project name 固定 codingplan)
npx wrangler pages project create codingplan
```

> 也可以登录 https://dash.cloudflare.com → Workers & Pages → Create → Pages → 手动建。
> 项目名**必须叫 `codingplan`**, 和 [.github/workflows/deploy-cloudflare.yml](.github/workflows/deploy-cloudflare.yml) 里的 `--project-name=codingplan` 一致。

#### 2. 拿到两个凭证

| 凭证 | 在哪拿 | 用途 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | [CF 控制台](https://dash.cloudflare.com/profile/api-tokens) → Create Token → 用 **"Edit Cloudflare Workers"** 模板 | wrangler 鉴权 |
| `CLOUDFLARE_ACCOUNT_ID` | CF 控制台任意域名右侧栏, 或 Workers 概览页 | 标识账户 |

#### 3. 配到 GitHub repo 的 Secrets

进入 https://github.com/zengsheng-git/CodingPlan/settings/secrets/actions → New repository secret, 添加两条:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 部署流程

配置完成后, 每次 `git push origin main` 会**同时触发两个 workflow**:

| Workflow | 目标 | base | Kimi |
|---|---|---|---|
| `deploy.yml` | GitHub Pages | `/CodingPlan/` (默认) | ❌ |
| `deploy-cloudflare.yml` | Cloudflare Pages | `/` (传 `VITE_BASE='/'`) | ✅ |

查看 CF 部署日志: https://github.com/zengsheng-git/CodingPlan/actions (找 "Deploy to Cloudflare Pages")
查看 CF 部署历史: https://dash.cloudflare.com → Workers & Pages → codingplan

### 关键文件

| 文件 | 作用 |
|------|------|
| [functions/api/kimi-usages.ts](functions/api/kimi-usages.ts) | 🌀 CF Pages Function, Kimi 代理核心 |
| [public/_redirects](public/_redirects) | SPA fallback + 放行 `/api/*` 给 Function |
| [.github/workflows/deploy-cloudflare.yml](.github/workflows/deploy-cloudflare.yml) | 🐙 CF 部署 workflow |
| [vite.config.ts](vite.config.ts) | `base` 读 `VITE_BASE`, 默认 `/CodingPlan/` |

### 为什么 `base` 要用环境变量驱动

一个仓库两个部署目标, base 不同:
- GH Pages 是子路径 → 需要 `/CodingPlan/`
- CF Pages 是根路径 → 需要 `/`

`vite.config.ts` 里 `base: process.env.VITE_BASE ?? '/CodingPlan/'`, 不传时走 GH Pages 默认, CF 的 workflow 构建时传 `VITE_BASE='/'`。

### 手动本地部署 (备用)

不想等 CI, 想本地直接推到 Cloudflare:

```bash
VITE_BASE='/' npm run build
npm run deploy:cf   # = wrangler pages deploy dist --project-name=codingplan
```

> 首次会要求 `wrangler login` 授权。

### 已知限制

- **CF Pages 免费额度**: Functions 每天免费 10 万次请求, 个人用量绰绰有余。超出需升级。
- **首次部署会因 project 不存在而失败**: 必须先完成"一次性配置"第 1 步 (创建 `codingplan` project)。
- **两个域名 localStorage 不共享**: GH Pages 和 CF Pages 各存各的 API Key, 切换域名要重新填。

---

## 📚 参考

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [actions/deploy-pages](https://github.com/actions/deploy-pages)
- [Vite 静态部署指南](https://vitejs.dev/guide/static-deploy.html#github-pages)
- [Cloudflare Pages Functions 文档](https://developers.cloudflare.com/pages/functions/)
- [wrangler pages deploy 命令](https://developers.cloudflare.com/pages/functions/wrangler-cli/)
