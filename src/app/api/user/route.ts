import { NextRequest, NextResponse } from 'next/server';
import { userManager } from '@/storage/database';

/**
 * 当前用户信息。
 * 注意：password 以散列存储，不可还原，因此不再随用户信息下发。
 * 前端如需展示「是否已设置密码」，使用 hasPassword 标记即可。
 */

// 获取当前用户信息
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      // 如果没有用户ID，返回401错误，不再自动创建用户
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      );
    }

    // 根据用户ID获取用户信息
    const user = await userManager.getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
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
      hasPassword: Boolean(user.password),
    });
  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}

// 更新用户信息
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: '用户ID不能为空' },
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

    // 更新用户名（如果提供）
    if (body.username) {
      const usernameCheck = await userManager.getUserByUsername(body.username);
      if (usernameCheck && usernameCheck.id !== userId) {
        return NextResponse.json(
          { error: '用户名已存在' },
          { status: 400 }
        );
      }
    }

    // 更新用户信息
    // 处理字段名映射：currentUsername -> username
    const updateData = { ...body };
    if (updateData.currentUsername && !updateData.username) {
      updateData.username = updateData.currentUsername;
    }
    // 资料更新接口不接受密码字段，改密请走 /api/user/change-password
    delete updateData.password;

    const user = await userManager.updateUser(userId, updateData);

    if (!user) {
      return NextResponse.json(
        { error: '更新用户信息失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
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
      hasPassword: Boolean(user.password),
    });
  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json(
      { error: '更新用户信息失败' },
      { status: 500 }
    );
  }
}
