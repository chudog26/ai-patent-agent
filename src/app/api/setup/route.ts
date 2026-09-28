import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPool, pingDatabase } from '@/lib/db';
import { userManager } from '@/storage/database';
import { publicErrorMessage } from '@/lib/api-helpers';

/**
 * GET  /api/setup  查询是否已完成初始化
 * POST /api/setup  首次部署初始化：建表 + 创建第一个管理员
 *
 * 安全约束：只有在「系统中还不存在任何管理员」时才允许 POST，
 * 因此部署完成后这个接口自动失效，不会被用来提权。
 *
 * 这里取代了旧版本散落的 /api/migrate/* 与 /api/init-default-admin（后者会
 * 硬编码创建 admin/admin，属于明显的安全隐患）。
 */

async function resolveInitSqlPath(): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), 'sql', 'init.sql'),
    path.join(process.cwd(), '..', 'sql', 'init.sql'),
    path.join(process.cwd(), '.next', 'standalone', 'sql', 'init.sql'),
  ];

  for (const candidate of candidates) {
    try {
      await readFile(candidate, 'utf8');
      return candidate;
    } catch {
      // 继续尝试下一个
    }
  }
  return null;
}

/** 执行建表脚本；pgcrypto 扩展单独处理，避免无权限时整体失败 */
async function ensureSchema(): Promise<{ ok: boolean; message: string }> {
  const sqlPath = await resolveInitSqlPath();
  if (!sqlPath) {
    return {
      ok: false,
      message: '找不到 sql/init.sql，请确认部署产物中包含该文件（可用 pnpm db:init 手动执行）。',
    };
  }

  const raw = await readFile(sqlPath, 'utf8');
  const withoutExtension = raw
    .split(/\r?\n/)
    .filter((line) => !/^\s*CREATE\s+EXTENSION/i.test(line))
    .join('\n');

  const pool = getPool();

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  } catch (error) {
    console.warn(
      '[setup] pgcrypto 扩展创建失败，若 PostgreSQL 低于 13 且 gen_random_uuid() 不可用，请手动处理：',
      error
    );
  }

  await pool.query(withoutExtension);
  return { ok: true, message: '数据库结构已就绪' };
}

async function countAdmins(): Promise<number> {
  const users = await userManager.getAllUsers();
  return users.filter((user) => user.role === 'admin').length;
}

export async function GET() {
  try {
    await pingDatabase();

    const adminCount = await countAdmins();

    return NextResponse.json({
      databaseConnected: true,
      initialized: adminCount > 0,
      needsSetup: adminCount === 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        databaseConnected: false,
        initialized: false,
        needsSetup: false,
        error: publicErrorMessage(error, '数据库连接失败'),
      },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await pingDatabase();

    if ((await countAdmins()) > 0) {
      return NextResponse.json(
        { error: '系统已完成初始化，如需新增管理员请由现有管理员在后台操作。' },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');

    if (!username || username.length < 3) {
      return NextResponse.json({ error: '管理员账号至少 3 个字符' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: '管理员密码至少 8 位' }, { status: 400 });
    }

    const schema = await ensureSchema();
    if (!schema.ok) {
      return NextResponse.json({ error: schema.message }, { status: 500 });
    }

    const created = await userManager.createUser({
      username,
      password,
      role: 'admin',
      email: body.email ? String(body.email) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: '初始化完成，请使用刚刚创建的账号登录。',
      user: { id: created.id, username: created.username, role: created.role },
    });
  } catch (error) {
    console.error('Setup failed:', error);
    return NextResponse.json(
      { error: `初始化失败：${publicErrorMessage(error, '请查看服务端日志')}` },
      { status: 500 }
    );
  }
}
