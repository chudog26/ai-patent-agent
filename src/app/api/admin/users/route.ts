import { NextRequest, NextResponse } from 'next/server';
import { userManager } from '@/storage/database';
import { getDb } from '@/lib/db';
import { patentHistories, patentReviews } from '@/storage/database/shared/schema';
import { count, eq } from 'drizzle-orm';

/**
 * 获取所有用户列表（包含完整信息）
 *
 * 密码以散列存储、不可还原，故不下发；前端只展示 hasPassword 标记，
 * 「重置密码」通过 PUT /api/admin/users/[id] 提交新的明文密码完成。
 */
export async function GET() {
  try {
    const users = await userManager.getAllUsers();
    const db = await getDb();

    // 为每个用户统计专利编写和审查数量
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // 统计专利编写数量
        const [patentCountResult] = await db
          .select({ count: count() })
          .from(patentHistories)
          .where(eq(patentHistories.userId, user.id));

        // 统计专利审查数量
        const [reviewCountResult] = await db
          .select({ count: count() })
          .from(patentReviews)
          .where(eq(patentReviews.userId, user.id));

        return {
          id: user.id,
          username: user.username,
          hasPassword: Boolean(user.password),
          email: user.email,
          phone: user.phone,
          company: user.company,
          position: user.position,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          patentCount: patentCountResult?.count || 0,
          reviewCount: reviewCountResult?.count || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      users: usersWithStats,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    );
  }
}
