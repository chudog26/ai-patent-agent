import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// 用户表
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    username: varchar("username", { length: 100 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    company: varchar("company", { length: 200 }),
    position: varchar("position", { length: 100 }),
    role: varchar("role", { length: 20 }).default("user").notNull(), // user, admin
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 索引
  })
);

// 专利生成历史记录表
export const patentHistories = pgTable(
  "patent_histories",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    field: text("field"),
    background: text("background"),
    content: text("content").notNull(),
    solution: text("solution"),
    generatedContent: text("generated_content").notNull(),
    // 分节存储
    patentTitle: varchar("patent_title", { length: 512 }),
    summaryTitle: varchar("summary_title", { length: 100 }),
    summaryContent: text("summary_content"),
    descriptionTitle: varchar("description_title", { length: 100 }),
    descriptionContent: text("description_content"),
    drawingsTitle: varchar("drawings_title", { length: 100 }),
    drawingsContent: text("drawings_content"),
    drawingsImages: jsonb("drawings_images").$type<string[]>(),
    claimsTitle: varchar("claims_title", { length: 100 }),
    claimsContent: text("claims_content"),
    // 参考来源
    references: jsonb("references").$type<Array<{ text: string; url?: string }>>(),
    // 执行记录
    executionLog: jsonb("execution_log").$type<Array<{ time: string; message: string; isCurrent?: boolean }>>(),
    // 任务管理
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, generating, completed, failed
    progress: integer("progress").default(0).notNull(),
    currentStage: varchar("current_stage", { length: 100 }),
    errorMessage: text("error_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 索引
  })
);

// 专利审查历史记录表
export const patentReviews = pgTable(
  "patent_reviews",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar("title", { length: 512 }), // 审查标题（可从内容提取）
    content: text("content").notNull(), // 审查的专利内容
    reviewResult: jsonb("review_result"), // 审查结果JSON
    // 任务管理
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, reviewing, completed, failed
    progress: integer("progress").default(0).notNull(),
    currentStage: varchar("current_stage", { length: 100 }),
    errorMessage: text("error_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 索引
  })
);

// 专利灵感分类表
export const inspirationCategories = pgTable(
  "inspiration_categories",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull().unique(),
    icon: varchar("icon", { length: 50 }).notNull(),
    description: text("description").notNull(),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 索引
  })
);

// 专利灵感内容表
export const patentInspirations = pgTable(
  "patent_inspirations",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    categoryId: varchar("category_id", { length: 36 })
      .references(() => inspirationCategories.id)
      .notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    description: text("description").notNull(),
    rarity: integer("rarity").notNull().default(5), // 1-10，稀缺性值
    image: text("image"), // 图片URL
    tags: jsonb("tags").$type<string[]>(),
    status: varchar("status", { length: 20 }).default("published"), // published, draft
    favoritesCount: integer("favorites_count").notNull().default(0), // 收藏数量
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 索引
  })
);

// 灵感评论表
export const inspirationComments = pgTable(
  "inspiration_comments",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    inspirationId: varchar("inspiration_id", { length: 36 })
      .references(() => patentInspirations.id)
      .notNull(),
    content: text("content").notNull(),
    userId: varchar("user_id", { length: 36 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    username: varchar("username", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 索引
  })
);

// 使用 createSchemaFactory 配置 date coercion（处理前端 string → Date 转换）
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// AI 服务配置表
//   管理 chat（对话）/ search（联网搜索）/ image（图像生成）三类能力。
//   userId 为空 → 全局配置，由管理员维护，所有用户可用；
//   userId 有值 → 该用户自带的配置（BYOK），优先于全局配置生效。
//   apiKey 以 AES-256-GCM 加密存储，见 src/lib/crypto.ts
export const llmConfigs = pgTable(
  "llm_configs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(), // 配置名称
    capability: varchar("capability", { length: 20 })
      .$type<'chat' | 'search' | 'image'>()
      .notNull()
      .default('chat'),
    provider: varchar("provider", { length: 50 }).notNull().default('openai'),
    model: varchar("model", { length: 200 }).notNull().default(''), // 模型名称
    baseUrl: varchar("base_url", { length: 500 }), // 接口地址
    apiKey: text("api_key"), // 加密后的密钥
    temperature: varchar("temperature", { length: 10 }).default("0.7"), // 温度参数
    maxTokens: integer("max_tokens"), // 最大token数
    description: text("description"), // 配置描述
    userId: varchar("user_id", { length: 36 }).references(() => users.id, {
      onDelete: 'cascade',
    }), // 为空表示全局配置
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false), // 同作用域同能力只允许一个
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // 同一作用域内配置名不重复（全局配置的 user_id 为 NULL，用 COALESCE 归一化）
    uniqueIndex("uq_llm_configs_scope_name").on(
      sql`COALESCE(${table.userId}, '')`,
      table.name
    ),
    // 每个作用域 + 能力只允许一个默认配置
    uniqueIndex("uq_llm_configs_scope_capability_default")
      .on(sql`COALESCE(${table.userId}, '')`, table.capability)
      .where(sql`${table.isDefault} = true`),
    index("idx_llm_configs_resolve").on(
      table.capability,
      table.userId,
      table.isActive
    ),
  ]
);

