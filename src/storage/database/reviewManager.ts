import { eq, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { patentReviews } from './shared/schema';

export interface ReviewRecord {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  reviewResult: any | null;
  status: 'pending' | 'reviewing' | 'completed' | 'failed';
  progress: number;
  currentStage: string | null;
  errorMessage: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

export const reviewManager = {
  // 创建审查记录
  async createReview(
    userId: string,
    content: string,
    title?: string
  ): Promise<string> {
    const db = await getDb();
    const [review] = await db
      .insert(patentReviews)
      .values({
        userId,
        content,
        title: title || null,
        status: 'pending',
        progress: 0,
      })
      .returning();

    return review.id;
  },

  // 更新审查状态
  async updateReviewStatus(
    id: string,
    updates: Partial<{
      status: 'pending' | 'reviewing' | 'completed' | 'failed';
      progress: number;
      currentStage: string;
      errorMessage: string;
      completedAt: Date;
      reviewResult: any;
    }>
  ): Promise<void> {
    const db = await getDb();

    // 如果要更新的状态是 reviewing，先检查任务当前状态
    // 防止已完成的任务被改回 reviewing 状态
    if (updates.status === 'reviewing') {
      const [current] = await db
        .select({ status: patentReviews.status })
        .from(patentReviews)
        .where(eq(patentReviews.id, id));

      if (current && (current.status === 'completed' || current.status === 'failed')) {
        console.log(`审查任务 ${id} 已完成或失败，跳过状态更新 (当前状态: ${current.status})`);
        // 不更新状态，但仍然可以更新其他字段（如进度）
        const { status, ...otherUpdates } = updates;
        if (Object.keys(otherUpdates).length > 0) {
          await db
            .update(patentReviews)
            .set(otherUpdates)
            .where(eq(patentReviews.id, id));
        }
        return;
      }
    }

    await db
      .update(patentReviews)
      .set(updates)
      .where(eq(patentReviews.id, id));
  },

  // 获取审查记录
  async getReviewById(id: string): Promise<ReviewRecord | null> {
    const db = await getDb();
    const [review] = await db
      .select()
      .from(patentReviews)
      .where(eq(patentReviews.id, id));

    if (!review) return null;
    return review as ReviewRecord;
  },

  // 获取用户的审查历史列表
  async getReviewsByUserId(userId: string, limit: number = 50): Promise<ReviewRecord[]> {
    const db = await getDb();
    const reviews = await db
      .select()
      .from(patentReviews)
      .where(eq(patentReviews.userId, userId))
      .orderBy(desc(patentReviews.createdAt))
      .limit(limit);
    return reviews as ReviewRecord[];
  },

  // 删除审查记录
  async deleteReview(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(patentReviews).where(eq(patentReviews.id, id));
  },

  // 获取用户未完成的审查任务
  async getPendingReviewsByUserId(userId: string): Promise<ReviewRecord[]> {
    const db = await getDb();
    const reviews = await db
      .select()
      .from(patentReviews)
      .where(eq(patentReviews.userId, userId));
    
    // 在应用层过滤status
    return reviews.filter(r => r.status === 'reviewing') as ReviewRecord[];
  },
};
