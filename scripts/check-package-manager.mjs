#!/usr/bin/env node
/**
 * 包管理器校验（preinstall 钩子）。
 *
 * 原实现是 `npx only-allow pnpm`：需要联网拉取 only-allow，在离线环境或
 * 非交互终端里会卡住或报错。这里改成零依赖的本地检查，效果相同但没有副作用。
 */
const userAgent = process.env.npm_config_user_agent ?? '';

if (!userAgent.includes('pnpm')) {
  console.error('');
  console.error('  本项目使用 pnpm 管理依赖，请改用：');
  console.error('');
  console.error('      pnpm install');
  console.error('');
  console.error('  如尚未安装 pnpm：npm i -g pnpm');
  console.error('');
  process.exit(1);
}