// Zod schemas for validation - AI 服务配置
export const insertLLMConfigSchema = createCoercedInsertSchema(llmConfigs).pick({
  name: true,
  capability: true,
  provider: true,
  model: true,
  baseUrl: true,
  apiKey: true,
  temperature: true,
  maxTokens: true,
  description: true,
  userId: true,
  isActive: true,
  isDefault: true,
});

// TypeScript types
export type LLMConfig = typeof llmConfigs.$inferSelect;
export type InsertLLMConfig = z.infer<typeof insertLLMConfigSchema>;

// Zod schemas for validation - 用户
export const insertUserSchema = createCoercedInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  phone: true,
  company: true,
  position: true,
  role: true,
});

// Zod schemas for validation - 用户更新
export const updateUserSchema = createCoercedInsertSchema(users).pick({
  email: true,
  phone: true,
  company: true,
  position: true,
}).partial();

// Zod schemas for validation - 专利历史
export const insertPatentHistorySchema = createCoercedInsertSchema(patentHistories).pick({
  userId: true,
  title: true,
  field: true,
  background: true,
  content: true,
  solution: true,
  generatedContent: true,
  patentTitle: true,
  summaryTitle: true,
  summaryContent: true,
  descriptionTitle: true,
  descriptionContent: true,
  drawingsTitle: true,
  drawingsContent: true,
  drawingsImages: true,
  claimsTitle: true,
  claimsContent: true,
  references: true,
  executionLog: true,
  status: true,
  progress: true,
  currentStage: true,
  errorMessage: true,
  completedAt: true,
});

// Zod schemas for validation - 灵感分类
export const insertInspirationCategorySchema = createCoercedInsertSchema(inspirationCategories).pick({
  name: true,
  icon: true,
  description: true,
  sortOrder: true,
});

// Zod schemas for validation - 专利灵感
export const insertPatentInspirationSchema = createCoercedInsertSchema(patentInspirations).pick({
  categoryId: true,
  title: true,
  description: true,
  rarity: true,
  image: true,
  tags: true,
  status: true,
  favoritesCount: true,
});

// Zod schemas for validation - 灵感评论
export const insertInspirationCommentSchema = createCoercedInsertSchema(inspirationComments).pick({
  inspirationId: true,
  content: true,
  userId: true,
  username: true,
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PatentHistory = typeof patentHistories.$inferSelect;
export type InsertPatentHistory = z.infer<typeof insertPatentHistorySchema>;
export type InspirationCategory = typeof inspirationCategories.$inferSelect;
export type InsertInspirationCategory = z.infer<typeof insertInspirationCategorySchema>;
export type PatentInspiration = typeof patentInspirations.$inferSelect;
export type InsertPatentInspiration = z.infer<typeof insertPatentInspirationSchema>;
export type InspirationComment = typeof inspirationComments.$inferSelect;
export type InsertInspirationComment = z.infer<typeof insertInspirationCommentSchema>;
