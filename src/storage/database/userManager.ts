import { eq, like, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, insertUserSchema } from "./shared/schema";
import type { User, InsertUser } from "./shared/schema";
import { ensureHashedPassword } from "@/lib/password";

/**
 * 用户数据访问。
 *
 * 安全约定：password 字段一律以 scrypt 散列存储，明文的读写都只发生在
 * 这一层的入口（写入时散列化）。上层拿到的 User.password 永远是散列值，
 * 只可用于校验，不可用于展示或回传客户端。
 */
export class UserManager {
  /**
   * 创建用户（入参密码统一散列化后落库）
   */
  async createUser(data: InsertUser): Promise<User> {
    const db = await getDb();
    const validated = insertUserSchema.parse(data);
    const [user] = await db
      .insert(users)
      .values({
        ...validated,
        password: await ensureHashedPassword(validated.password),
      })
      .returning();
    return user;
  }

  /**
   * 根据用户名获取用户
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || null;
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(id: string): Promise<User | null> {
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  /**
   * 更新用户密码（入参密码统一散列化后落库）
   */
  async updateUserPassword(id: string, newPassword: string): Promise<User | null> {
    const db = await getDb();
    const [user] = await db
      .update(users)
      .set({
        password: await ensureHashedPassword(newPassword),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user || null;
  }

  /**
   * 获取所有用户
   */
  async getAllUsers(): Promise<User[]> {
    const db = await getDb();
    return await db.select().from(users).orderBy(sql`${users.createdAt} DESC`);
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 更新用户信息。
   * 若补丁里带了密码，会先散列化；空密码视为「不修改」而非写入空串。
   */
  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const db = await getDb();
    const patch: Partial<User> = { ...data };

    if (typeof patch.password === 'string' && patch.password.trim() !== '') {
      patch.password = await ensureHashedPassword(patch.password);
    } else {
      delete patch.password;
    }

    const [user] = await db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || null;
  }

  /**
   * 获取下一个用户序号
   * 从符合格式的用户名中提取末尾的数字，返回最大数字 + 1
   * 支持格式：中文姓名1, 中文姓名2... 或旧格式 ai1, ai2...
   * 过滤掉异常大的数字（可能是错误数据）
   */
  async getNextAiUserIndex(): Promise<number> {
    const db = await getDb();

    // 获取所有用户
    const allUsers = await db
      .select({ username: users.username })
      .from(users);

    if (allUsers.length === 0) {
      return 1; // 如果没有用户，从 1 开始
    }

    // 提取符合格式的用户名中的末尾数字，并找到最大的
    let maxIndex = 0;
    const reasonableMax = 100000; // 合理的最大序号阈值，超过此值的可能是错误数据

    for (const user of allUsers) {
      const username = user.username;

      // 只处理以汉字开头或以"ai"开头的用户名
      const isChineseOrAi = /^[\u4e00-\u9fa5]/.test(username) || /^ai/.test(username);

      if (isChineseOrAi) {
        // 匹配用户名末尾的数字
        const match = username.match(/(\d+)$/);
        if (match) {
          const index = parseInt(match[1], 10);
          // 过滤掉异常大的数字
          if (index > maxIndex && index < reasonableMax) {
            maxIndex = index;
          }
        }
      }
    }

    return maxIndex + 1; // 返回下一个序号
  }

  /**
   * 获取或创建默认用户
   */
  async getOrCreateDefaultUser(): Promise<User> {
    const defaultUsername = 'default_user';
    let user = await this.getUserByUsername(defaultUsername);

    if (!user) {
      // 生成随机密码
      const randomPassword = this.generateRandomPassword();
      user = await this.createUser({
        username: defaultUsername,
        password: randomPassword,
      });
    }

    return user;
  }

  /**
   * 生成随机密码
   */
  private generateRandomPassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * 初始化默认管理员账户
   * 如果不存在admin用户，则创建默认管理员账户（用户名：admin，密码：admin）
   */
  async initializeDefaultAdmin(): Promise<User> {
    let user = await this.getUserByUsername('admin');

    if (!user) {
      user = await this.createUser({
        username: 'admin',
        password: 'admin',
        role: 'admin',
      });
    }

    return user;
  }
}

export const userManager = new UserManager();
