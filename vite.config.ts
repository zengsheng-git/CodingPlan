import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig({
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