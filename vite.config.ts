import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig({
// base 由环境变量 VITE_BASE 驱动,解决"一个仓库两个部署目标"的冲突:
//   - GitHub Pages (默认, 不传 VITE_BASE): 子路径 '/CodingPlan/'
//   - Cloudflare Pages (CI 传 VITE_BASE='/'): 根路径 '/'
// 本地 dev 不传 VITE_BASE, 走默认 '/CodingPlan/', 与现有行为一致。
base: process.env.VITE_BASE ?? '/CodingPlan/',
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }),
    tsconfigPaths(),
  ],
  server: {
    // 仅开发模式的代理：Kimi 的 OPTIONS 预检不发 CORS 头,
    // 浏览器无法绕过 preflight,所以 dev 期走本地代理转发。
    // 生产环境部署到静态托管时 Kimi 会失效(见 README)。
    proxy: {
      '/api/kimi-usages': {
        target: 'https://api.kimi.com',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api\/kimi-usages/, '/coding/v1/usages'),
      },
    },
  },
})