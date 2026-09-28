import { NextRequest, NextResponse } from 'next/server';
import { userManager } from '@/storage/database';

/**
 * 更新用户信息（管理员）
 *
 * 若请求体带 password，则视为「重置密码」，由 userManager 散列后入库；
 * 响应不回传密码（散列不可还原），管理端只提示「重置成功」。
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 验证用户是否存在
    const existingUser = await userManager.getUserById(id);
    if (!existingUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 如果要修改用户名，检查新用户名是否已被占用
    if (body.username && body.username !== existingUser.username) {
      const usernameCheck = await userManager.getUserByUsername(body.username);
      if (usernameCheck && usernameCheck.id !== id) {
        return NextResponse.json(
          { error: '用户名已存在' },
          { status: 400 }
        );
      }
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {};

    if (body.username !== undefined) updateData.username = body.username;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.position !== undefined) updateData.position = body.position;
    if (body.role !== undefined) updateData.role = body.role;
    if (typeof body.password === 'string' && body.password.trim() !== '') {
      updateData.password = body.password;
    }

    // 更新用户信息
    const user = await userManager.updateUser(id, updateData);

    if (!user) {
      return NextResponse.json(
        { error: '更新用户信息失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '用户信息更新成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        company: user.company,
        position: user.position,
        role: user.role,
        hasPassword: Boolean(user.password),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: '更新用户信息失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除用户（管理员）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 验证用户是否存在
    const existingUser = await userManager.getUserById(id);
    if (!existingUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 删除用户
    const result = await userManager.deleteUser(id);

    if (!result) {
      return NextResponse.json(
        { error: '删除用户失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '用户已删除',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    );
  }
}
