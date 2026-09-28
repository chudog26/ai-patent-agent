import { getDb } from '@/lib/db';
import {
  inspirationCategories,
  patentInspirations,
  inspirationComments,
  type InsertInspirationCategory,
  type InsertPatentInspiration,
  type InsertInspirationComment,
  type InspirationCategory,
  type PatentInspiration,
  type InspirationComment,
} from './shared/schema';
import { eq, desc, asc, sql } from 'drizzle-orm';

// 初始化默认分类
export const initializeDefaultCategories = async () => {
  const db = await getDb();

  const defaultCategories: InsertInspirationCategory[] = [
    { name: '家电类', icon: '🏠', description: '智能家居、白色家电等', sortOrder: 1 },
    { name: '医疗类', icon: '🏥', description: '医疗设备、健康监测等', sortOrder: 2 },
    { name: '电子类', icon: '📱', description: '消费电子、通讯设备等', sortOrder: 3 },
    { name: '机械类', icon: '⚙️', description: '工业机械、自动化设备等', sortOrder: 4 },
    { name: '软件类', icon: '💻', description: '计算机软件、AI应用等', sortOrder: 5 },
    { name: '环保类', icon: '🌱', description: '环保技术、新能源等', sortOrder: 6 },
  ];

  for (const category of defaultCategories) {
    const existing = await db
      .select()
      .from(inspirationCategories)
      .where(eq(inspirationCategories.name, category.name));

    if (existing.length === 0) {
      await db.insert(inspirationCategories).values(category);
    }
  }
};

// 获取所有分类
export const getCategories = async (): Promise<InspirationCategory[]> => {
  const db = await getDb();
  return db.select().from(inspirationCategories).orderBy(asc(inspirationCategories.sortOrder));
};

// 根据名称获取分类
export const getCategoryByName = async (name: string): Promise<InspirationCategory | null> => {
  const db = await getDb();
  const result = await db
    .select()
    .from(inspirationCategories)
    .where(eq(inspirationCategories.name, name));

  return result[0] || null;
};

// 根据ID获取分类
export const getCategoryById = async (id: string): Promise<InspirationCategory | null> => {
  const db = await getDb();
  const result = await db
    .select()
    .from(inspirationCategories)
    .where(eq(inspirationCategories.id, id));

  return result[0] || null;
};

// 创建新分类
export const createCategory = async (
  data: InsertInspirationCategory
): Promise<InspirationCategory> => {
  const db = await getDb();
  const result = await db.insert(inspirationCategories).values(data).returning();
  return result[0];
};

// 获取所有灵感（包含分类名称）
export const getInspirations = async (): Promise<PatentInspiration[]> => {
  const db = await getDb();
  return db
    .select()
    .from(patentInspirations)
    .orderBy(desc(patentInspirations.createdAt));
};

// 根据分类ID获取灵感
export const getInspirationsByCategory = async (
  categoryId: string
): Promise<PatentInspiration[]> => {
  const db = await getDb();
  return db
    .select()
    .from(patentInspirations)
    .where(eq(patentInspirations.categoryId, categoryId))
    .orderBy(desc(patentInspirations.createdAt));
};

// 根据分类名称获取灵感
export const getInspirationsByCategoryName = async (
  categoryName: string
): Promise<PatentInspiration[]> => {
  const category = await getCategoryByName(categoryName);
  if (!category) return [];

  return getInspirationsByCategory(category.id);
};

// 创建新灵感
export const createInspiration = async (
  data: InsertPatentInspiration
): Promise<PatentInspiration> => {
  const db = await getDb();
  // 生成随机收藏数量 (1-100)
  const favoritesCount = Math.floor(Math.random() * 100) + 1;
  const result = await db.insert(patentInspirations).values({
    ...data,
    favoritesCount,
  }).returning();
  return result[0];
};

// 批量创建灵感
export const createBulkInspirations = async (
  data: InsertPatentInspiration[]
): Promise<PatentInspiration[]> => {
  const db = await getDb();
  // 为每个灵感生成随机收藏数量
  const inspirationsWithFavorites = data.map(item => ({
    ...item,
    favoritesCount: Math.floor(Math.random() * 100) + 1,
  }));
  const result = await db.insert(patentInspirations).values(inspirationsWithFavorites).returning();
  return result;
};

