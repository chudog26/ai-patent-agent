import { NextRequest, NextResponse } from 'next/server';
import { reviewManager } from '@/storage/database';

export async function GET(request: NextRequest) {
  try {
    // 检查用户认证
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    // 获取用户的历史记录
    const reviews = await reviewManager.getReviewsByUserId(userId, 50);

    // 返回简化后的数据
    const simplifiedReviews = reviews.map(review => ({
      id: review.id,
      title: review.title || '未命名审查',
      status: review.status,
      progress: review.progress,
      createdAt: review.createdAt,
      completedAt: review.completedAt,
    }));

    return NextResponse.json(simplifiedReviews);
  } catch (error) {
    console.error('Get review histories error:', error);
    return NextResponse.json(
      { error: '获取审查历史失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 检查用户认证
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: '请提供要删除的审查ID' },
        { status: 400 }
      );
    }

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
        { error: '无权删除此审查记录' },
        { status: 403 }
      );
    }

    // 删除记录
    await reviewManager.deleteReview(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete review error:', error);
    return NextResponse.json(
      { error: '删除审查记录失败' },
      { status: 500 }
    );
  }
}
