import { NextRequest, NextResponse } from 'next/server';
import { patentHistoryManager } from '@/storage/database';

export async function POST(
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

    const body = await request.json();
    const { executionLog } = body;

    console.log('收到执行日志更新请求:', {
      taskId,
      executionLogLength: executionLog?.length,
      executionLogType: typeof executionLog,
      executionLogSample: executionLog ? executionLog.slice(0, 2) : null
    });

    if (!Array.isArray(executionLog)) {
      console.error('执行记录格式无效:', typeof executionLog);
      return NextResponse.json(
        { error: '无效的执行记录格式' },
        { status: 400 }
      );
    }

    // 更新任务状态
    const updated = await patentHistoryManager.updateTaskStatus(taskId, 'generating', {
      executionLog,
    });

    console.log('更新执行记录结果:', updated ? '成功' : '失败');

    if (!updated) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating execution log:', error);
    return NextResponse.json(
      { error: '更新执行记录失败' },
      { status: 500 }
    );
  }
}
