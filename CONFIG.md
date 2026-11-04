# 配置说明

站点配置分三层，各管一件事。改东西之前先确认它属于哪一层，不要跨层乱塞。

```
.env                    只放「随环境变化」的值：密钥、域名、开关
  ↓  src/config/env.ts  唯一读 process.env 的地方，负责解析 / 默认值 / 类型 / 自检
src/config/site.ts      写死的站点身份：名字、slogan、导航、头像、主题色
  ↓  src/config/index.ts 汇总成 config
组件                    import { config } from '../config'
```

| 想改什么 | 改哪里 |
| --- | --- |
| 后台密码、会话密钥 | `.env` |
| 域名、备案号 | `.env` |
| 社交链接 | `.env` |
| 开关某个功能（播放器 / 统计 / 抽签 / 搜索） | `.env` |
| 站点名、slogan、默认描述 | `src/config/site.ts` |
| 顶栏 / 页脚导航 | `src/config/site.ts` |
| 主题色、默认分享图、头像 | `src/config/site.ts` |

---

## 1. 环境变量（`.env`）

从模板开始：

```bash
cp .env.example .env
```

必填两项，其余都有默认值：

```bash
# 后台登录密码
ADMIN_PASSWORD=
# 登录签名 + 访客去重盐，至少 32 位
SESSION_SECRET=
```

生成密钥：

```bash
openssl rand -hex 32
```

### 命名约定

| 前缀 | 含义 |
| --- | --- |
| `PUBLIC_` | 会被 Astro 注入到客户端，**只能放可以公开的地址** |
| `FEATURE_` | 功能开关，值写 `true` / `false`（也认 `1/0`、`yes/no`、`on/off`） |
| `ADMIN_` | 后台相关 |
| 其它 | 运行参数，见 `.env.example` 分组注释 |

密码、密钥**不要**加 `PUBLIC_` 前缀。

### 当前支持的变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听地址 |
| `PORT` | `4321` | 端口；`astro.config.mjs` 也会读它 |
| `NODE_ENV` | `development` | `production` 时 `isProduction` 为真 |
| `SITE_TIMEZONE` | `Asia/Shanghai` | 访问统计按这个时区切天 |
| `ADMIN_PASSWORD` | 空 | 后台密码 |
| `SESSION_SECRET` | 空 | 至少 32 位 |
| `ADMIN_COOKIE_NAME` | `bakamiku_admin` | 多站同域时改成不同的 |
| `PUBLIC_SITE_URL` | 空 | 对外地址，无尾斜杠；留空按反代头推断 |
| `ICP_NUMBER` | 空 | 页脚备案，空则显示占位 |
| `MOE_ICP_NUMBER` | 空 | 萌 ICP 备案 |
| `PUBLIC_GITHUB_URL` | 空 | 首页按钮，空则不显示 |
| `PUBLIC_BILIBILI_URL` | 空 | 同上 |
| `PUBLIC_CONTACT_EMAIL` | 空 | 同上 |
| `METING_TARGET` | `http://127.0.0.1:3030` | dev 下 `/meting` 代理目标（`astro.config.mjs` 也读）；指向你自己的 Meting 服务 |
| `METING_SERVER` | `netease` | `netease` / `tencent` / `kugou` / `baidu` |
| `FEATURE_BGM` | `true` | 背景音乐播放器（关掉连槽位一起不渲染） |
| `FEATURE_VISITS` | `true` | 页脚访问统计（关掉不写 `data/visits.json`） |
| `FEATURE_FORTUNE` | `true` | 顶栏抽签挂件 |
| `FEATURE_SEARCH` | `true` | 顶栏搜索框 |
| `PAGE_SIZE` | `12` | 首页每页文章数（1–60） |

### 自检

```bash
npm run config:check
```

会按组打印当前生效值（密码打码），并列出漏配项：

- `✗` 必须修，脚本以退出码 1 结束，可以放进部署脚本
- `!` 建议修，不影响启动
- `i` 提示，通常是「留空走默认行为」

缺 `ADMIN_PASSWORD` 不会让站点 500 —— 只是后台登录不可用，前台照常。

---

## 2. 站点身份（`src/config/site.ts`）

写死的内容都在这里，组件里不再出现 `'BaKaMiku'` 这样的字面量。

```ts
export const site = {
  name: 'BaKaMiku',            // 顶栏 / 页脚 / RSS / OG 标题
  tagline: '记录热爱，分享所学。',
  description: '技术笔记、项目作品与动漫游戏随记。',
  kicker: "BAKAMIKU'S SPACE · SPRING SNOW",  // 首页眉标
  author: { name, avatar, role, motto },
  ogImage: '/images/hero-spring.webp',
  themeColor: { light, dark },
  nav: [...],        // 顶栏，key 只用于高亮匹配
  footerNav: [...],  // 页脚
};
```

换名字时注意 `description`、`ogImage`、`author` 一起看，别只改一处。

---

## 3. 新增一个配置项

以「加一个页脚友情链接」为例：

**① 如果是随环境变化的**，在 `src/config/env.ts` 对应分组里加一行：

```ts
social: {
  // ...
  link: optional('PUBLIC_FRIEND_LINK'),
},
```

然后在 `.env.example` 里补一条：

```bash
PUBLIC_FRIEND_LINK=
```

**② 如果是写死的**，直接加到 `src/config/site.ts`。

**③ 组件里用：**

```astro
---
import { config } from '../config';
const link = config.env.social.link;
---
{link && <a href={link}>友链</a>}
```

**④ 跑一遍：**

```bash
npm run check        # 类型
npm run config:check # 配置是否读到了
```

### 解析器

`env.ts` 里现成的工具，别自己写：

| 函数 | 用途 | 空值行为 |
| --- | --- | --- |
| `text(key, fallback)` | 字符串 | 用 fallback |
| `optional(key)` | 可空字符串 | `undefined` |
| `number(key, fallback, min, max)` | 数字，越界夹紧 | 用 fallback |
| `flag(key, fallback)` | 布尔 | 用 fallback |
| `oneOf(key, values, fallback)` | 枚举 | 用 fallback |
| `url(key, fallback)` | 地址，去尾斜杠 | 返回空串 |

写错的值不会静默生效：`flag` / `number` / `oneOf` / `url` 会把问题记进 `envIssues()`，`config:check` 里能看到。

---

## 4. 常见场景

**关掉背景音乐**

```bash
FEATURE_BGM=false
```

播放器、侧栏槽位、`/meting` 请求一起消失，不会留 160px 空洞。

**换网易云接口源**

```bash
METING_TARGET=https://your-meting.example.com
METING_SERVER=netease
```

只影响 `astro dev` 的 `/meting` 代理；线上走 nginx，改 `SERVER-SETUP.md` 里的反代配置。

**同一套代码部署两个站**

两个 `.env`，`ADMIN_COOKIE_NAME`、`PORT`、`PUBLIC_SITE_URL` 各不相同；站点名等身份信息如果也要不同，复制一份 `site.ts` 或改成从 `env` 读。

---

## 5. 注意

- `.env` 已在 `.gitignore` 里，**不要提交**；改完记得同步 `.env.example`。
- 生产环境用 systemd 的 `EnvironmentFile=` 注入，不依赖项目目录里的 `.env`（见 `SERVER-SETUP.md`）。
- `astro.config.mjs` 需要 `PORT` 和 `METING_TARGET`，它读的是原始的 `process.env`（构建期），改字段时两边一起改。
- 站点身份用 `as const`，在组件里是只读的；要按语言/主题动态切换，得改成函数。
