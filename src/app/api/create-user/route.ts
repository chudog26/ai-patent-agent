import { NextRequest, NextResponse } from 'next/server';
import { generateDefaultUser } from '@/lib/defaultUser';

/**
 * 创建新用户（自动分配 ai 序号）
 */
export async function POST() {
  try {
    // 使用默认用户生成函数，按序号创建用户
    const user = await generateDefaultUser();

    if (!user) {
      return NextResponse.json(
        { error: '创建用户失败' },
        { status: 500 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: '创建用户失败' },
      { status: 500 }
    );
  }
}
