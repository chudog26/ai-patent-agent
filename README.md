# AI 专利编写平台

基于大模型的专利说明书生成、专利审查与灵感挖掘平台。**自带模型 API 即可独立部署**，不依赖任何外部 SaaS 平台，支持任何 OpenAI 兼容服务（DeepSeek / 通义千问 / Kimi / 智谱 / Ollama 等）。

<div align="center">
  <img src="docs/screenshots/01-首页-专利编写.png" alt="专利编写主界面" width="820" />
</div>

## ✨ 功能一览

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| **专利生成** | `/` | 联网检索 50 篇文献 → 差异化分析 → 摘要 → 说明书（8000+ 字）→ 附图 → 权利要求书，全程流式输出、分步落库、断线可续接，一键导出 Word / PDF |
| **专利审查** | `/review` | 上传 `.docx` 或粘贴文本，按 7 个维度智能打分并给出可采纳的修改建议 |
| **灵感库** | `/inspiration` | 按分类浏览专利灵感，支持收藏与评论；管理员可批量 AI 生成灵感 |
| **费用计算** | `/fee-calculator` | 专利官费与年费试算，支持费减比例 |
| **历史记录** | `/history` | 生成与审查历史，支持搜索、回看与导出 |
| **个人中心** | `/profile` | 资料维护、修改密码，以及**配置自己的模型 API（BYOK）** |
| **管理后台** | `/admin` | 灵感管理、用户管理、全局 AI 服务配置 |

### 界面预览

| 专利审查 | 灵感广场 |
| --- | --- |
| ![专利审查](docs/screenshots/03-专利审查.png) | ![灵感广场](docs/screenshots/02-灵感广场.png) |

| 管理后台 | 生成历史 |
| --- | --- |
| ![管理后台](docs/screenshots/05-管理后台.png) | ![生成历史](docs/screenshots/04-生成历史.png) |

## 🧰 技术栈

- **框架**：Next.js 16（App Router）+ React 19
- **语言**：TypeScript 5（strict）
- **样式**：Tailwind CSS v4 + shadcn/ui，亮暗双主题
- **数据库**：PostgreSQL 16 + Drizzle ORM
- **AI 接入**：直连 OpenAI 兼容接口（对话 / 搜索 / 图像三类能力解耦，换服务商零业务改动）
- **导出**：docx（Word）+ 浏览器端打印（中文 PDF）
- **部署**：Docker 多阶段构建 + standalone 产物，一条 compose 命令全栈拉起

## 🚀 快速开始

### 最快路径：一键脚本

Windows 双击或执行 **`deploy.bat`**（Linux/macOS 执行 `bash deploy.sh`）。脚本自动完成：检查 Docker → 生成 `.env` → 生成加密密钥 → 构建启动 → 等待就绪 → 打开浏览器。

### 手动部署（Docker Compose）

```bash
# 1. 准备环境变量
cp .env.example .env
#    SETTINGS_ENCRYPTION_KEY 建议填随机串：openssl rand -base64 32
#    AI 相关变量可全部留空，稍后在网页里图形化配置

# 2. 启动（应用 + 数据库一条命令）
docker compose up -d --build

# 3. 打开 http://localhost:5000 按引导创建第一个管理员
```

数据库表结构与种子数据在**首次启动时自动创建**，无需手动执行迁移。

