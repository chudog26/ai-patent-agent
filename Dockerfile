# =============================================================================
# AI 专利编写平台 — 生产镜像
#
# 构建：docker build -t ai-patent-agent .
# 运行：见 docker-compose.yml（推荐）或 README 中的「方式二：裸 Docker」
# =============================================================================

# -----------------------------------------------------------------------------
# 1. 依赖安装
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# pnpm 通过国内镜像安装。
# 注意：不要用 `corepack enable` —— corepack 默认从 registry.npmjs.org 拉取包管理器，
# 国内网络不可达会长时间卡住。这里显式指定镜像源，且版本与 package.json 的
# packageManager 字段、以及 pnpm-lock.yaml 的生成版本保持一致。
RUN npm config set registry https://registry.npmmirror.com \
 && npm install -g pnpm@11.7.0 \
 && pnpm --version

# 只拷贝依赖清单，最大化利用层缓存
# 注意：preinstall 钩子会执行 scripts/check-package-manager.mjs，必须一并拷入，
# 否则依赖安装阶段会因找不到脚本而失败。
COPY package.json pnpm-lock.yaml .npmrc ./
COPY scripts/check-package-manager.mjs ./scripts/

# preinstall 会校验包管理器，CI 环境下跳过交互
ENV CI=1
# --ignore-scripts 的原因（不是图省事）：
# pnpm 10+ 默认阻止依赖的安装脚本，在 CI 下会直接抛 ERR_PNPM_IGNORED_BUILDS 失败
# （被拦的是 core-js / esbuild / sharp / unrs-resolver）。
# 这几个脚本对本项目并非必需：Next 用 SWC 编译、项目内图片一律走原生 <img>，
# 且宿主机上的 node_modules 就是用 --ignore-scripts 安装的，tsc / eslint / next build
# 均已实测通过。保持一致反而能让容器行为与已验证环境完全对齐。
RUN pnpm install --frozen-lockfile --prod=false --ignore-scripts

# -----------------------------------------------------------------------------
# 2. 构建
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# pnpm 通过国内镜像安装。
# 注意：不要用 `corepack enable` —— corepack 默认从 registry.npmjs.org 拉取包管理器，
# 国内网络不可达会长时间卡住。这里显式指定镜像源，且版本与 package.json 的
# packageManager 字段、以及 pnpm-lock.yaml 的生成版本保持一致。
RUN npm config set registry https://registry.npmmirror.com \
 && npm install -g pnpm@11.7.0 \
 && pnpm --version

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# 产出精简的 standalone 运行目录
ENV NEXT_OUTPUT_STANDALONE=true
# 构建期不需要真实数据库，占位避免校验报错
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

RUN pnpm build

# -----------------------------------------------------------------------------
# 3. 运行
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000
ENV HOSTNAME=0.0.0.0

# 健康检查与数据库脚本需要 wget / psql 之外的最小依赖，alpine 自带 wget
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# standalone 产物（含最小化 node_modules 与 server.js）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 静态资源与公开目录（standalone 产物不包含，需单独拷贝）
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# /api/setup 初始化时需要读取建表脚本
COPY --from=builder --chown=nextjs:nodejs /app/sql ./sql

USER nextjs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/setup" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
