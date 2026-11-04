#!/usr/bin/env node
/**
 * `npm run config:check`
 *
 * 打印当前生效的配置（密码/密钥自动打码），并列出 .env 里可能漏掉的项。
 * 只读，不改任何文件；error 级问题会以退出码 1 结束，方便放进部署脚本。
 */
import { describeEnv, envIssues } from '../src/config/env.ts';

const rows = describeEnv();
const groups = new Map();
for (const row of rows) {
  if (!groups.has(row.group)) groups.set(row.group, []);
  groups.get(row.group).push(row);
}

const title = (group) => {
  const line = '─'.repeat(Math.max(0, 44 - group.length));
  return `\n${group} ${line}`;
};

console.log('当前生效配置（来自 .env + src/config/site.ts）');
for (const [group, items] of groups) {
  console.log(title(group));
  for (const item of items) {
    const name = item.key.slice(group.length + 1) || item.key;
    console.log(`  ${name.padEnd(18)} ${item.value}`);
  }
}

const issues = envIssues();
if (issues.length) {
  console.log('\n检查结果');
  for (const issue of issues) {
    const tag = issue.level === 'error' ? '✗' : issue.level === 'warn' ? '!' : 'i';
    console.log(`  ${tag} ${issue.message}`);
  }
} else {
  console.log('\n检查结果\n  ✓ 没有发现问题');
}

const errors = issues.filter(issue => issue.level === 'error').length;
if (errors) {
  console.log(`\n${errors} 项必须修复后才能正常登录后台。`);
  process.exitCode = 1;
}
