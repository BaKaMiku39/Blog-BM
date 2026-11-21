# 侧栏骨架 · 交接（三栏页面）

> 时间：2026-11-21 20:30（GMT+8）
> 状态：代码已实现；`astro check` 0 错误、构建通过；1440 / 1024 / 390 三档验收通过；**已部署线上**，`/articles/`、`/about/` 均 200。
> 相关提交：`ee2904b`（文章列表页与关于页接入同款侧栏）。

---

## 1. 结论先行

首页、友链、文章列表（/articles）、关于（/about）这四个页面现在共用同一套三栏骨架，左右栏都是同一份组件，改一处四个页面一起变。

- 左栏：`src/components/ProfileColumn.astro`（博主名片 + 欢迎卡 + 每日一句）
- 右栏：`src/components/SiteSidebar.astro`（时间名片 + 播放器位 + 站点统计 + 站点信息）
- 布局：`.shell.home-grid`，栏宽与断点全部在 `src/styles/global.css` 里统一定义

**单篇文章详情页（`/posts/[slug]`）刻意不接入**：它需要「目录吸顶 + 作者卡」的阅读布局，塞进主页侧栏会把目录挤掉，右栏内容也会超出一屏导致吸顶失效。如果将来要改，先解决目录放哪再动。

---

## 2. 页面清单

| 页面 | 文件 | 外壳 | 中栏 | 备注 |
| --- | --- | --- | --- | --- |
| 首页 | `src/pages/index.astro` | `shell home-grid`（`id="articles"`） | `.main-column` | hero 之后才是骨架 |
| 友链 | `src/pages/links.astro` | `shell home-grid links-grid` | `.main-column.links-page` | 概览条 / 搜索 / 分组 chip |
| 文章列表 | `src/pages/articles.astro` | `shell home-grid articles-grid` | `.main-column.articles-page` | 卡片网格自动两列 |
| 关于 | `src/pages/about.astro` | `shell home-grid about-grid` | `.main-column.about-page` | 原 `max-width:760px` 已覆盖为 none |

---

## 3. 结构契约（照抄，别改标签）

```astro
<div class="shell home-grid xxx-grid">
  <ProfileColumn />

  <div class="main-column xxx-page">
    <!-- 页面自己的内容 -->
  </div>

  <SiteSidebar />
</div>
```

几条硬性要求：

1. **三个子元素的顺序固定**：`.home-grid` 靠 `> .profile-column` / `> .main-column` / `> .sidebar` 三个选择器定位，换标签名或换顺序就散架。
2. **中栏必须 `min-width: 0`**。grid 轨道默认 `auto` 会被长代码行、长 URL 撑开，手机上直接横向溢出（文章页踩过一次，出现 752px 滚动宽度）。
3. **不要再套 `.page-content`**。它自带 `padding-top: 55px; padding-bottom: 85px`，和骨架的 `margin: 22px auto 70px` 叠加会多出一截空白；节奏交给 `xxx-grid` 的 `padding-bottom`。
4. **一个页面只能有一个 `[data-bgm-slot]`**。播放器用 `document.querySelector('[data-bgm-slot]')` 取第一个匹配项，重复放会导致播放器吸附到不该去的位置。

---

## 4. 断点行为

| 视口宽度 | 布局 |
| --- | --- |
| ≥ 1280 | 三栏 `280 / 1fr / 280`；左右栏 `display: flex` 竖排、间距 18px |
| 1024 – 1279 | 两栏 `1fr / 280`；右栏在右，左栏整体落到右栏下方（`grid-row: 2`）；顶部「抽个签」挂件隐藏以免压住时间名片 |
| 768 – 1023 | 两栏 `280 / 1fr`；右栏隐藏，只留左栏 |
| < 768 | 单列；左栏隐藏，右栏跟到正文下方（只剩时间名片 + 站点统计，站点信息按 `global.css` 规则隐藏） |

实测栏宽（与友链页完全一致）：1440 下 280 / 816 / 280，1024 下 696 + 280，三档 `scrollWidth` 均等于视口宽度，无横向滚动。

---

## 5. 两个侧栏组件里有什么

### ProfileColumn（左）