// 更新灵感
export const updateInspiration = async (
  id: string,
  data: Partial<InsertPatentInspiration>
): Promise<PatentInspiration | null> => {
  const db = await getDb();
  const result = await db
    .update(patentInspirations)
    .set(data)
    .where(eq(patentInspirations.id, id))
    .returning();

  return result[0] || null;
};

// 删除灵感
export const deleteInspiration = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const result = await db
    .delete(patentInspirations)
    .where(eq(patentInspirations.id, id))
    .returning();

  return result.length > 0;
};

// 根据ID获取灵感
export const getInspirationById = async (id: string): Promise<PatentInspiration | null> => {
  const db = await getDb();
  const result = await db
    .select()
    .from(patentInspirations)
    .where(eq(patentInspirations.id, id));

  return result[0] || null;
};

// 增加收藏数
export const incrementFavorites = async (id: string): Promise<PatentInspiration | null> => {
  const db = await getDb();
  const result = await db
    .update(patentInspirations)
    .set({
      favoritesCount: sql`${patentInspirations.favoritesCount} + 1`
    })
    .where(eq(patentInspirations.id, id))
    .returning();

  return result[0] || null;
};

// 获取评论列表
export const getCommentsByInspiration = async (
  inspirationId: string
): Promise<InspirationComment[]> => {
  const db = await getDb();
  return db
    .select()
    .from(inspirationComments)
    .where(eq(inspirationComments.inspirationId, inspirationId))
    .orderBy(desc(inspirationComments.createdAt));
};

// 创建评论
export const createComment = async (
  data: InsertInspirationComment
): Promise<InspirationComment> => {
  const db = await getDb();
  const result = await db.insert(inspirationComments).values(data).returning();
  return result[0];
};

// 删除评论
export const deleteComment = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const result = await db
    .delete(inspirationComments)
    .where(eq(inspirationComments.id, id))
    .returning();

  return result.length > 0;
};

// 分页获取灵感
export const getInspirationsPaginated = async (
  page: number = 1,
  pageSize: number = 12
): Promise<{ data: PatentInspiration[]; total: number }> => {
  const db = await getDb();
  const offsetVal = (page - 1) * pageSize;

  const data = await db
    .select()
    .from(patentInspirations)
    .orderBy(desc(patentInspirations.createdAt))
    .limit(pageSize)
    .offset(offsetVal);

  // 获取总数
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(patentInspirations);

  // pg 的 count(*) 返回 bigint，node-postgres 给到的是字符串，这里统一转成数字，
  // 避免接口把 "2" 当成数字用（后续若有加减会变成字符串拼接）。
  const total = Number(totalResult[0]?.count ?? 0);

  return { data, total };
};

// 分页获取指定分类的灵感
export const getInspirationsByCategoryPaginated = async (
  categoryId: string,
  page: number = 1,
  pageSize: number = 12
): Promise<{ data: PatentInspiration[]; total: number }> => {
  const db = await getDb();
  const offsetVal = (page - 1) * pageSize;

  const data = await db
    .select()
    .from(patentInspirations)
    .where(eq(patentInspirations.categoryId, categoryId))
    .orderBy(desc(patentInspirations.createdAt))
    .limit(pageSize)
    .offset(offsetVal);

  // 获取总数
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(patentInspirations)
    .where(eq(patentInspirations.categoryId, categoryId));

  // pg 的 count(*) 返回 bigint，node-postgres 给到的是字符串，这里统一转成数字，
  // 避免接口把 "2" 当成数字用（后续若有加减会变成字符串拼接）。
  const total = Number(totalResult[0]?.count ?? 0);

  return { data, total };
};

// 根据分类名称分页获取灵感
export const getInspirationsByCategoryNamePaginated = async (
  categoryName: string,
  page: number = 1,
  pageSize: number = 12
): Promise<{ data: PatentInspiration[]; total: number }> => {
  const category = await getCategoryByName(categoryName);
  if (!category) return { data: [], total: 0 };

  return getInspirationsByCategoryPaginated(category.id, page, pageSize);
};
