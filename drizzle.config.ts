import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit 配置（用于 pnpm db:push / db:studio）。
 * schema 的唯一事实来源是 src/storage/database/shared/schema.ts。
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/storage/database/shared/schema.ts',
  out: './sql/generated',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