- `.profile-panel`：昼夜横幅（`banner-clear-day/night.webp`）+ 天气徽标 + 头像 + 名字 + 身份 + 签名 + 社交按钮
- `WelcomeCard`：欢迎卡，带「关于我 / GitHub 仓库」两个入口
- `QuoteCard`：每日一句
- 组件内脚本按 `document.documentElement.dataset.theme` 切昼夜横幅，天气常量在最上面：`const BANNER_WEATHER = 'clear'`（可选 clear / cloud / rain / snow，改这一行就换天气）

### SiteSidebar（右）

| 卡片 | 高度（1440） | 说明 |
| --- | --- | --- |
| `DayCard` | 331px | 问候语 + 大时间 + 日期 + 节气/农历 |
| `bgm-slot` | 130px | 播放器吸附位，`features.bgm` 关闭时不渲染 |
| `SiteStatsCard` | 373–386px | 分类/标签统计条 |
| `SiteInfo` | 183px | 「交换信息」用的站点资料，≤768 隐藏 |

整栏合计约 1071px（1440），比一屏高，所以**在 ≥1280 时右栏不做吸顶**，跟着页面滚动——这是 2026-11-03 的既定决策（当时吸顶 + 内部滚动条观感更差），新页面不要给它加 `position: sticky`。

`SiteSidebar` 支持 `statsTitleId` 属性，同页出现多份统计卡时用来区分 `aria-labelledby`，普通页面不用传。

---

## 6. 本次改动清单（2026-11-21）

- `src/pages/articles.astro`：外层换成 `.shell.home-grid.articles-grid`，原有内容（标题、搜索、筛选、卡片网格、空态）整体移入 `.main-column.articles-page`，末尾追加 `<SiteSidebar />`
- `src/pages/about.astro`：同样接入骨架，关于内容进中栏
- `src/styles/global.css`（友链样式段之后新增）：

```css
.articles-grid,
.about-grid { padding-bottom: 34px; }

.articles-page,
.about-grid .about-page { min-width: 0; max-width: none; }

.articles-page .page-intro { margin-bottom: 4px; }
.articles-page .article-search { max-width: 520px; }
```

- 新增 `scripts/_layout.mjs`：一次性量栏宽 + 截图的验收脚本（见下）

---

## 7. 给新页面加侧栏的步骤

1. `import ProfileColumn from '../components/ProfileColumn.astro';`、`import SiteSidebar from '../components/SiteSidebar.astro';`
2. 按第 3 节的结构包一层 `shell home-grid xxx-grid`
3. 中栏加 `min-width: 0`，需要的话再调一下 `max-width`
4. `.xxx-grid { padding-bottom: 34px; }`（和友链页对齐）
5. `npm run check`，然后量一遍：

```bash
# 必须用系统 Node v24，WorkBuddy 内置的 22 会被 Astro 拒绝
export PATH="/c/Program Files/nodejs:$PATH"
node scripts/_layout.mjs mypage 1440,1024,390
```

脚本会把各栏宽高打到控制台，截图落在 `review-shots/layout/<tag>-<page>-<width>.png`。注意它内部写死了首页/文章列表/文章详情/关于/友链五个路径，测新页面时改一下 `PAGES` 数组。

6. `npm run build` → 打包 dist 发版 → `systemctl restart bakamiku`

---

## 8. 验收记录

- `astro check`：0 error（14 hints 为既有提示）
- `npm run build`：通过（Server built in 3.79s）
- 1440 / 1024 / 390 三档截图：三栏结构、卡片顺序、暗色主题均正常，无重叠、无横向溢出
- 线上：`https://www.bakamiku.com/articles/`、`/about/` 均 200，生产 HTML 含 `home-grid articles-grid` / `articles-page`

---

## 9. 已知遗留

- **GitHub 推送未完成**：`190908f`（波浪/贴纸回滚）、`dc02286`（封面裁切修复）、`ee2904b`（本次侧栏）三个提交仍在本地，GitHub 侧持续 SSL eof / 502，网络恢复后 `git push` 即可。线上代码已是正确状态，不受影响。
- 文章详情页未接入骨架（有意为之）。
- ≤560px 时播放器整条铺满会遮住约 130px 内容，迷你条方案一直没做。
- 右栏统计卡与 `SiteInfo` 的数据来自 `data/site-info.json` 与站点配置，后台「站点资料」模块可改。
