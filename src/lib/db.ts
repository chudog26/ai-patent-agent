/**
 * 数据库连接层
 *
 * 使用原生 pg 连接池 + drizzle-orm 直连 PostgreSQL，不依赖任何中间平台。
 * 对外暴露的 getDb() 契约保持稳定，上层 Manager 无需关心连接细节。
 *
 * 环境变量：
 *   DATABASE_URL        必填，PostgreSQL 连接串
 *   DATABASE_SSL        可选，设为 "true" 时启用 SSL（云数据库通常需要）
 *   DATABASE_POOL_MAX   可选，连接池上限，默认 10
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/storage/database/shared/schema';

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let database: Database | undefined;

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      '缺少环境变量 DATABASE_URL。请复制 .env.example 为 .env.local 并填写 PostgreSQL 连接串，' +
        '例如 postgresql://postgres:postgres@localhost:5432/patent_agent'
    );
  }

  const created = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  // 连接池的异步错误不应让进程崩溃
  created.on('error', (error) => {
    console.error('[db] 空闲连接异常:', error);
  });

  return created;
}

/** 获取 pg 连接池（用于需要原生 SQL 的场景，例如执行 init.sql） */
export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

/**
 * 获取 drizzle 实例。
 * 返回可直接 await 的 drizzle 实例（首次调用时惰性建立连接池）。
 */
export function getDb(): Database {
  if (!database) {
    database = drizzle(getPool(), { schema });
  }
  return database;
}

/** 健康检查：确认数据库可连通，返回服务端版本 */
export async function pingDatabase(): Promise<string> {
  const client = await getPool().connect();
  try {
    const result = await client.query<{ version: string }>('SELECT version()');
    return result.rows[0]?.version ?? 'unknown';
  } finally {
    client.release();
  }
}

/** 关闭连接池（主要用于脚本退出前清理） */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    database = undefined;
  }
}
