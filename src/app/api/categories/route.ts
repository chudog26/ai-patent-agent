import { NextRequest, NextResponse } from 'next/server';
import { getCategories, initializeDefaultCategories } from '@/storage/database/inspirationManager';

export async function GET(request: NextRequest) {
  try {
    // 初始化默认分类（如果不存在）
    await initializeDefaultCategories();

    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
