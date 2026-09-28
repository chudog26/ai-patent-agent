import { NextRequest, NextResponse } from 'next/server';
import { reviewManager } from '@/storage/database';

export async function POST(request: NextRequest) {
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
    const { content, title } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的专利内容' },
        { status: 400 }
      );
    }

    // 创建审查任务
    const taskId = await reviewManager.createReview(userId, content, title);

    // 更新任务状态为审查中
    await reviewManager.updateReviewStatus(taskId, {
      status: 'reviewing',
      progress: 0,
      currentStage: '准备审查',
    });

    return NextResponse.json({
      taskId,
      status: 'success',
    });
  } catch (error) {
    console.error('Create review task error:', error);
    return NextResponse.json(
      { error: '创建审查任务失败' },
      { status: 500 }
    );
  }
}
