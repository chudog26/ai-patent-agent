#!/usr/bin/env bash
# ============================================================
# AI 专利编写平台 — Linux/macOS 一键部署脚本
# 用法：bash deploy.sh
# ============================================================
set -e

echo ""
echo "==== AI 专利编写平台 一键部署 ===="
echo ""

# ---- 1. 检查 Docker ----
if ! command -v docker >/dev/null 2>&1; then
  echo "[错误] 未检测到 Docker。请先安装：https://docs.docker.com/engine/install/"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "[错误] Docker 未运行。请先启动 Docker 服务。"
  exit 1
fi
echo "[1/5] Docker 环境正常"

# ---- 2. 准备 .env ----
if [ -f .env ]; then
  echo "[2/5] 已存在 .env，跳过生成"
else
  cp .env.example .env
  echo "[2/5] 已从模板生成 .env"
fi

# ---- 3. 若未配置加密密钥则自动生成 ----
if grep -q '^SETTINGS_ENCRYPTION_KEY=..*' .env; then
  echo "[3/5] SETTINGS_ENCRYPTION_KEY 已配置"
else
  KEY=$(openssl rand -base64 32)
  sed -i.bak "s|^SETTINGS_ENCRYPTION_KEY=$|SETTINGS_ENCRYPTION_KEY=${KEY}|" .env && rm -f .env.bak
  echo "[3/5] 已自动生成 SETTINGS_ENCRYPTION_KEY（请妥善保管，丢失将无法解密已存的 API Key）"
fi

# ---- 4. 构建并启动 ----
echo "[4/5] 构建并启动服务（首次构建约需几分钟）..."
docker compose up -d --build

# ---- 5. 等待健康 ----
echo "[5/5] 等待服务就绪..."
for i in $(seq 1 60); do
  if curl -sf --max-time 5 http://localhost:5000/api/setup >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

echo ""
echo "==== 部署完成 ===="
echo "访问地址：http://localhost:5000"
echo "首次访问会引导你创建管理员账号，然后到「管理后台 → AI 服务配置」里"
echo "填入模型 API Key（任何 OpenAI 兼容服务均可，如 DeepSeek）即可开始使用。"
