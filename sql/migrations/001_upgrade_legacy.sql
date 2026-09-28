-- =============================================================================
-- 旧版数据库 → 当前版本的增量升级脚本
--
-- 适用场景：你的库是早期版本建的、里面已有数据，不想重建，
--           只想补齐当前版本需要的字段与索引。
--
-- 全新部署请直接用 sql/init.sql，不要执行本文件。
--
-- 执行方式：psql "$DATABASE_URL" -f sql/migrations/001_upgrade_legacy.sql
-- 脚本幂等，可重复执行。
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. patent_histories 补齐任务管理 / 分节 / 执行日志字段
-- -----------------------------------------------------------------------------
ALTER TABLE patent_histories
  ADD COLUMN IF NOT EXISTS patent_title        VARCHAR(512),
  ADD COLUMN IF NOT EXISTS summary_title       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS summary_content     TEXT,
  ADD COLUMN IF NOT EXISTS description_title   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description_content TEXT,
  ADD COLUMN IF NOT EXISTS drawings_title      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS drawings_content    TEXT,
  ADD COLUMN IF NOT EXISTS drawings_images     JSONB,
  ADD COLUMN IF NOT EXISTS claims_title        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS claims_content      TEXT,
  ADD COLUMN IF NOT EXISTS "references"        JSONB,
  ADD COLUMN IF NOT EXISTS execution_log       JSONB,
  ADD COLUMN IF NOT EXISTS status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS progress            INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_stage       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS error_message       TEXT,
  ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 2. 补齐老版本可能缺失的表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patent_reviews (
  id             VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(512),
  content        TEXT         NOT NULL,
  review_result  JSONB,
  status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
  progress       INTEGER      NOT NULL DEFAULT 0,
  current_stage  VARCHAR(100),
  error_message  TEXT,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspiration_categories (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  icon        VARCHAR(50)  NOT NULL,
  description TEXT         NOT NULL,
  sort_order  INTEGER      DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patent_inspirations (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     VARCHAR(36)  NOT NULL REFERENCES inspiration_categories(id),
  title           VARCHAR(512) NOT NULL,
  description     TEXT         NOT NULL,
  rarity          INTEGER      NOT NULL DEFAULT 5,
  image           TEXT,
  tags            JSONB,
  status          VARCHAR(20)  DEFAULT 'published',
  favorites_count INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE patent_inspirations
  ADD COLUMN IF NOT EXISTS favorites_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS inspiration_comments (
  id             VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  inspiration_id VARCHAR(36)  NOT NULL REFERENCES patent_inspirations(id) ON DELETE CASCADE,
  content        TEXT         NOT NULL,
  user_id        VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  username       VARCHAR(100) NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. llm_configs 升级为「AI 服务配置」
--    旧结构只支持单一 chat 模型，新结构区分 capability 并支持用户级 BYOK。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_configs (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  capability  VARCHAR(20)  NOT NULL DEFAULT 'chat',
  provider    VARCHAR(50)  NOT NULL DEFAULT 'openai',
  model       VARCHAR(200) NOT NULL DEFAULT '',
  base_url    VARCHAR(500),
  api_key     TEXT,
  temperature VARCHAR(10)  DEFAULT '0.7',
  max_tokens  INTEGER,
  description TEXT,
  user_id     VARCHAR(36)  REFERENCES users(id) ON DELETE CASCADE,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE llm_configs
  ADD COLUMN IF NOT EXISTS capability  VARCHAR(20)  NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS provider    VARCHAR(50)  NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS base_url    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS api_key     TEXT,
  ADD COLUMN IF NOT EXISTS user_id     VARCHAR(36)  REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN      NOT NULL DEFAULT TRUE;

ALTER TABLE llm_configs
  ALTER COLUMN model TYPE VARCHAR(200);

-- 旧版本对 name 加了全局唯一约束，会阻止不同用户使用同名配置
ALTER TABLE llm_configs DROP CONSTRAINT IF EXISTS llm_configs_name_key;
DROP INDEX IF EXISTS llm_configs_name_unique;

-- 旧数据统一视为 chat 能力的全局配置
UPDATE llm_configs
   SET capability = 'chat'
 WHERE capability IS NULL OR capability = '';

UPDATE llm_configs
   SET provider = 'openai'
 WHERE provider IS NULL OR provider = '';

-- -----------------------------------------------------------------------------
-- 4. 索引
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_patent_histories_user_created
  ON patent_histories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patent_histories_status
  ON patent_histories (status);
CREATE INDEX IF NOT EXISTS idx_patent_reviews_user_created
  ON patent_reviews (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patent_reviews_status
  ON patent_reviews (status);
CREATE INDEX IF NOT EXISTS idx_patent_inspirations_category
  ON patent_inspirations (category_id);
CREATE INDEX IF NOT EXISTS idx_inspiration_comments_inspiration
  ON inspiration_comments (inspiration_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_configs_scope_name
  ON llm_configs (COALESCE(user_id, ''), name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_configs_scope_capability_default
  ON llm_configs (COALESCE(user_id, ''), capability)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_llm_configs_resolve
  ON llm_configs (capability, user_id, is_active);

-- -----------------------------------------------------------------------------
-- 5. 种子数据
-- -----------------------------------------------------------------------------
INSERT INTO inspiration_categories (name, icon, description, sort_order) VALUES
  ('家电类', '🏠', '智能家居、白色家电等', 1),
  ('医疗类', '🏥', '医疗设备、健康监测等', 2),
  ('电子类', '📱', '消费电子、通讯设备等', 3),
  ('机械类', '⚙️', '工业机械、自动化设备等', 4),
  ('软件类', '💻', '计算机软件、AI应用等', 5),
  ('环保类', '🌱', '环保技术、新能源等', 6)
ON CONFLICT (name) DO NOTHING;
