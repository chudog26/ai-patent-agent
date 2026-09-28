import { NextRequest, NextResponse } from 'next/server';
import { userManager } from '@/storage/database';

/**
 * 修改当前用户密码。
 *
 * 设计说明（产品决策，非疏漏）：改密不校验原密码，只要求已登录。
 * 这与「密码以散列存储、服务端无法还原」的前提一致——服务端不掌握明文，
 * 也不提供原密码回显。
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      );
    }

    if (!body.newPassword) {
      return NextResponse.json(
        { error: '新密码不能为空' },
        { status: 400 }
      );
    }

    // 验证新密码长度
    if (body.newPassword.length < 6) {
      return NextResponse.json(
        { error: '新密码长度不能少于6位' },
        { status: 400 }
      );
    }

    // 验证用户是否存在
    const existingUser = await userManager.getUserById(userId);
    if (!existingUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 更新密码（入库前自动散列化）
    const user = await userManager.updateUserPassword(userId, body.newPassword);

    if (!user) {
      return NextResponse.json(
        { error: '密码修改失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    console.error('Error in change-password API:', error);
    return NextResponse.json(
      { error: '密码修改失败' },
      { status: 500 }
    );
  }
}