> 更多部署方式（已有 PostgreSQL 裸 Docker / 本地开发热更新 / 完全不用 Docker）见下方 [部署方式详解](#部署方式详解)。

### 三分钟上手

1. **创建管理员**：首次访问按引导设置账号密码（初始化接口在创建后自动失效，无默认密码隐患）；
2. **配置模型**：管理后台 → AI 服务配置 → 选择服务商 → 粘贴 API Key → 点「测试连接」→ 设为默认。支持 DeepSeek、通义千问、Kimi、智谱、OpenAI 及任意 OpenAI 兼容服务；
3. **生成专利**：首页填写发明信息（每个字段都有 AI 辅助填写）→ 点「生成专利说明书」→ 流式查看摘要 / 说明书 / 附图 / 权利要求书 → 下载 Word 或导出 PDF；
4. **审查打磨**：把已有专利文书粘贴进「专利审查」，获得 7 维度评分与修改建议；
5. **积累灵感**：在灵感库收藏 / 评论，或在管理后台批量生成新灵感。

## 📖 使用指南

### 生成专利说明书

1. 在首页填写发明名称（必填）、技术领域、背景技术、发明内容（必填）、实施方式，均可点输入框旁的「AI 辅助」自动补全；
2. 点击「生成专利说明书」，右侧实时展示生成进度：文献检索 → 摘要 → 说明书 → 附图 → 权利要求书 → 参考来源；
3. 生成过程分步落库，**中途关页不丢内容**，从「历史记录」可续接查看；
4. 每个分节可单独或打包导出：**下载 Word**（`.docx`，排版规范：宋体正文 / 黑体标题 / 首行缩进）或 **导出 PDF**（浏览器打印，中文渲染完整）。

### 配置模型 API

三类能力独立配置，就近优先：**用户自带 → 管理员全局 → 环境变量**。

| 能力 | 用途 | 说明 |
| --- | --- | --- |
| `chat` | 生成摘要 / 说明书 / 权利要求书 / 灵感 | 建议选 32K 以上上下文模型 |
| `search` | 检索专利文献与法规依据 | Tavily / 博查 / 自建 SearXNG，不配则跳过检索 |
| `image` | 生成专利附图 | 任何兼容 `/images/generations` 的服务 |

常用服务商速查（baseURL 填到版本号为止）：

| 服务商 | baseURL | 模型名示例 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |
| Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-128k` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:14b` |

所有 API Key 均以 **AES-256-GCM 加密**落库，接口只返回脱敏值；每个用户也可在个人中心配置自己的 Key（BYOK），优先于全局配置生效。

### 权限与安全设计

- 密码使用 **scrypt 加盐哈希**存储（`N=16384` + `timingSafeEqual`），遗留明文密码在首次登录时自动迁移为哈希；
- 首次部署初始化接口只在「系统中无管理员」时可用，创建后**自动失效**；
- 管理员重置用户密码时生成一次性随机密码，仅展示一次，库中即时散列。

## 部署方式详解

| 你的场景 | 用哪种方式 |
| --- | --- |
| 只想跑起来看看效果、或部署到服务器 | **方式一**：`docker compose up -d --build`，全容器 |
| **日常开发**（改代码要立刻看到效果） | **方式三**：容器只跑数据库 + 宿主机 `pnpm dev`，热更新 |
| 已有自己的 PostgreSQL | **方式二**：裸 Docker，只跑应用 |
| 机器上没装 Docker，也不想装 | **方式四**：本地 PostgreSQL + `pnpm dev` |

### 前置要求

- **方式一 / 二**：Docker Engine 24+ 与 Docker Compose v2
- **方式三 / 四**：Node.js 20+、pnpm 11，以及一个 PostgreSQL 16 实例

> pnpm 版本以 `package.json` 的 `packageManager` 字段为准（当前 `pnpm@11.7.0`），`pnpm-lock.yaml` 也是用它生成的。

**国内网络拉取 Docker 镜像**的注意事项：

1. 装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，勾选 WSL2 后端；缺 WSL 时管理员执行 `wsl --install` 后重启；
2. `registry-1.docker.io` 国内直连不通，需配镜像加速——Settings → Docker Engine 里加：

   ```json
   {
     "registry-mirrors": [
       "https://docker.m.daocloud.io",
       "https://docker.1ms.run",
       "https://hub.rat.dev"
     ]
   }
   ```

   或直接借用加速源拉取再改回原名：

   ```bash
   docker pull docker.m.daocloud.io/library/node:22-alpine
   docker tag  docker.m.daocloud.io/library/node:22-alpine node:22-alpine
   docker pull docker.m.daocloud.io/library/postgres:16-alpine
   docker tag  docker.m.daocloud.io/library/postgres:16-alpine postgres:16-alpine
   ```

   基础镜像共约 660MB（node 238MB + postgres 420MB）。

### 方式一：Docker Compose（部署 / 试用）

```bash
cp .env.example .env          # SETTINGS_ENCRYPTION_KEY 建议填 openssl rand -base64 32
docker compose up -d --build
docker compose logs -f app    # 确认启动成功
```

打开 `http://localhost:5000` 按引导创建管理员。数据库结构由 `sql/init.sql` 首次启动自动创建。

### 方式二：裸 Docker（已有 PostgreSQL）

```bash
psql "$DATABASE_URL" -f sql/init.sql          # 建表（或用 pnpm db:init）
docker build -t ai-patent-agent .
docker run -d --name patent-agent \
  -p 5000:5000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/patent_agent" \
  -e DATABASE_SSL=true \
  -e SETTINGS_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  --restart unless-stopped \
  ai-patent-agent
```

### 方式三：日常开发（容器跑库 + 宿主机跑应用）★ 推荐

```bash
pnpm install
pnpm db:up                    # 起数据库容器，首次自动执行 init.sql
cp .env.example .env.local    # DATABASE_URL 用默认值即可，与 dev 容器对齐
pnpm dev                      # 热更新，端口 5000
```

数据库辅助命令：`pnpm db:logs` / `pnpm db:ui`（Adminer）/ `pnpm db:down` / `pnpm db:reset`（⚠️ 删库）。
加 Redis / 对象存储等基础设施时，往 `docker-compose.dev.yml` 追加 service 即可，团队环境永远一致。

> 开发机若同时跑过部署 compose，5432 端口会冲突：用 `PG_PORT=5433 pnpm db:up` 换端口并同步改 `.env.local`。

### 方式四：完全不用 Docker

```bash
# PostgreSQL 里执行：CREATE DATABASE patent_agent;
pnpm install
cp .env.example .env.local    # 改 DATABASE_URL 指向你的实例
pnpm db:init                  # 建表（跨平台 Node 脚本）
pnpm dev                      # 开发模式；生产用 pnpm build && pnpm start
```

其他常用命令：

```bash
pnpm db:init -- --migrate     # 旧库执行增量迁移
pnpm db:push                  # drizzle-kit 按 schema 同步结构
pnpm db:studio                # 可视化查看数据
pnpm validate                 # 类型检查 + lint 门禁
pnpm build                    # 生产构建
```

> 依赖源说明：`.npmrc` 默认走国内镜像 `registry.npmmirror.com`；海外可临时
> `npm_config_registry=https://registry.npmjs.org pnpm install`。
> Windows + pnpm 下 `NEXT_OUTPUT_STANDALONE=true` 构建在最后拷贝阶段可能因符号链接报
> `ENOENT: syscall 'symlink'`——不影响编译与产物正确性，Docker 构建（Linux）不受影响。

## 数据库

PostgreSQL 16+，共 7 张表：

| 表 | 说明 |
| --- | --- |
| `users` | 用户与角色（密码为 scrypt 哈希） |
| `patent_histories` | 专利生成记录（分节存储 + 执行日志 + 任务状态） |
| `patent_reviews` | 审查记录与结果 JSON |
| `inspiration_categories` | 灵感分类（首次启动自动种子化 6 类） |
| `patent_inspirations` | 灵感内容 |
| `inspiration_comments` | 灵感评论 |
| `llm_configs` | AI 服务配置（三类能力 × 全局/用户两级作用域） |

脚本：`sql/init.sql`（全新部署，幂等）；`sql/migrations/001_upgrade_legacy.sql`（旧库升级）。

## 环境变量

| 变量 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | — | PostgreSQL 连接串（compose 自动注入） |
| `DATABASE_SSL` | 否 | `false` | 云数据库通常设 `true` |
| `SETTINGS_ENCRYPTION_KEY` | 建议 | — | 加密 API Key 用；**设定后不可更改** |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 否 | — | 对话模型，留空走后台图形化配置 |
| `SEARCH_PROVIDER` | 否 | `tavily` | `tavily` \| `bocha` \| `searxng` |
| `SEARCH_API_KEY` / `SEARCH_BASE_URL` | 否 | — | 搜索服务凭据 |
| `IMAGE_BASE_URL` / `IMAGE_API_KEY` / `IMAGE_MODEL` | 否 | — | 图像生成 |
| `PORT` | 否 | `5000` | 服务端口 |

完整清单见 [.env.example](.env.example)。

## 项目结构

```
docker-compose.yml             # 部署：应用 + 数据库
docker-compose.dev.yml         # 开发：基础设施
deploy.bat / deploy.sh         # 一键部署脚本
Dockerfile                     # 多阶段构建，standalone 产物
sql/init.sql                   # 全新部署建表 + 种子数据
src/
├── app/
│   ├── page.tsx               # 专利生成主页
│   ├── review/ inspiration/ history/ fee-calculator/ profile/ admin/
│   └── api/                   # 30+ 路由（generate-patent、review、ai-providers、setup…）
├── lib/
│   ├── db.ts                  # pg 连接池 + drizzle
│   ├── crypto.ts              # API Key AES-256-GCM 加解密
│   ├── password.ts            # scrypt 密码哈希与惰性迁移
│   ├── patentDocument.ts      # Word/PDF 导出的文档模型
│   └── ai/                    # chat / search / image 能力层 + 三级优先解析
├── storage/database/          # 数据访问层（schema.ts 为结构唯一事实来源）
└── components/                # shadcn/ui 组件与业务组件
```

**架构要点**：AI 能力层与业务解耦（路由只依赖 `getChatClient()` 等工厂）；SQL 全部集中在 Manager 层；表结构以 `schema.ts` 为唯一事实来源，`init.sql` 与之对齐。

## 常见问题

**Q：页面提示「尚未配置对话模型服务」？**
到「管理后台 → AI 服务配置」添加一条 `chat` 配置并设为默认，或填好 `.env` 里的 `LLM_*`。

**Q：生成到一半失败/超时？**
完整流程 3–10 分钟，中间结果实时落库，刷新页面可续接。频繁超时建议换上下文更长、速度更快的模型。

**Q：搜索总是 0 条结果？**
多为 Key 额度用尽或 `SEARCH_PROVIDER` 与 Key 不匹配，用配置弹窗的「测试连接」定位。

**Q：忘记管理员密码？**
由其他管理员在「管理后台 → 用户管理」里重置；若无可用管理员，需通过数据库处理（密码为 scrypt 哈希，可用 `pnpm db:studio` 配合脚本重置）。

**Q：`init.sql` 改了不生效？**
它只在**数据卷为空时**执行一次。已建库后需手动 `pnpm db:init`（幂等）或 `pnpm db:reset`（⚠️ 丢数据）。

**Q：改过 `SETTINGS_ENCRYPTION_KEY` 后 Key 读不出来？**
加密密钥不可变更，需用原密钥恢复或在后台重新填写 API Key。

## 已知限制

1. **鉴权基于可伪造的请求头**：前端把用户 ID 放在 `x-user-id` 头里传给后端，无签名校验，改请求头即可越权。生产/公网部署建议接入真正的会话（Auth.js 等）并加 `middleware.ts`，或在反向代理层加访问控制。
2. **改密不校验旧密码**：为保留「管理员可直接重置」的交互而做的产品决策。
3. **服务端仅支持英文 PDF**：中文 PDF 由浏览器端「导出 PDF」生成（质量更好、文字可选中），服务端检测到中文内容会返回引导信息而非乱码文件。
4. **无速率限制**：注册、生成等接口未限流，公开部署建议在反向代理层加。
5. **遗留代码约 40 处显式 `any`**：已在 eslint 中降级为 warning（`pnpm validate` 门禁只看 error）；新增核心模块（`src/lib/ai/**`、`src/storage/**`、`src/app/api/ai-providers/**`）无 `any`。

## License

MIT
