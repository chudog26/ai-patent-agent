import { NextRequest, NextResponse } from 'next/server';
import { patentHistoryManager } from '@/storage/database';

// 获取任务状态和已生成的内容
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      );
    }

    // 获取任务详情
    const task = await patentHistoryManager.getPatentHistoryById(taskId);

    if (!task) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    // 验证任务属于当前用户
    if (task.userId !== userId) {
      return NextResponse.json(
        { error: '无权访问此任务' },
        { status: 403 }
      );
    }

    // 返回任务状态和已生成的内容
    return NextResponse.json({
      id: task.id,
      status: task.status,
      progress: task.progress,
      currentStage: task.currentStage,
      errorMessage: task.errorMessage,
      completedAt: task.completedAt,

      // 已生成的内容
      patentTitle: task.patentTitle,
      summaryTitle: task.summaryTitle,
      summaryContent: task.summaryContent,
      descriptionTitle: task.descriptionTitle,
      descriptionContent: task.descriptionContent,
      drawingsTitle: task.drawingsTitle,
      drawingsContent: task.drawingsContent,
      drawingsImages: task.drawingsImages,
      claimsTitle: task.claimsTitle,
      claimsContent: task.claimsContent,
      references: task.references,
      executionLog: task.executionLog,
    });
  } catch (error) {
    console.error('Error fetching task status:', error);
    return NextResponse.json(
      { error: '获取任务状态失败' },
      { status: 500 }
    );
  }
}
