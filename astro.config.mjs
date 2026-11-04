import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import 'dotenv/config';

// .env 里的运行参数在构建/启动时就要用（server.port、dev 代理），
// 所以这里也读一份；字段与 src/config/env.ts 对齐，改的时候两边一起改。
const port = Number(process.env.PORT) || 4321;
const metingTarget = (process.env.METING_TARGET || 'http://127.0.0.1:3030').replace(/\/+$/, '');

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port },
  vite: {
    define: { __BLOG_BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
    // dev 环境没有 nginx 反代 /meting，音频和歌词会 404；这里直接指到线上（只影响 dev）
    server: {
      proxy: {
        '/meting': { target: metingTarget, changeOrigin: true }
      }
    }
  }
});
