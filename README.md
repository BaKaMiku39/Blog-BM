# BaKaMiku

一个写着玩、但每个细节都抠过的个人博客。Astro + Node 服务端渲染，没有数据库，文章就是 `data/posts` 下的 Markdown 文件。

## 它有什么

**内容** —— 文章、分类、标签、搜索、按发布时间排序；草稿与发布分离，保存只写文件，点发布才出现在首页。

**首页** —— 会看时间的时间名片（日月图标、七段问候、节气农历）、每天三次的抽签、十二首歌的音乐盒、站点统计。明暗两套主题，四套分类封面色（没配图时按分类走，光斑位置由 slug 哈希算出来，同分类两张也不撞脸）。

**细节** —— 连点 logo 五次炸花瓣；滚动时御守角标会摆，停下来就静止；封面悬停有反光扫过；音乐盒吸附进侧栏时靠矩形重合做到零位移。

**后台** —— `/admin` 里写 Markdown、看预览、传图、存草稿、发布。

## 快速开始

需要 **Node 22.23.4 以上**。

```bash
npm install
cp .env.example .env      # 填三个值，见下
npm run dev               # http://localhost:4321
```

`.env` 里真正非填不可的只有三个：

| 变量 | 说明 |
| --- | --- |
| `ADMIN_PASSWORD` | `/admin` 登录密码，十六位以上随机串 |
| `SESSION_SECRET` | 登录签名与访客去重盐，`openssl rand -hex 32` |
| `PUBLIC_SITE_URL` | 对外地址，**不要带结尾斜杠** |

其余社交链接、备案号、功能开关留空就是「不显示」。改完跑 `npm run config:check` 自检，关键项漏了直接退出码 1。

站点身份（站名、导航、slogan、主题色）在 `src/config/site.ts`，与环境无关，不用改 `.env`。

## 音乐播放器

播放器不含音频文件，所有歌都走 `/meting/api?server=netease&type=url&id=<ID>`。`/meting` **不属于本项目**，它是 Meting-API —— 把网易云、QQ 音乐等平台的播放地址和歌词统一成一个 URL 的中间层，需要自己架。

本站用的是 **[mikus-loli/Meting-API](https://github.com/mikus-loli/Meting-API)**（`xizeyoupan/Meting-API` 的 fork，上游是 [metowolf/Meting-API](https://github.com/metowolf/Meting-API)）。它带管理后台、Cookie 管理和自动续期，配好 cookie 之后 VIP 曲目也能出完整音频，不会三十秒就断。部署、cookie 怎么填、反代要注意什么，都以该仓库的 README 为准。

最省事的起法（和本站线上一致）：

```bash
docker run -d --name meting-api --restart always \
  -p 127.0.0.1:3030:3000 \
  -e UID=1010 -e GID=1010 -e PORT=3000 \
  -v /opt/meting/data:/app/data \
  ghcr.io/mikus-loli/meting-api:latest
```

1. 容器只监听 `127.0.0.1:3030`，不直接暴露公网；`/opt/meting/data` 里放 cookie、日志和配置，记得备份
2. nginx 反代，注意 `proxy_pass` 结尾的斜杠负责剥掉前缀：

```nginx
location /meting/ {
    proxy_pass http://127.0.0.1:3030/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # 关键：告诉 Meting-API 公网地址，否则它返回 127.0.0.1 的音频地址，浏览器放不了
    proxy_set_header X-Forwarded-Host $host/meting;
}
```

3. 本地开发没有 nginx，把 `METING_TARGET` 指向你的 Meting 服务，`astro.config.mjs` 里的 dev 代理会用上

歌单在 `src/lib/playlist.ts`，改 id 即可。**换歌后必须验**：

```bash
curl -s -o /dev/null -D - -r 0-0 \
  'https://你的域名/meting/api?server=netease&type=url&id=<新ID>' \
  | grep -i 'content-type\|content-range'
```

要看到 `audio/mpeg`，且 `content-range` 总字节不能是 **481115**。这个数字是「30 秒试听」的固定长度——没有登录 cookie 的接口遇到 VIP 曲目只给这一段，播放器上看着正常，三十秒后自己停。

不想架这一套：`FEATURE_BGM=false`，播放器整块不渲染。

## 命令

```bash
npm run dev          # 开发，默认 4321
npm run build        # 构建
npm run preview      # 预览构建产物
npm run check        # Astro / TypeScript 检查
npm run config:check # 打印生效配置（密码打码）并检查缺项
```

## 目录

```
data/posts/       文章（Markdown + frontmatter）
data/uploads/     后台传的图
assets/           插画源图
public/           静态资源（图、花瓣素材、ambient.js）
src/components/   卡片、名片、播放器、抽签、统计等
src/config/       site.ts（身份） + env.ts（环境）
src/lib/          文章读取、时钟、歌单、访客统计
src/pages/        页面与 API 路由
src/styles/       global.css + 各组件样式
```

## 部署

`output: 'server'`，Node standalone。构建后 `node dist/server/entry.mjs` 即可跑，前面挂 nginx 反代。`data/` 与 `dist/` 同级保留——文章和上传的图是运行时读的，不在构建产物里；发布新版本时别覆盖 `data/` 和 `.env`。

## 许可

[MIT](LICENSE)
