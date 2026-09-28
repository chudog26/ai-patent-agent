import { NextRequest, NextResponse } from 'next/server';
import { patentHistoryManager } from '@/storage/database';
import { getValidationIssues, validationErrorMessage } from '@/lib/api-helpers';

// 获取用户的活跃任务（正在执行的任务）
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      );
    }

    // 获取活跃任务
    const activeTasks = await patentHistoryManager.getActiveTasks(userId);

    return NextResponse.json(activeTasks);
  } catch (error) {
    console.error('Error fetching active tasks:', error);
    return NextResponse.json(
      { error: '获取活跃任务失败' },
      { status: 500 }
    );
  }
}

// 创建新任务
export async function POST(request: NextRequest) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, field, background, content, solution } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: '发明名称和发明内容为必填项' },
        { status: 400 }
      );
    }

    // 创建任务记录（初始状态为 pending）
    const task = await patentHistoryManager.createPatentHistory({
      userId,
      title,
      field: field || '',
      background: background || '',
      content,
      solution: solution || '',
      generatedContent: '',
      status: 'pending',
      progress: 0,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error creating patent task:', error);
    if (getValidationIssues(error)) {
      return NextResponse.json({ error: validationErrorMessage(error) }, { status: 400 });
    }
    return NextResponse.json(
      { error: '创建任务失败' },
      { status: 500 }
    );
  }
}
