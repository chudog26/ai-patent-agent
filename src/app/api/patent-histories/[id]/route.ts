import { NextRequest, NextResponse } from 'next/server';
import { patentHistoryManager } from '@/storage/database';

// 删除历史记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await patentHistoryManager.deletePatentHistory(id);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: '记录不存在或删除失败' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error deleting patent history:', error);
    return NextResponse.json(
      { error: '删除历史记录失败' },
      { status: 500 }
    );
  }
}
