/**
 * 环境变量读入口 —— 全站唯一读 process.env 的地方。
 *
 * 想加一个新变量：
 *   1. 在下面合适的组里加一行（text / optional / number / flag / oneOf / url / list）；
 *   2. 在 `.env.example` 里补一条同样名字的示例；
 *   3. 组件里用 `config.env.xxx.yyy`，不要再直接写 process.env。
 *
 * 约定：
 *   - 带 PUBLIC_ 前缀的会被 Astro 注入到客户端，只放「可以公开」的地址；
 *   - 密码 / 密钥不要加 PUBLIC_，它们只在 SSR 里读；
 *   - 空字符串一律等价于「没配置」，取默认值或 undefined。
 */
import 'dotenv/config';

/** 解析过程中发现的问题，统一在 envWarnings() 里带出去 */
const issues: string[] = [];

const raw = (key: string): string => (process.env[key] ?? '').trim();

/** 有默认值的字符串 */
const text = (key: string, fallback = ''): string => raw(key) || fallback;

/** 没配就是 undefined，模板里用 `??` 兜底 */
const optional = (key: string): string | undefined => raw(key) || undefined;

const TRUE = new Set(['1', 'true', 'yes', 'on']);
const FALSE = new Set(['0', 'false', 'no', 'off']);

/** 布尔开关：真值 1/true/yes/on，假值 0/false/no/off，写错按默认值并记一条警告 */
const flag = (key: string, fallback: boolean): boolean => {
  const value = raw(key).toLowerCase();
  if (!value) return fallback;
  if (TRUE.has(value)) return true;
  if (FALSE.has(value)) return false;
  issues.push(`${key}="${value}" 不是布尔值（true/false），已按 ${fallback} 处理`);
  return fallback;
};

/** 数字：超出范围时夹到边界 */
const number = (key: string, fallback: number, min = -Infinity, max = Infinity): number => {
  const value = raw(key);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    issues.push(`${key}="${value}" 不是数字，已按 ${fallback} 处理`);
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

/** 枚举：写错时回退默认值，避免拼写错误悄悄生效 */
const oneOf = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
  const value = raw(key) as T;
  if (!value) return fallback;
  if (values.includes(value)) return value;
  issues.push(`${key}="${value}" 不在 ${values.join(' / ')} 里，已按 ${fallback} 处理`);
  return fallback;
};

/** 地址：去掉末尾斜杠；不合法就记警告并返回空串（调用方会走相对地址兜底） */
const url = (key: string, fallback = ''): string => {
  const value = (raw(key) || fallback).replace(/\/+$/, '');
  if (!value) return '';
  try {
    new URL(value);
    return value;
  } catch {
    issues.push(`${key}="${value}" 不是合法地址（要带 http:// 或 https://），已忽略`);
    return '';
  }
};

export const env = {
  /** 进程与监听 */
  runtime: {
    nodeEnv: text('NODE_ENV', 'development'),
    host: text('HOST', '127.0.0.1'),
    port: number('PORT', 4321, 1, 65535),
    /** 访问统计按这个时区切「今天」 */
    timezone: text('SITE_TIMEZONE', 'Asia/Shanghai'),
  },

  /** 后台登录：密码 + 签名密钥 */
  auth: {
    adminPassword: text('ADMIN_PASSWORD'),
    sessionSecret: text('SESSION_SECRET'),
    cookieName: text('ADMIN_COOKIE_NAME', 'bakamiku_admin'),
  },

  /** 对外地址与备案 */
  site: {
    /** 规范地址来源；留空则按反向代理头推断 */
    url: url('PUBLIC_SITE_URL'),
    icp: optional('ICP_NUMBER'),
    moeIcp: optional('MOE_ICP_NUMBER'),
  },

  /** 公开的个人链接，空了就不显示按钮 */
  social: {
    github: optional('PUBLIC_GITHUB_URL'),
    bilibili: optional('PUBLIC_BILIBILI_URL'),
    email: optional('PUBLIC_CONTACT_EMAIL'),
  },

  /** 网易云音乐接口（dev 代理用；线上由 nginx 反代） */
  media: {
    metingTarget: url('METING_TARGET', 'http://127.0.0.1:3030'),
    metingServer: oneOf('METING_SERVER', ['netease', 'tencent', 'kugou', 'baidu'] as const, 'netease'),
  },

  /** 功能开关：关掉之后对应组件不渲染、也不产生请求 */
  features: {
    bgm: flag('FEATURE_BGM', true),
    visits: flag('FEATURE_VISITS', true),
    fortune: flag('FEATURE_FORTUNE', true),
    search: flag('FEATURE_SEARCH', true),
  },

  /** 其它零散项 */
  misc: {
    /** 首页每页条数 */
    pageSize: number('PAGE_SIZE', 12, 1, 60),
  },
} as const;

