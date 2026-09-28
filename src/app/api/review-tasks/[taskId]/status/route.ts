import { NextRequest, NextResponse } from 'next/server';
import { reviewManager } from '@/storage/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    // 检查用户认证
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    // 获取审查任务
    const review = await reviewManager.getReviewById(taskId);

    if (!review) {
      return NextResponse.json(
        { error: '审查任务不存在' },
        { status: 404 }
      );
    }

    // 验证用户权限
    if (review.userId !== userId) {
      return NextResponse.json(
        { error: '无权访问此审查任务' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      taskId: review.id,
      status: review.status,
      progress: review.progress,
      currentStage: review.currentStage,
      errorMessage: review.errorMessage,
      reviewResult: review.reviewResult,
      completedAt: review.completedAt,
      createdAt: review.createdAt,
    });
  } catch (error) {
    console.error('Get review status error:', error);
    return NextResponse.json(
      { error: '获取审查状态失败' },
      { status: 500 }
    );
  }
}
