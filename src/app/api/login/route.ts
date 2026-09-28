import { NextRequest, NextResponse } from 'next/server';
import { userManager } from '@/storage/database';
import { verifyPassword } from '@/lib/password';

/**
 * 用户登录
 *
 * 密码校验走 verifyPassword（scrypt 散列 + 定时安全比较）。
 * 若命中库里遗留的明文密码，验证通过后就地升级为散列（惰性迁移）。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await userManager.getUserByUsername(username);

    if (!user) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码（兼容历史明文并回报是否需要迁移）
    const { valid, needsRehash } = await verifyPassword(password, user.password);

    if (!valid) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    if (needsRehash) {
      try {
        await userManager.updateUserPassword(user.id, password);
      } catch (error) {
        // 迁移失败不影响本次登录，下次登录会再试一次
        console.error('Failed to migrate legacy plaintext password:', error);
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        currentUsername: user.username,
        email: user.email,
        phone: user.phone,
        company: user.company,
        position: user.position,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error in login API:', error);
    return NextResponse.json(
      { error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}
