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

## ☁️ 部署到 Cloudflare Pages (操作手册 + 原理)

> **这一节会讲什么**:为什么部署到 Cloudflare、整个流程每一步具体怎么操作(点哪里、填什么)、每一步背后的原理是什么。从零开始,跟着做就能跑起来。
>
> ⚠️ **关于 Kimi**:Cloudflare 方案**没能让 Kimi 真实查询可用**(Kimi 上游自身在 Cloudflare 后面,会拦截 CF Workers 的请求,详见 [KIMI-PROXY.md](KIMI-PROXY.md))。但**部署流程本身是完整且成功的**——MiniMax / DeepSeek / GLM 在 CF Pages 上都能正常用,Kimi 那栏会显示演示假数据。如果你未来想自己重新尝试 Kimi 代理,这一节的操作步骤同样适用。

### 为什么还要部署到 Cloudflare

GitHub Pages 是**纯静态托管**,只能放 HTML/CSS/JS 文件,不能跑任何后端代码。这对 MiniMax / DeepSeek / GLM 没问题(它们的 API 自带 CORS,浏览器能直连)。但只要你想做任何"服务端转发"的事(比如代理某个不支持 CORS 的接口),GH Pages 就做不了。

Cloudflare Pages 除了托管静态文件,还提供 **[Pages Functions](https://developers.cloudflare.com/pages/functions/)**——可以在边缘节点跑 JavaScript 函数(本质是 Cloudflare Workers)。这让前端 + 轻量后端成为可能。本项目用它来跑 Kimi 的代理函数 `functions/api/kimi-usages.ts`。

**双轨部署的好处**:GH Pages 那套完全不动(现状不变),CF Pages 作为新增的部署目标,两套独立、互不影响。

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Pages (deploy.yml, 原有, 不动)                       │
│  https://zengsheng-git.github.io/CodingPlan/                │
│  ✅ MiniMax / DeepSeek / GLM    ❌ Kimi (纯静态, 无代理)     │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (deploy-cloudflare.yml, 新增)             │
│  https://codingplan-9xg.pages.dev/                          │
│  ✅ MiniMax / DeepSeek / GLM    🟡 Kimi (演示假数据)        │
└─────────────────────────────────────────────────────────────┘
```

---

### 🔧 第 1 步:注册 Cloudflare 账号

1. 打开 https://dash.cloudflare.com/sign-up
2. 填邮箱 + 密码 → 注册
3. 收到确认邮件 → 点里面的链接验证
4. 注册流程会问要不要"添加一个域名",选 **Skip** 跳过(本项目用不到自有域名,Cloudflare 会送一个 `*.pages.dev` 子域名)

> 💡 **不用绑信用卡**。Pages 免费额度(每天 10 万次 Functions 请求)对个人项目绰绰有余。
>
> 📖 **原理**:Cloudflare 的免费额度为什么这么大方?因为它的核心业务是 CDN/安全防护,Pages/Workers 是"引流产品"——让你进入它的生态,未来可能买付费的域名、流量、安全套餐。所以白嫖 Pages 完全合理。

---

### 🔧 第 2 步:创建 Pages 项目(关键:名字必须叫 `codingplan`)

项目名是 CF 上这个项目的唯一标识,**必须和 workflow 里写的 `--project-name=codingplan` 完全一致**,否则部署时找不到目标。

**方式 A:命令行(推荐)**

在你电脑的项目目录里:

```cmd
cd /d F:\w\template\MinMaxTokenPlan
npx wrangler pages project create codingplan --production-branch=main
```

- `npx wrangler`:调用项目里已装的 wrangler CLI(在 `package.json` 的 devDependencies 里)
- `pages project create`:创建 Pages 项目的子命令
- `--production-branch=main`:把 `main` 分支标记为生产分支(影响部署环境标记)

执行后会弹出浏览器让你授权登录 Cloudflare。授权后回到终端,看到 `Successfully created` 就成功了。

**方式 B:网页手动创建**

1. 登录 https://dash.cloudflare.com
2. 左侧菜单点 **Workers & Pages**
3. 点 **Create application** → **Pages** 标签 → **Upload assets**(随便选一个,后续 CI 会覆盖)
4. 项目名填 **`codingplan`**(全小写,必须一致)
5. Production branch 填 `main`
6. 点 **Save and Deploy**

> 📖 **原理**:为什么项目名这么重要?因为 wrangler 部署时是 `wrangler pages deploy dist --project-name=codingplan`,CF 靠这个名字找到要部署到的项目。名字对不上,部署就会报 `project not found`。这也是为什么 workflow 第一次跑会失败——项目还没创建。

---

### 🔧 第 3 步:获取 Account ID

1. 登录 https://dash.cloudflare.com
2. 进入任意页面(比如点 Workers & Pages)
3. 看页面**右侧栏**,找到 **"Account ID"**(一串 32 位的字母数字,类似 `a1b2c3d4e5f6...`)
4. **复制**,先存到记事本

> 💡 **捷径**:登录后的浏览器地址栏 URL 通常长这样:
> `https://dash.cloudflare.com/<这一串就是 Account ID>`
> 比如 `https://dash.cloudflare.com/abc123def456...`,中间那段就是。

> 📖 **原理**:Account ID 是你 CF 账户的唯一标识。GitHub Actions 部署时,wrangler 需要知道"部署到哪个账户下"——一个 API Token 可能关联多个账户(比如个人账户 + 公司账户),Account ID 用来消歧义。

---

### 🔧 第 4 步:创建 API Token

API Token 是 wrangler 的"密码",用它代替账号密码做自动化部署。

1. 打开 https://dash.cloudflare.com/profile/api-tokens
2. 点 **Create Token**(创建令牌)
3. 找到 **"Edit Cloudflare Workers"** 模板 → 点右边的 **Use template**(使用模板)
   - 这个模板预设了 Pages/Workers 部署所需的全部权限,不用自己一条条勾
4. **Account Resources** 选 **Include → 你的账户**(默认就是)
5. 拉到最下面 → 点 **Continue to summary**(继续到摘要)
6. 确认无误 → 点 **Create Token**(创建令牌)
7. **⚠️ 关键**:页面会显示一串 token(`xxxx-xxxx-xxxx...`),**这是唯一一次显示机会**,关闭页面后再也看不到
8. **立刻复制**,存到记事本

> 📖 **原理**:为什么用 "Edit Cloudflare Workers" 模板?因为 Pages Functions 本质是 Workers,部署它需要 Workers 的编辑权限。这个模板预置了:
> - Account:Cloudflare Pages 编辑权限(部署静态资源)
> - Account:Workers Scripts 编辑权限(部署 Functions)
> - User:Memberships 读取权限(查账户列表)
>
> 如果以后想收紧权限,可以自定义 token,但模板是最省事的选择。
>
> ⚠️ **安全**:Token 等同于密码,**绝对不要**提交到代码仓库或截图发出去。下一步我们会把它存到 GitHub 的加密 Secret 里,只有 GitHub Actions 能读到。

---

### 🔧 第 5 步:在 GitHub 配置 2 个 Secret

GitHub Secrets 是加密存储的敏感变量,Actions 运行时能读取,但任何人都看不到明文(包括仓库 owner)。

1. 打开 https://github.com/zengsheng-git/CodingPlan/settings/secrets/actions
2. 点 **New repository secret**
3. **配第一个**:
   - **Name**:`CLOUDFLARE_ACCOUNT_ID`(完全照抄,大小写敏感)
   - **Secret**:粘贴第 3 步复制的 Account ID
   - 点 **Add secret**
4. **配第二个**(再点一次 New repository secret):
   - **Name**:`CLOUDFLARE_API_TOKEN`
   - **Secret**:粘贴第 4 步复制的 Token
   - 点 **Add secret**

完成后页面会列出两条 secret(只显示名字,值是隐藏的)。

> 📖 **原理**:workflow 文件里这样引用它们:
> ```yaml
> apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
> accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
> ```
> `${{ secrets.XXX }}` 是 GitHub Actions 的变量插值语法。运行时 GitHub 把密文解密注入,但日志里会自动打码(显示为 `***`),不会泄露。
>
> 这样代码仓库是公开的也没事——workflow 代码能看到,但真正的 token 值只在 GitHub 内部。

---

### 🚀 第 6 步:Push,观察自动部署

完成前 5 步后,push 任意代码到 `main`:

```cmd
git push origin main
```

立即打开这个页面看实时进度:
👉 https://github.com/zengsheng-git/CodingPlan/actions

你会看到**两个 workflow 并行跑**:

| Workflow | 目标 | 大约耗时 |
|---|---|---|
| `Deploy to GitHub Pages` | GH Pages | ~1.5 分钟 |
| `Deploy to Cloudflare Pages` | CF Pages | ~2 分钟 |

两个都变绿 ✅ 就是成功。如果 `Deploy to Cloudflare Pages` 报红 ❌,常见原因:

| 报错 | 原因 | 解决 |
|---|---|---|
| `project not found` | 第 2 步没做或项目名不对 | 确认项目名是 `codingplan` |
| `authentication failed` | Token 或 Account ID 配错 | 回第 3、4 步重新获取 |
| `wrangler not found` | 不应发生(workflow 自动装) | 把日志发出来看 |

---

### 📖 部署背后的原理(workflow 在干什么)

[`.github/workflows/deploy-cloudflare.yml`](.github/workflows/deploy-cloudflare.yml) 定义了部署流程。push 到 `main` 后,GitHub 在它的服务器上自动跑这 7 步:

```
GitHub 服务器 (Ubuntu runner, 用完即弃)
   │
   ├─ 1. checkout       从仓库拉代码
   ├─ 2. setup-node     装 Node 20 + npm 缓存
   ├─ 3. npm ci         按 lockfile 严格装依赖
   ├─ 4. npm run check  TypeScript 类型检查 (错了就停)
   ├─ 5. npm run build  构建产物到 dist/
   │                    ⚠️ 关键: 这一步传 VITE_BASE='/', 让 base 走根路径
   ├─ 6. cp 404.html    把 index.html 复制成 404.html (SPA 刷新兜底)
   │
   └─ 7. wrangler pages deploy dist --project-name=codingplan
        │  用 API Token 鉴权, 把 dist/ 上传给 Cloudflare
        ▼
   Cloudflare 收到产物 → 发布到 CDN
   静态资源 (index.html/assets/*) → Pages CDN
   Functions (functions/api/*)   → Workers 运行时
   几秒后 https://codingplan-9xg.pages.dev/ 生效
```

**几个关键设计**:

- **为什么用 `npm ci` 而不是 `npm install`**:`npm ci` 严格按 `package-lock.json` 装,保证每次构建产物一致;`npm install` 可能解析出不同版本,CI 不该用。
- **为什么类型检查在 build 前**:`npm run check` 比 `npm run build` 快得多,类型错了能早点 fail,不浪费 build 时间。这就是为什么 push 前最好本地先跑一下 `npm run check`。
- **`functions/` 目录怎么被识别的**:Cloudflare Pages 有个约定——仓库根目录如果有 `functions/` 文件夹,里面的文件会被自动当成 Functions 部署。`functions/api/kimi-usages.ts` 对应路由 `/api/kimi-usages`,不用任何注册配置。
- **为什么 `dist/` 里没有 `functions/`**:Functions 是从**仓库源码**的 `functions/` 目录编译部署的,不在 `dist/` 构建产物里。`dist/` 只放静态资源。

---

### 📖 为什么 `base` 要用环境变量驱动

这是整个方案里最巧妙(也是最容易踩坑)的点。

**问题**:同一个代码仓库要部署到两个目标,但它们的 URL 结构不同:

| 部署目标 | 访问 URL | 静态资源的正确前缀 |
|---|---|---|
| GitHub Pages | `zengsheng-git.github.io/CodingPlan/` | `/CodingPlan/` |
| Cloudflare Pages | `codingplan-9xg.pages.dev/` | `/` |

Vite 构建时,会把 `base` 配置硬编码进所有静态资源 URL。比如 `base: '/CodingPlan/'` 时,生成的 HTML 里是 `<script src="/CodingPlan/assets/index-xxx.js">`。如果 base 写死成一个值,另一个部署的静态资源就会 404。

**解法**:`vite.config.ts` 改成读环境变量:

```ts
base: process.env.VITE_BASE ?? '/CodingPlan/'
```

- 不传 `VITE_BASE` → 默认 `/CodingPlan/`(GH Pages 行为,现状不变)
- CF 的 workflow 构建时传 `VITE_BASE='/'` → 走根路径

这样**一份代码适配两个部署目标**,不用维护两份配置。`App.tsx` 里的 `basename={import.meta.env.BASE_URL}` 会自动跟随,无需手改。

---

### 📖 Pages Function 是怎么工作的(以 Kimi 代理为例)

[`functions/api/kimi-usages.ts`](functions/api/kimi-usages.ts) 是核心。理解它就理解了"边缘函数"的运作方式。

**约定优于配置**:文件路径 `functions/api/kimi-usages.ts` → 自动对应路由 `GET /api/kimi-usages`。`functions/` 是 CF Pages 的特殊目录,`api/` 子目录里的每个文件都是一个 API 端点。

**请求生命周期**:

```
浏览器访问 https://codingplan-9xg.pages.dev/api/kimi-usages
   │
   ▼
Cloudflare 边缘节点 (全球 300+ 个, 离用户最近的那个)
   │  检查: 这个路径是不是有对应的 Function?
   │  是 → 交给 Workers 运行时执行 kimi-usages.ts
   ▼
kimi-usages.ts 的 onRequestGet 函数被调用
   │  收到 request 对象
   │  - onRequestOptions: 处理 OPTIONS 预检 → 返回 CORS 头
   │  - onRequestGet:     处理 GET → (当前)返回演示假数据
   │  - onRequest:        兜底 → 拒绝其他方法
   ▼
Function 返回 Response 对象
   │  带上 CORS 头, 让浏览器能读取
   ▼
浏览器收到 JSON
```

**为什么响应要加 CORS 头**:虽然请求是"同源"的(都走 `codingplan-9xg.pages.dev`),但 Functions 习惯性补上 `Access-Control-Allow-Origin` 等头,以防未来跨域调用。`onRequestOptions` 处理预检是关键——这正是 Kimi 上游缺失、导致浏览器直连失败的东西。

> 📖 **原理:什么是"边缘计算"**
>
> 传统后端部署在单一机房(比如 AWS us-east),全球用户都要连到那里。Cloudflare 在全球 300+ 个城市有节点,Functions 部署后会在所有节点都有副本,用户访问时由**离他最近的节点**处理。所以你在国内访问,可能是香港/东京节点响应;美国用户访问,是美国节点响应。延迟低、可用性高。这就是"边缘计算"。

---

### 📁 相关文件速查

| 文件 | 作用 | 改动频率 |
|------|------|------|
| [`functions/api/kimi-usages.ts`](functions/api/kimi-usages.ts) | CF Pages Function,Kimi 代理核心(当前返回演示数据) | 想改代理逻辑时改这里 |
| [`public/_redirects`](public/_redirects) | SPA fallback + 放行 `/api/*` 给 Function | 基本不动 |
| [`.github/workflows/deploy-cloudflare.yml`](.github/workflows/deploy-cloudflare.yml) | CF 部署 workflow(push main 自动跑) | 换项目名时改这里 |
| [`vite.config.ts`](vite.config.ts) | `base` 读 `VITE_BASE` 环境变量 | 基本不动 |
| [`package.json`](package.json) | 含 `wrangler` 依赖 + `deploy:cf` 脚本 | 加依赖时改这里 |

---

### 🛠 手动本地部署(备用,不等 CI)

想本地直接推到 Cloudflare(调试用):

```cmd
:: Windows cmd
set VITE_BASE=/ && npm run build
npm run deploy:cf

:: 或 Git Bash / Mac / Linux
VITE_BASE='/' npm run build
npm run deploy:cf
```

`npm run deploy:cf` = `wrangler pages deploy dist --project-name=codingplan`。

> 首次会要求 `wrangler login` 授权(浏览器弹窗)。授权一次后,凭证缓存在 `~/.wrangler/config/default.toml`,后续不用再登。

---

### 🔍 验证部署成功

部署完成后,验证三件事:

```cmd
:: 1. 网站能打开
curl -s -o nul -w "HTTP %%http_code\n" https://codingplan-9xg.pages.dev/

:: 2. Function 能响应 (返回演示假数据)
curl -s https://codingplan-9xg.pages.dev/api/kimi-usages | findstr demo
:: 期望输出包含: "demo":true

:: 3. SPA 路由刷新不 404 (访问一个不存在的子路径, 应返回 HTML 而非 404)
curl -s -o nul -w "HTTP %%http_code\n" https://codingplan-9xg.pages.dev/any-deep-link
:: 期望: HTTP 200
```

也可以直接浏览器打开 https://codingplan-9xg.pages.dev/ ,选 provider、填 Key、查询。

---

### ⚠️ 已知限制与注意点

- **CF Pages 免费额度**:Functions 每天免费 10 万次请求,静态流量无限。个人项目用不完,超出需升级(~$5/月)。
- **两个域名 localStorage 不共享**:GH Pages 和 CF Pages 是不同域名,各存各的 API Key,切换域名要重新填 Key。
- **首次部署前必须先创建项目**:第 2 步不做的话,workflow 会报 `project not found` 失败(但不影响 GH Pages 那套)。
- **CDN 缓存延迟**:改了代码 push 后,可能需要等 1-2 分钟才看到最新版本。硬刷新(Ctrl+F5)可跳过本地缓存。
- **Kimi 真实查询不可用**:详见 [KIMI-PROXY.md](KIMI-PROXY.md)。当前 CF 上的 Kimi 是演示假数据。

---

## 📚 参考

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [actions/deploy-pages](https://github.com/actions/deploy-pages)
- [Vite 静态部署指南](https://vitejs.dev/guide/static-deploy.html#github-pages)
- [Cloudflare Pages Functions 文档](https://developers.cloudflare.com/pages/functions/)
- [wrangler pages deploy 命令](https://developers.cloudflare.com/pages/functions/wrangler-cli/)
