import { getDb } from '@/lib/db';
import { llmConfigs } from './shared/schema';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/crypto';
import type { Capability, ResolvedProvider } from '@/lib/ai/types';
import { findPreset } from '@/lib/ai/presets';

export interface ProviderConfigInput {
  name: string;
  capability: Capability;
  provider: string;
  model: string;
  baseUrl?: string | null;
  /** 明文密钥；传 undefined 表示不修改既有值 */
  apiKey?: string | null;
  temperature?: string | null;
  maxTokens?: number | null;
  description?: string | null;
  /** null / 不传 = 全局配置；有值 = 该用户的 BYOK 配置 */
  userId?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
}

/** 返回给前端的视图对象，密钥一律脱敏 */
export interface ProviderConfigView {
  id: string;
  name: string;
  capability: Capability;
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  temperature: string;
  maxTokens: number | null;
  description: string;
  scope: 'global' | 'user';
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

type ConfigRow = typeof llmConfigs.$inferSelect;

function toView(row: ConfigRow): ProviderConfigView {
  const plainKey = decryptSecret(row.apiKey);
  return {
    id: row.id,
    name: row.name,
    capability: row.capability,
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl ?? '',
    apiKeyMasked: maskSecret(plainKey),
    hasApiKey: Boolean(plainKey),
    temperature: row.temperature ?? '0.7',
    maxTokens: row.maxTokens ?? null,
    description: row.description ?? '',
    scope: row.userId ? 'user' : 'global',
    isActive: row.isActive,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 把数据库行转换成可直接发起请求的配置 */
export function toResolvedProvider(
  row: ConfigRow,
  source: 'user' | 'global'
): ResolvedProvider {
  const preset = findPreset(row.capability, row.provider);

  return {
    id: row.id,
    name: row.name,
    capability: row.capability,
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl || preset?.baseUrl || '',
    apiKey: decryptSecret(row.apiKey),
    temperature: row.temperature ? parseFloat(row.temperature) : undefined,
    maxTokens: row.maxTokens ?? null,
    source,
  };
}

/**
 * 用户可自行修正的配置冲突（重名、默认项重复……）。
 * 路由层据此返回 400 + 可读提示，而不是把驱动层的 SQL 文本抛给前端。
 */
export class ConfigConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigConflictError';
  }
}

interface PgErrorInfo {
  /** 沿 cause 链收集到的全部文本（驱动层把原始报错包在上层 message 里，约束名往往只出现在下层） */
  text: string;
  /** PostgreSQL SQLSTATE，唯一约束冲突为 23505 */
  code?: string;
  /** 触发冲突的约束/索引名 */
  constraint?: string;
}

/**
 * 沿 error.cause 逐层下钻，把 Drizzle 包装层与 pg 原生错误的信息合并起来。
 * Drizzle 只会在最外层 message 里打印 SQL 与参数，约束名保存在 cause.constraint，
 * 因此必须递归取值，否则「重名」这类冲突永远匹配不到。
 */
function collectPgError(error: unknown): PgErrorInfo {
  const parts: string[] = [];
  let code: string | undefined;
  let constraint: string | undefined;
  const seen = new Set<unknown>();

  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const node = current as {
      message?: unknown;
      code?: unknown;
      constraint?: unknown;
      detail?: unknown;
      cause?: unknown;
    };
    if (typeof node.message === 'string') parts.push(node.message);
    if (typeof node.detail === 'string') parts.push(node.detail);
    if (code === undefined && typeof node.code === 'string' && /^[0-9A-Z]{5}$/.test(node.code)) {
      code = node.code;
    }
    if (constraint === undefined && typeof node.constraint === 'string') {
      constraint = node.constraint;
    }
    current = node.cause;
  }

  if (parts.length === 0) parts.push(String(error));
  return { text: parts.join('\n'), code, constraint };
}

/** 把唯一约束冲突翻译成人话 */
function describeDbError(error: unknown): Error {
  const { text, code, constraint } = collectPgError(error);

  const isNameConflict =
    constraint === 'uq_llm_configs_scope_name' || text.includes('uq_llm_configs_scope_name');
  if (isNameConflict) {
    return new ConfigConflictError('同一层级下已存在同名配置，请换一个名称。');
  }

  const isDefaultConflict =
    constraint === 'uq_llm_configs_scope_capability_default' ||
    text.includes('uq_llm_configs_scope_capability_default');
  if (isDefaultConflict) {
    return new ConfigConflictError('该层级下这门能力已经有默认配置了，请先取消原默认。');
  }

  // 兜底：其他唯一约束冲突（例如未来新增的索引），仍按冲突处理，不泄露 SQL
  if (code === '23505') {
    return new ConfigConflictError('已存在重复的配置，请检查名称与默认项后重试。');
  }

  return error instanceof Error ? error : new Error(text);
}

