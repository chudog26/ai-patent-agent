#!/usr/bin/env node
/**
 * 数据库初始化脚本（跨平台，无需 bash）
 *
 * 用法：
 *   pnpm db:init              全新部署，执行 sql/init.sql
 *   pnpm db:init -- --migrate 已有旧库，执行 sql/migrations/*.sql 增量升级
 *
 * 会依次尝试加载 .env.local、.env 中的环境变量，再读取 DATABASE_URL 建连。
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 极简 .env 解析：够用且不引入额外依赖 */
async function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);
  if (!existsSync(filePath)) return false;

  const content = await readFile(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
  return true;
}

async function resolveSqlFiles() {
  const useMigration = process.argv.includes('--migrate');

  if (!useMigration) {
    return [path.join(projectRoot, 'sql', 'init.sql')];
  }

  const migrationDir = path.join(projectRoot, 'sql', 'migrations');
  if (!existsSync(migrationDir)) {
    throw new Error(`找不到迁移目录：${migrationDir}`);
  }

  const entries = (await readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  return entries.map((name) => path.join(migrationDir, name));
}

async function main() {
  await loadEnvFile('.env.local');
  await loadEnvFile('.env');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('✗ 缺少环境变量 DATABASE_URL');
    console.error('  请复制 .env.example 为 .env.local 并填写 PostgreSQL 连接串。');
    process.exit(1);
  }

  const files = await resolveSqlFiles();
  const sslEnabled = process.env.DATABASE_SSL === 'true';

  const client = new pg.Client({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  const target = connectionString.replace(/:\/\/[^@]*@/, '://***@');
  console.log(`✓ 已连接数据库 ${target}`);

  try {
    for (const file of files) {
      const sqlText = await readFile(file, 'utf8');
      process.stdout.write(`→ 执行 ${path.relative(projectRoot, file)} ... `);
      await client.query(sqlText);
      console.log('完成');
    }
    console.log('\n✓ 数据库初始化完成');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('\n✗ 初始化失败：', error.message);
  process.exit(1);
});
