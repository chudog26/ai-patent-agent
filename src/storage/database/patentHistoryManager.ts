import { desc, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  patentHistories,
  insertPatentHistorySchema,
} from "./shared/schema";
import type { PatentHistory, InsertPatentHistory } from "./shared/schema";

export class PatentHistoryManager {
  /**
   * 创建专利历史记录
   */
  async createPatentHistory(
    data: InsertPatentHistory
  ): Promise<PatentHistory> {
    const db = await getDb();
    const validated = insertPatentHistorySchema.parse(data);
    const [history] = await db
      .insert(patentHistories)
      .values(validated)
      .returning();
    return history;
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    id: string,
    status: 'pending' | 'generating' | 'completed' | 'failed',
    updates?: Partial<PatentHistory> & {
      progress?: number;
      currentStage?: string;
      errorMessage?: string;
      completedAt?: Date;
      executionLog?: Array<{ time: string; message: string; isCurrent?: boolean }>;
    }
  ): Promise<PatentHistory | null> {
    const db = await getDb();

    // 如果要更新的状态是 generating，先检查任务当前状态
    // 防止已完成的任务被改回 generating 状态
    if (status === 'generating') {
      const [current] = await db
        .select({ status: patentHistories.status })
        .from(patentHistories)
        .where(eq(patentHistories.id, id));

      if (current && (current.status === 'completed' || current.status === 'failed')) {
        console.log(`任务 ${id} 已完成或失败，跳过状态更新 (当前状态: ${current.status})`);
        // 不更新状态，但仍然可以更新其他字段（如进度）
        if (updates && Object.keys(updates).length > 0) {
          const [history] = await db
            .update(patentHistories)
            .set(updates)
            .where(eq(patentHistories.id, id))
            .returning();
          return history || null;
        }
        return null;
      }
    }

    const [history] = await db
      .update(patentHistories)
      .set({
        status,
        ...updates,
        ...(status === 'completed' && !updates?.completedAt ? { completedAt: new Date() } : {}),
      })
      .where(eq(patentHistories.id, id))
      .returning();
    return history || null;
  }

  /**
   * 更新生成的内容
   */
  async updateGeneratedContent(
    id: string,
    content: {
      patentTitle?: string;
      summaryTitle?: string;
      summaryContent?: string;
      descriptionTitle?: string;
      descriptionContent?: string;
      drawingsTitle?: string;
      drawingsContent?: string;
      drawingsImages?: string[];
      claimsTitle?: string;
      claimsContent?: string;
      references?: Array<{ text: string; url?: string }>;
    }
  ): Promise<PatentHistory | null> {
    const db = await getDb();
    const [history] = await db
      .update(patentHistories)
      .set(content)
      .where(eq(patentHistories.id, id))
      .returning();
    return history || null;
  }

  /**
   * 获取正在执行的任务
   */
  async getActiveTasks(userId: string): Promise<PatentHistory[]> {
    const db = await getDb();
    return db
      .select()
      .from(patentHistories)
      .where(and(
        eq(patentHistories.userId, userId),
        eq(patentHistories.status, 'generating')
      ))
      .orderBy(desc(patentHistories.createdAt));
  }

  /**
   * 获取所有专利历史记录（按创建时间倒序）
   */
  async getAllPatentHistories(
    limit: number = 50,
    offset: number = 0
  ): Promise<PatentHistory[]> {
    const db = await getDb();
    return db
      .select()
      .from(patentHistories)
      .orderBy(desc(patentHistories.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * 根据用户ID获取专利历史记录（按创建时间倒序）
   */
  async getPatentHistoriesByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PatentHistory[]> {
    const db = await getDb();
    return db
      .select()
      .from(patentHistories)
      .where(eq(patentHistories.userId, userId))
      .orderBy(desc(patentHistories.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * 根据 ID 获取专利历史记录
   */
  async getPatentHistoryById(id: string): Promise<PatentHistory | null> {
    const db = await getDb();
    const [history] = await db
      .select()
      .from(patentHistories)
      .where(eq(patentHistories.id, id));
    return history || null;
  }

  /**
   * 删除专利历史记录
   */
  async deletePatentHistory(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db
      .delete(patentHistories)
      .where(eq(patentHistories.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const patentHistoryManager = new PatentHistoryManager();