export const providerManager = {
  /** 获取全局配置（管理员视角） */
  async listGlobalConfigs(): Promise<ProviderConfigView[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(llmConfigs)
      .where(isNull(llmConfigs.userId))
      .orderBy(asc(llmConfigs.capability), desc(llmConfigs.isDefault), asc(llmConfigs.name));
    return rows.map(toView);
  },

  /** 获取某个用户自带的配置 */
  async listUserConfigs(userId: string): Promise<ProviderConfigView[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(llmConfigs)
      .where(eq(llmConfigs.userId, userId))
      .orderBy(asc(llmConfigs.capability), desc(llmConfigs.isDefault), asc(llmConfigs.name));
    return rows.map(toView);
  },

  /** 判断某个能力是否已有可用的全局配置（用于给用户提示） */
  async hasGlobalConfig(capability: Capability): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .select({ id: llmConfigs.id })
      .from(llmConfigs)
      .where(
        and(
          isNull(llmConfigs.userId),
          eq(llmConfigs.capability, capability),
          eq(llmConfigs.isActive, true)
        )
      )
      .limit(1);
    return rows.length > 0;
  },

  async getConfigById(id: string): Promise<ConfigRow | null> {
    const db = getDb();
    const [row] = await db.select().from(llmConfigs).where(eq(llmConfigs.id, id)).limit(1);
    return row ?? null;
  },

  async createConfig(input: ProviderConfigInput): Promise<ProviderConfigView> {
    const db = getDb();
    const userId = input.userId ?? null;

    try {
      return await db.transaction(async (tx) => {
        // 同作用域同能力只能有一个默认
        if (input.isDefault) {
          await tx
            .update(llmConfigs)
            .set({ isDefault: false })
            .where(
              and(
                userId ? eq(llmConfigs.userId, userId) : isNull(llmConfigs.userId),
                eq(llmConfigs.capability, input.capability)
              )
            );
        }

        const [created] = await tx
          .insert(llmConfigs)
          .values({
            name: input.name,
            capability: input.capability,
            provider: input.provider,
            model: input.model,
            baseUrl: input.baseUrl || null,
            apiKey: input.apiKey ? encryptSecret(input.apiKey) : null,
            temperature: input.temperature || '0.7',
            maxTokens: input.maxTokens ?? null,
            description: input.description || null,
            userId,
            isActive: input.isActive ?? true,
            isDefault: input.isDefault ?? false,
          })
          .returning();

        return toView(created);
      });
    } catch (error) {
      throw describeDbError(error);
    }
  },

  async updateConfig(
    id: string,
    input: Partial<ProviderConfigInput>
  ): Promise<ProviderConfigView | null> {
    const db = getDb();
    const existing = await this.getConfigById(id);
    if (!existing) return null;

    const capability = input.capability ?? existing.capability;
    const scopeUserId =
      input.userId !== undefined ? input.userId : existing.userId;

    try {
      return await db.transaction(async (tx) => {
        if (input.isDefault) {
          await tx
            .update(llmConfigs)
            .set({ isDefault: false })
            .where(
              and(
                scopeUserId ? eq(llmConfigs.userId, scopeUserId) : isNull(llmConfigs.userId),
                eq(llmConfigs.capability, capability),
                sql`${llmConfigs.id} <> ${id}`
              )
            );
        }

        const patch: Partial<typeof llmConfigs.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (input.name !== undefined) patch.name = input.name;
        if (input.capability !== undefined) patch.capability = input.capability;
        if (input.provider !== undefined) patch.provider = input.provider;
        if (input.model !== undefined) patch.model = input.model;
        if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl || null;
        if (input.temperature !== undefined) patch.temperature = input.temperature || '0.7';
        if (input.maxTokens !== undefined) patch.maxTokens = input.maxTokens ?? null;
        if (input.description !== undefined) patch.description = input.description || null;
        if (input.userId !== undefined) patch.userId = input.userId;
        if (input.isActive !== undefined) patch.isActive = input.isActive;
        if (input.isDefault !== undefined) patch.isDefault = input.isDefault;

        // 只有显式传了非空字符串才更新密钥；空串视为「保留原值」
        if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
          patch.apiKey = encryptSecret(input.apiKey.trim());
        }

        const [updated] = await tx
          .update(llmConfigs)
          .set(patch)
          .where(eq(llmConfigs.id, id))
          .returning();

        return toView(updated);
      });
    } catch (error) {
      throw describeDbError(error);
    }
  },

  async deleteConfig(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(llmConfigs)
      .where(eq(llmConfigs.id, id))
      .returning({ id: llmConfigs.id });
    return result.length > 0;
  },

  /** 校验某条配置归属（防止用户改到别人的配置） */
  async isOwnedBy(id: string, userId: string | null): Promise<boolean> {
    const row = await this.getConfigById(id);
    if (!row) return false;
    return (row.userId ?? null) === (userId ?? null);
  },

  /**
   * 解析某用户在某能力上实际生效的配置。
   * 优先级：用户自带的默认配置 → 用户任意自带的配置 → 全局默认 → 全局任意可用配置。
   */
  async resolveEffective(
    capability: Capability,
    userId?: string | null
  ): Promise<ResolvedProvider | null> {
    const db = getDb();

    if (userId) {
      const userRows = await db
        .select()
        .from(llmConfigs)
        .where(
          and(
            eq(llmConfigs.userId, userId),
            eq(llmConfigs.capability, capability),
            eq(llmConfigs.isActive, true)
          )
        )
        .orderBy(desc(llmConfigs.isDefault), desc(llmConfigs.updatedAt))
        .limit(1);

      if (userRows[0]) {
        return toResolvedProvider(userRows[0], 'user');
      }
    }

    const globalRows = await db
      .select()
      .from(llmConfigs)
      .where(
        and(
          isNull(llmConfigs.userId),
          eq(llmConfigs.capability, capability),
          eq(llmConfigs.isActive, true)
        )
      )
      .orderBy(desc(llmConfigs.isDefault), desc(llmConfigs.updatedAt))
      .limit(1);

    if (globalRows[0]) {
      return toResolvedProvider(globalRows[0], 'global');
    }

    return null;
  },
};
