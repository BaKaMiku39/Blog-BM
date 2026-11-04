/**
 * 站点身份配置 —— 换域名、换名字、换导航只改这里，不用翻组件。
 *
 * 这里只放「写死的站点信息」；会随环境变化的东西（域名、备案号、社交链接、
 * 功能开关）在 `src/config/env.ts`，由 `.env` 提供。
 */

export type NavKey = 'home' | 'articles' | 'about';

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
}

export const site = {
  /** 站点名，顶栏 / 页脚 / RSS / OG 都用它 */
  name: 'BaKaMiku',
  /** 页脚那句 slogan */
  tagline: '记录热爱，分享所学。',
  /** 默认 meta description */
  description: '技术笔记、项目作品与动漫游戏随记。',
  /** 首页 hero 的眉标（全大写英文，换中文要同时调字号字距） */
  kicker: "BAKAMIKU'S SPACE · SPRING SNOW",

  locale: 'zh-CN',
  ogLocale: 'zh_CN',
  lang: 'zh-CN',

  author: {
    name: 'BaKaMiku',
    avatar: '/images/avatar.webp',
    /** 左栏名片第二行 */
    role: '热爱代码与二次元 · 长期折腾中',
    /** 左栏名片第三行 */
    motto: '用文字收藏思考，用代码创造梦想。',
  },

  /** 文章 / 详情页的默认分享图 */
  ogImage: '/images/hero-spring.webp',
  /** 首页 hero 图，换图改这里（组件里还有 portrait 版本） */
  heroImage: {
    wide: '/images/hero-spring.webp',
    portrait: '/images/hero-spring-portrait.webp',
  },

  /** 浏览器地址栏颜色 */
  themeColor: {
    light: '#f1f6fd',
    dark: '#111a2b',
  },

  /** 顶栏导航。key 只用于高亮匹配，加新页面时在 Base 的 navIcon 里补一个图标 */
  nav: [
    { key: 'home', label: '首页', href: '/' },
    { key: 'articles', label: '文章', href: '/articles' },
    { key: 'about', label: '关于', href: '/about' },
  ] satisfies NavItem[],

  /** 页脚导航（纯文字，不带图标） */
  footerNav: [
    { label: '首页', href: '/' },
    { label: '文章', href: '/articles' },
    { label: '关于', href: '/about' },
  ],

  /** 页脚备案占位符：配置为空时显示 */
  records: {
    icpPlaceholder: 'ICP备案号待填写',
    moePlaceholder: '萌ICP备案号待填写',
  },
} as const;
