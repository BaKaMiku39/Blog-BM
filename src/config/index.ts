/**
 * 配置唯一入口。
 *
 *   import { config } from '../config';
 *   config.site.name          // 站点身份（写死）
 *   config.env.site.icp       // 环境变量（.env）
 *
 * 组件里不要再直接写 process.env 或重复的站点名常量。
 */
import { env } from './env';
import { site } from './site';

export const config = { site, env } as const;

export { env, site };
export { adminReady, describeEnv, envIssues, isDev, isProduction } from './env';
export type { EnvIssue } from './env';
export type { NavItem, NavKey } from './site';
