import { NextRequest, NextResponse } from 'next/server';
import { reviewManager } from '@/storage/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 检查用户认证
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 获取审查记录
    const review = await reviewManager.getReviewById(id);
    if (!review) {
      return NextResponse.json(
        { error: '审查记录不存在' },
        { status: 404 }
      );
    }

    // 验证用户权限
    if (review.userId !== userId) {
      return NextResponse.json(
        { error: '无权查看此审查记录' },
        { status: 403 }
      );
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error('Get review by id error:', error);
    return NextResponse.json(
      { error: '获取审查记录失败' },
      { status: 500 }
    );
  }
}
