-- =============================================================================
-- AI 专利编写平台 — 全新数据库初始化脚本
--
-- 用途：全新部署时一次性建好所有表、索引与种子数据。
-- 执行方式（任选其一）：
--   1. docker-compose 部署：sql 目录会自动挂载到 postgres 的 /docker-entrypoint-initdb.d
--   2. 手动执行：psql "$DATABASE_URL" -f sql/init.sql
--   3. 应用内：访问部署后的 /api/setup 接口（仅首次可用）
--
-- 脚本是幂等的（IF NOT EXISTS / ON CONFLICT），可重复执行。
-- 已有历史的数据库请改用 sql/migrations/001_upgrade_legacy.sql。
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. 用户表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  username    VARCHAR(100) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(20),
  company     VARCHAR(200),
  position    VARCHAR(100),
  role        VARCHAR(20)  NOT NULL DEFAULT 'user',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. 专利生成历史
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patent_histories (
  id                  VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               VARCHAR(512) NOT NULL,
  field               TEXT,
  background          TEXT,
  content             TEXT         NOT NULL,
  solution            TEXT,
  generated_content   TEXT         NOT NULL,
  patent_title        VARCHAR(512),
  summary_title       VARCHAR(100),
  summary_content     TEXT,
  description_title   VARCHAR(100),
  description_content TEXT,
  drawings_title      VARCHAR(100),
  drawings_content    TEXT,
  drawings_images     JSONB,
  claims_title        VARCHAR(100),
  claims_content      TEXT,
  "references"        JSONB,
  execution_log       JSONB,
  status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
  progress            INTEGER      NOT NULL DEFAULT 0,
  current_stage       VARCHAR(100),
  error_message       TEXT,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patent_histories_user_created
  ON patent_histories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patent_histories_status
  ON patent_histories (status);

-- -----------------------------------------------------------------------------
-- 3. 专利审查历史
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

CREATE INDEX IF NOT EXISTS idx_patent_reviews_user_created
  ON patent_reviews (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patent_reviews_status
  ON patent_reviews (status);

-- -----------------------------------------------------------------------------
-- 4. 灵感分类
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspiration_categories (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  icon        VARCHAR(50)  NOT NULL,
  description TEXT         NOT NULL,
  sort_order  INTEGER      DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. 专利灵感
-- -----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_patent_inspirations_category
  ON patent_inspirations (category_id);

-- -----------------------------------------------------------------------------
-- 6. 灵感评论
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspiration_comments (
  id             VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  inspiration_id VARCHAR(36)  NOT NULL REFERENCES patent_inspirations(id) ON DELETE CASCADE,
  content        TEXT         NOT NULL,
  user_id        VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  username       VARCHAR(100) NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspiration_comments_inspiration
  ON inspiration_comments (inspiration_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 7. AI 服务配置（统一管理 chat / search / image 三类能力）
--
--    user_id 为 NULL  → 全局配置，由管理员维护，所有用户可用（兜底）
--    user_id 有值     → 该用户自带的配置（BYOK），优先于全局配置生效
--    api_key 使用 AES-256-GCM 加密后存储（见 src/lib/crypto.ts）
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

-- 同一作用域内配置名不重复（全局配置的 user_id 为 NULL，靠 COALESCE 归一化比较）
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_configs_scope_name
  ON llm_configs (COALESCE(user_id, ''), name);

-- 每个作用域 + 能力只允许一个默认配置
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_configs_scope_capability_default
  ON llm_configs (COALESCE(user_id, ''), capability)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_llm_configs_resolve
  ON llm_configs (capability, user_id, is_active);

-- -----------------------------------------------------------------------------
-- 种子数据：默认灵感分类
-- -----------------------------------------------------------------------------
INSERT INTO inspiration_categories (name, icon, description, sort_order) VALUES
  ('家电类', '🏠', '智能家居、白色家电等', 1),
  ('医疗类', '🏥', '医疗设备、健康监测等', 2),
  ('电子类', '📱', '消费电子、通讯设备等', 3),
  ('机械类', '⚙️', '工业机械、自动化设备等', 4),
  ('软件类', '💻', '计算机软件、AI应用等', 5),
  ('环保类', '🌱', '环保技术、新能源等', 6)
ON CONFLICT (name) DO NOTHING;