export const isProduction = env.runtime.nodeEnv === 'production';
export const isDev = !isProduction;

/** 后台是否配置完整（密码非空 + 密钥至少 32 位） */
export const adminReady = Boolean(env.auth.adminPassword && env.auth.sessionSecret.length >= 32);

/** 自检结果：error 会让 `config:check` 以非零码退出，warn/info 只提示 */
export type EnvIssue = { level: 'error' | 'warn' | 'info'; message: string };

/**
 * 启动前自检。返回人能看懂的提示，不抛异常 —— 缺配置时站点照常跑，
 * 只是后台登录不可用，别让一个 `.env` 没填就让整站 500。
 * 需要在 CI / 部署前卡住，用 `npm run config:check`（error 级会 exit 1）。
 */
export function envIssues(): EnvIssue[] {
  const out: EnvIssue[] = issues.map(message => ({ level: 'warn' as const, message }));

  if (!env.auth.adminPassword) {
    out.push({ level: 'warn', message: 'ADMIN_PASSWORD 未设置：/admin 无法登录（前台不受影响）' });
  } else if (env.auth.adminPassword.length < 12) {
    out.push({ level: 'warn', message: 'ADMIN_PASSWORD 短于 12 位，建议换成随机长串' });
  }

  if (!env.auth.sessionSecret) {
    out.push({ level: 'error', message: 'SESSION_SECRET 未设置：后台登录不可用，访客去重盐退回写死值' });
  } else if (env.auth.sessionSecret.length < 32) {
    out.push({ level: 'error', message: 'SESSION_SECRET 短于 32 位：签名强度不足，用 `openssl rand -hex 32` 重新生成' });
  }

  if (!env.site.url) {
    out.push({ level: 'info', message: 'PUBLIC_SITE_URL 为空：canonical / OG / RSS 按请求头推断（反代后面通常没问题）' });
  }

  const social = [env.social.github, env.social.bilibili, env.social.email].filter(Boolean).length;
  if (!social) out.push({ level: 'info', message: '三个社交链接都为空：首页不显示联系按钮' });

  return out;
}

/** 给 `npm run config:check` 用：按组打印，密码类自动打码 */
export function describeEnv(): { group: string; key: string; value: string }[] {
  const SECRET = /(PASSWORD|SECRET|TOKEN|KEY)$/i;
  const rows: { group: string; key: string; value: string }[] = [];
  const walk = (prefix: string, node: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(node)) {
      const name = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        walk(name, value as Record<string, unknown>);
        continue;
      }
      const shown = Array.isArray(value)
        ? value.join(', ')
        : typeof value === 'boolean'
          ? String(value)
          : String(value ?? '');
      rows.push({
        group: prefix || '(root)',
        key: name,
        value: SECRET.test(key) && shown ? `${'*'.repeat(Math.min(shown.length, 12))} (${shown.length} 位)` : shown || '(空)',
      });
    }
  };
  walk('', env as unknown as Record<string, unknown>);
  return rows;
}
