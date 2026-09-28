import { NextRequest, NextResponse } from 'next/server';
import {
  incrementFavorites,
  getCategoryById,
  getInspirationById,
} from '@/storage/database/inspirationManager';

// 获取单个灵感的详细信息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const inspiration = await getInspirationById(id);

    if (!inspiration) {
      return NextResponse.json(
        { error: 'Inspiration not found' },
        { status: 404 }
      );
    }

    // 获取分类名称
    const category = await getCategoryById(inspiration.categoryId);

    return NextResponse.json({
      ...inspiration,
      category: category?.name || '',
    });
  } catch (error) {
    console.error('Error fetching inspiration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspiration' },
      { status: 500 }
    );
  }
}

// 增加收藏数
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const inspiration = await incrementFavorites(id);

    if (!inspiration) {
      return NextResponse.json(
        { error: 'Inspiration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(inspiration);
  } catch (error) {
    console.error('Error incrementing favorites:', error);
    return NextResponse.json(
      { error: 'Failed to increment favorites' },
      { status: 500 }
    );
  }
}
