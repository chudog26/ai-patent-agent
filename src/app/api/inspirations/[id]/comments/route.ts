import { NextRequest, NextResponse } from 'next/server';
import {
  getCommentsByInspiration,
  createComment,
} from '@/storage/database/inspirationManager';
import { insertInspirationCommentSchema } from '@/storage/database/shared/schema';
import { getValidationIssues, validationErrorMessage } from '@/lib/api-helpers';

// 获取评论列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const comments = await getCommentsByInspiration(id);
    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// 创建评论
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 验证数据
    const validatedData = insertInspirationCommentSchema.parse({
      ...body,
      inspirationId: id,
    });

    // 创建评论
    const comment = await createComment(validatedData);

    return NextResponse.json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    // 入参不合法属于调用方可修正的错误，返回 400 + 可读提示，而不是笼统的 500
    if (getValidationIssues(error)) {
      return NextResponse.json({ error: validationErrorMessage(error) }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
