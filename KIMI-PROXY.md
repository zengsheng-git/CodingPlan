# Kimi 生产环境代理:问题与方案记录

> 本文档记录了让 Kimi Coding Plan 在生产环境可用的完整探索过程。
> **当前状态:🟡 未解决**(Kimi 在生产环境返回演示假数据,真实查询待换平台)。

---

## TL;DR

| 部署 | 域名 | Kimi 状态 |
|---|---|---|
| GitHub Pages | `zengsheng-git.github.io/CodingPlan/` | ❌ 无后端代理,完全不可用 |
| Cloudflare Pages | `codingplan-9xg.pages.dev` | 🟡 **演示假数据**(真实查询被 Kimi 自己的 Cloudflare 拦截) |
| 本地 dev (`npm run dev`) | `localhost:5173` 等 | ✅ 可用(走 Vite dev proxy) |

**根因**:Kimi 上游 (`api.kimi.com`) 自身部署在 Cloudflare 后面,而 Cloudflare 会拦截来自自家 Workers 数据中心 IP 的请求。这是"Cloudflare 拦 Cloudflare"的架构性死结,**与代码无关**。

**恢复路径**:把 Kimi 代理函数搬到出口 IP 不被 Kimi 封的平台(Vercel / Netlify / 自建 VPS),代码逻辑基本照搬即可。详见文末[未来方案](#-未来可选方案)。

---

## 一、背景:为什么 Kimi 需要代理

### 问题现象

Token Observatory 是纯前端 SPA,通过浏览器直接 `fetch` 各家厂商 API 查询余量。MiniMax / DeepSeek / GLM 的接口都返回正确的 CORS 头,浏览器能直连。**唯独 Kimi 不行**。

### 根本原因:CORS 预检失败

浏览器在发送带 `Authorization` 头的请求前(这属于"非简单请求"),会先发一个 `OPTIONS` 预检请求,问服务器:"我能不能带这些头访问你?"

```
浏览器
   │  想发: GET https://api.kimi.com/coding/v1/usages
   │        Headers: { Authorization: "Bearer sk-kimi-..." }
   │
   │  这是"非简单请求", 先发 OPTIONS 预检
   ▼
OPTIONS https://api.kimi.com/coding/v1/usages
   │
   ▼
Kimi 服务器: 返回 404, 且不带 Access-Control-Allow-Origin 头 ❌
   │
   ▼
浏览器: "对方没明确允许, 我拒绝发送真正的请求"
   │
   ▼
查询失败 ❌
```

**关键**:这是**浏览器的安全机制**,只挡浏览器,不挡服务器。所以加一个"服务端代理"就能绕过——服务端转发请求不受 CORS 限制。

### dev 期已有的解决方案:Vite proxy

本地开发时,`vite.config.ts` 里配了 dev proxy:

```ts
server: {
  proxy: {
    '/api/kimi-usages': {
      target: 'https://api.kimi.com',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/api\/kimi-usages/, '/coding/v1/usages'),
    },
  },
}
```

dev 期,浏览器发 `fetch('/api/kimi-usages')`(同源相对路径,不触发预检),Vite dev server 在**服务端**转发到 Kimi 上游,绕开浏览器 CORS。这就是本地 `localhost` 能用、生产部署后失效的原因——**生产环境没有 Vite dev server**。

---

## 二、尝试过的方案

### 方案 1:Cloudflare Pages Functions(❌ 失败 - 当前在用,但只返回假数据)

**思路**:用 Cloudflare Pages 的 [Pages Functions](https://developers.cloudflare.com/pages/functions/) 跑一个轻量代理函数,接管 `/api/kimi-usages` 路径,转发到 Kimi 上游。原理与 Vite proxy 一致,只是运行环境从本地换到 CF。

**实现**:见 [`functions/api/kimi-usages.ts`](functions/api/kimi-usages.ts)。代码逻辑完全正确:

1. `onRequestOptions` — 处理浏览器 OPTIONS 预检,直接返回 CORS 头放行
2. `onRequestGet` — 转发 GET 到 `https://api.kimi.com/coding/v1/usages`,透传 `Authorization` 头
3. 给响应补上 CORS 头,让浏览器能读取
4. 错误兜底(401/502/504)

**部署**:`.github/workflows/deploy-cloudflare.yml` 用 wrangler 自动部署。部署本身成功,Function 能响应。

**结果**:❌ **被拦截**。CF Function 转发请求时,Kimi 返回的是 Cloudflare 的拦截页:

```html
<title>Attention Required! | Cloudflare</title>
...
This website is using a security service to protect itself from online attacks.
Cloudflare Ray ID: a173b28a5a3d44af
Your IP: 2a06:98c0:3600::103   ← Cloudflare Workers 数据中心出口 IP
```

**失败原因**:**Kimi 自身部署在 Cloudflare 后面,而 Cloudflare 的 Bot Management 会拦截来自自家 Workers 数据中心 IP 段的请求**。这是"CF 拦 CF"的死结,无论代码怎么写都绕不过去(详见下一节原理)。

### 方案 1.5:浏览器 header 伪装(❌ 失败)

在方案 1 基础上,尝试补全浏览器请求头(`User-Agent`、`Sec-Ch-Ua`、`Sec-Fetch-*`、`Referer`、`Origin` 等),让请求看起来像真浏览器发出的。

**结果**:❌ 仍被拦截。因为 Kimi 的拦截是**按 IP 段**判断的,不是按 header 判断。CF Workers 的出口 IP 段 (`2a06:98c0::/32` 等) 在黑名单里,无论 header 怎么伪装都没用。

**实测证据**:

| 测试 | 结果 |
|---|---|
| 本地 IP + 假 Key 直连 Kimi | ✅ 正常 JSON 401(`token invalid`) |
| 本地 IP + 真 Key 直连 Kimi | ✅ 正常 JSON 200(拿到完整用量) |
| CF Function + 任意 Key 转发 | ❌ 被 Cloudflare 拦截页 |

这组对比证明:**Key 和接口都没问题,唯一的问题是 CF Workers 的出口 IP 被封**。

### 当前临时方案:返回演示假数据(🟡 在用)

既然真实查询跑不通,改成返回一份结构上与 Kimi 真实响应一致的假数据,让前端 `ModelGrid` 能正常渲染(而不是空白/报错),便于演示和 UI 开发。

**实现**:[`functions/api/kimi-usages.ts`](functions/api/kimi-usages.ts) 的 `buildDemoResponse()` 返回:

```jsonc
{
  "demo": true,                                    // 标记, 前端据此显示"演示数据"标识
  "user": { "membership": { "level": "LEVEL_INTERMEDIATE" } },
  "usage": { "limit": "100", "used": "27", "remaining": "73", "resetTime": "..." },
  "limits": [{ "window": { "duration": 300, "timeUnit": "TIME_UNIT_MINUTE" }, "detail": {...} }]
}
```

前端识别 `demo: true` 后,在卡片上方显示琥珀色"演示数据"横幅(`src/components/ModelGrid.tsx` 的 `DemoBanner`),明确告知用户这是占位数据。

---

## 三、原理:为什么"Cloudflare 拦 Cloudflare"

### Cloudflare 的双层角色

```
┌─────────────────────────────────────────────────────────┐
│  你的 Token Observatory 部署在 Cloudflare Pages         │
│  CF Pages Function 跑在 Cloudflare Workers 运行时       │
│  出口 IP: Cloudflare 数据中心 IP (如 2a06:98c0::/32)   │
└─────────────────────────────────────────────────────────┘
                          │
                          │  fetch 转发
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Kimi (api.kimi.com) 也部署在 Cloudflare 后面           │
│  Kimi 的 Cloudflare 开启了 Bot Management                │
│  规则: 拦截来自数据中心 IP 段的请求(防爬虫/防滥用)    │
└─────────────────────────────────────────────────────────┘
                          │
                          │  Kimi 的 CF 看到 CF 的 IP
                          ▼
                    拦截 ❌
```

### 为什么会这样

Cloudflare 的 Bot Management(机器人管理)会识别"不像真人浏览器"的请求并拦截。数据中心 IP 段(IPv4 的 AWS/GCP/Azure、IPv6 的 `2a06:98c0::/32` 等 CF 自家段)是重点怀疑对象,因为:

- 真人浏览器一般用**住宅 IP**(运营商分配的家宽)
- 数据中心 IP 通常意味着**服务器/脚本/爬虫**

讽刺的是:**Cloudflare Workers 自己的出口 IP 也在数据中心段**,所以当 CF Worker 访问一个受 CF Bot Management 保护的源站时,会被自家的规则拦截。这是 Cloudflare 生态里一个已知且无解的矛盾。

### 为什么 MiniMax / DeepSeek / GLM 不受影响

它们要么:
- 没用 Cloudflare 保护(MiniMax),或
- 没开 Bot Management,直接返回正确的 CORS 头(DeepSeek)

所以这些 provider 的接口在浏览器端能直连成功,根本不需要代理。

---

## 四、相关文件说明

| 文件 | 角色 |
|---|---|
| [`functions/api/kimi-usages.ts`](functions/api/kimi-usages.ts) | CF Pages Function。当前返回演示假数据,待恢复真实查询时改回转发逻辑 |
| [`vite.config.ts`](vite.config.ts) | dev proxy 配置(本地开发用,生产不生效)。`base` 由 `VITE_BASE` 环境变量驱动 |
| [`.github/workflows/deploy-cloudflare.yml`](.github/workflows/deploy-cloudflare.yml) | CF Pages 自动部署 workflow(push main 触发) |
| [`public/_redirects`](public/_redirects) | CF Pages SPA fallback + 放行 `/api/*` 给 Function |
| `src/lib/providers.ts` | Kimi 的 `host: ''`、`path: '/api/kimi-usages'` 配置(前端走相对路径,dev/prod 都不用改) |
| `src/lib/parse.ts` | `normalizeKimi` 解析 Kimi 响应,透传 `demo` 标记 |
| `src/components/ModelGrid.tsx` | `DemoBanner` 组件,`plan.demo` 为真时显示"演示数据"横幅 |
| `src/types/plan.ts` | `NormalizedPlan.demo?: boolean` 字段 |

---

## 五、完整操作历史(按时间线)

为了让后来者(包括未来的自己)理解每个改动的来龙去脉,按 commit 时间线梳理:

| Commit | 改动 | 结果 |
|---|---|---|
| `edff68a` | 新增 CF Pages 双轨部署(Functions + workflow + `_redirects` + `VITE_BASE`) | ✅ 部署成功,但 Kimi 被拦 |
| `130b296` | 修复:同步 `package-lock.json`(上次漏了导致 `npm ci` 失败) | ✅ CI 跑通 |
| `88edd81` | 尝试:补全浏览器请求头(User-Agent 等)绕过 Bot Management | ❌ 仍被拦(IP 段封锁) |
| `7a45218` | 改为返回演示假数据,带 `demo: true` 标记 | 🟡 假数据生效 |
| `4736b13` | UI 加"演示数据"琥珀色横幅 | ✅ 用户可识别假数据 |

---

## 六、🚀 未来可选方案

当决定恢复 Kimi 真实查询时,从以下方案选一个。核心原则:**代理函数的出口 IP 不能在 Kimi 的黑名单**。

### 方案 A:换 Vercel(推荐,免费)

Vercel 的 serverless functions 跑在 AWS 上,出口 IP 不在 CF 黑名单。

**改动**:
1. 把 `functions/api/kimi-usages.ts` 改写成 `api/kimi-usages.ts`(Vercel 的约定目录,文件格式几乎一样)
2. 删除 CF 那套(`functions/`、`deploy-cloudflare.yml`、`_redirects` 里的 `/api/*` 规则)
3. 加 Vercel 部署 workflow 或直接连 GitHub 仓库
4. `vite.config.ts` 的 `base` 在 Vercel 构建时传 `VITE_BASE='/'`

**风险**:Vercel 的 IP 是否被 Kimi 封,需实测(理论上不会,因为 Vercel 用 AWS us-east 等 IP,不在 CF Bot Management 的数据中心黑名单里)。

**免费额度**:Hobby 计划每天 100GB 流量 + 无限 serverless 调用,个人用足够。

### 方案 B:自建 VPS 反向代理(最可靠)

自己租一台 VPS(Vultr / 搬瓦工 / 腾讯云轻量,~$3-5/月),跑 Nginx/Caddy 反代 Kimi。独立 IP 几乎不可能被封。

**Nginx 配置示例**:

```nginx
server {
    listen 443 ssl;
    server_name kimi-proxy.yourdomain.com;

    # CORS: 允许你的前端域名访问
    add_header 'Access-Control-Allow-Origin' 'https://codingplan-9xg.pages.dev' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'authorization, content-type, accept' always;

    if ($request_method = 'OPTIONS') {
        return 204;
    }

    location /api/kimi-usages {
        proxy_pass https://api.kimi.com/coding/v1/usages;
        proxy_set_header Host api.kimi.com;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Content-Type application/json;
    }
}
```

**缺点**:要花钱、要维护(续费、SSL、安全)。

### 方案 C:放弃 Kimi 生产可用

直接删除 CF 那套代理代码,Kimi 只在本地 dev 可用。项目只保留 MiniMax / DeepSeek / GLM 三个生产可用的 provider。最简单。

---

## 七、验证清单

改动后用以下命令验证(在项目根目录):

```bash
# 1. 类型检查
npm run check

# 2. 本地构建
npm run build

# 3. 验证 CF Function 返回的是假数据
curl -s https://codingplan-9xg.pages.dev/api/kimi-usages | grep demo
# 期望输出包含: "demo":true

# 4. 本地 IP 直连 Kimi 验证 Key 有效性(用你的真 Key)
curl -s https://api.kimi.com/coding/v1/usages \
  -H "Authorization: Bearer sk-kimi-你的Key"
# 期望: HTTP 200 + JSON 用量数据
```

---

## 八、参考

- [Cloudflare Pages Functions 文档](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare Bot Management](https://developers.cloudflare.com/bots/)
- [MDN: CORS 详解](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CORS)
- [Vite server.proxy 配置](https://vitejs.dev/config/server-options.html#server-proxy)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
