import { NextRequest, NextResponse } from 'next/server';
import { patentHistoryManager } from '@/storage/database';

// 获取当前用户的历史记录
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

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const histories = await patentHistoryManager.getPatentHistoriesByUserId(
      userId,
      limit,
      offset
    );

    return NextResponse.json(histories);
  } catch (error) {
    console.error('Error fetching patent histories:', error);
    return NextResponse.json(
      { error: '获取历史记录失败' },
      { status: 500 }
    );
  }
}
