import { NextRequest, NextResponse } from 'next/server';
import {
  getInspirations,
  getInspirationsByCategory,
  getInspirationsPaginated,
  getInspirationsByCategoryPaginated,
  initializeDefaultCategories,
  getCategoryById,
  getCategoryByName,
  createInspiration,
} from '@/storage/database/inspirationManager';
import { insertPatentInspirationSchema } from '@/storage/database/shared/schema';
import { getValidationIssues, validationErrorMessage } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  try {
    // 初始化默认分类（如果不存在）
    await initializeDefaultCategories();

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '12', 10);

    // 检查是否请求分页数据
    const usePagination = searchParams.get('pagination') === 'true';

    // 前端传的是分类 ID（UUID），这里按 ID 精确解析；为兼容旧调用也接受分类名称。
    // 解析不到时按「该分类下无数据」处理，而不是静默退化成查询全部。
    const wantsCategory = Boolean(category && category !== 'all');
    const categoryRecord = wantsCategory
      ? (await getCategoryById(String(category))) ?? (await getCategoryByName(String(category)))
      : null;

    let result;

    if (usePagination) {
      // 使用分页
      if (wantsCategory) {
        result = categoryRecord
          ? await getInspirationsByCategoryPaginated(categoryRecord.id, page, pageSize)
          : { data: [], total: 0 };
      } else {
        result = await getInspirationsPaginated(page, pageSize);
      }

      // 为每个灵感添加分类名称
      const inspirationsWithCategory = await Promise.all(
        result.data.map(async (item) => {
          const categoryData = await getCategoryById(item.categoryId);
          return {
            ...item,
            category: categoryData?.name || '',
          };
        })
      );

      return NextResponse.json({
        data: inspirationsWithCategory,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.ceil(result.total / pageSize),
        hasMore: page * pageSize < result.total,
      });
    } else {
      // 不使用分页（向后兼容）
      let inspirations;
      if (wantsCategory) {
        inspirations = categoryRecord
          ? await getInspirationsByCategory(categoryRecord.id)
          : [];
      } else {
        inspirations = await getInspirations();
      }

      // 为每个灵感添加分类名称
      const inspirationsWithCategory = await Promise.all(
        inspirations.map(async (item) => {
          const categoryData = await getCategoryById(item.categoryId);
          return {
            ...item,
            category: categoryData?.name || '',
          };
        })
      );

      return NextResponse.json(inspirationsWithCategory);
    }
  } catch (error) {
    console.error('Error fetching inspirations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspirations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证数据
    const validatedData = insertPatentInspirationSchema.parse(body);

    // 创建灵感
    const inspiration = await createInspiration(validatedData);

    return NextResponse.json(inspiration);
  } catch (error) {
    console.error('Error creating inspiration:', error);
    // 入参不合法返回 400，避免把调用方问题错报成服务端故障
    if (getValidationIssues(error)) {
      return NextResponse.json({ error: validationErrorMessage(error) }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create inspiration' },
      { status: 500 }
    );
  }
}
