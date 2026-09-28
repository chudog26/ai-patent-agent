@echo off
rem ============================================================
rem AI 专利编写平台 — Windows 一键部署脚本
rem 用法：双击运行，或在命令行执行 deploy.bat
rem ============================================================
setlocal enabledelayedexpansion
chcp 65001 >nul

echo.
echo ==== AI 专利编写平台 一键部署 ====
echo.

rem ---- 1. 检查 Docker ----
where docker >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Docker。请先安装 Docker Desktop 并启动后重试。
    goto :fail
)
docker info >nul 2>nul
if errorlevel 1 (
    echo [错误] Docker 未运行。请启动 Docker Desktop 后重试。
    goto :fail
)
echo [1/5] Docker 环境正常

rem ---- 2. 准备 .env ----
if exist .env (
    echo [2/5] 已存在 .env，跳过生成
) else (
    copy .env.example .env >nul
    echo [2/5] 已从模板生成 .env
)

rem ---- 3. 若未配置加密密钥则自动生成（随机 32 字节 base64）----
findstr /C:"SETTINGS_ENCRYPTION_KEY=" .env | findstr /V /C:"SETTINGS_ENCRYPTION_KEY=$" >nul 2>nul
if errorlevel 1 (
    powershell -NoProfile -Command "$b=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[Convert]::ToBase64String($b)" > "%TEMP%\enc_key.txt" 2>nul
    set /p ENC_KEY=<"%TEMP%\enc_key.txt"
    del "%TEMP%\enc_key.txt" 2>nul
    if not "!ENC_KEY!"=="" (
        powershell -NoProfile -Command "(Get-Content .env -Raw) -replace 'SETTINGS_ENCRYPTION_KEY=$','SETTINGS_ENCRYPTION_KEY=!ENC_KEY!' | Set-Content .env -Encoding utf8 -NoNewline"
        echo [3/5] 已自动生成 SETTINGS_ENCRYPTION_KEY（请妥善保管，丢失将无法解密已存的 API Key）
    ) else (
        echo [3/5] 加密密钥生成失败，将以 base64 明文存储 API Key（仅影响安全性，不影响功能）
    )
) else (
    echo [3/5] SETTINGS_ENCRYPTION_KEY 已配置
)

rem ---- 4. 构建并启动 ----
echo [4/5] 构建并启动服务（首次构建约需几分钟，请耐心等待）...
docker compose up -d --build
if errorlevel 1 (
    echo [错误] 启动失败，请查看上方日志。
    goto :fail
)

rem ---- 5. 等待健康 ----
echo [5/5] 等待服务就绪...
set /a TRIES=0
:waitloop
set /a TRIES+=1
if %TRIES% gtr 60 (
    echo [警告] 等待超时，服务可能仍在启动。可稍后手动访问 http://localhost:5000
    goto :open
)
powershell -NoProfile -Command "try{Invoke-WebRequest 'http://localhost:5000/api/setup' -TimeoutSec 5 -UseBasicParsing|Out-Null;exit 0}catch{exit 1}" >nul 2>nul
if errorlevel 1 (
    timeout /t 5 /nobreak >nul
    goto :waitloop
)

:open
echo.
echo ==== 部署完成 ====
echo 访问地址：http://localhost:5000
echo 首次访问会引导你创建管理员账号，然后到「管理后台 → AI 服务配置」里
echo 填入模型 API Key（任何 OpenAI 兼容服务均可，如 DeepSeek）即可开始使用。
echo.
start http://localhost:5000
goto :eof

:fail
echo.
echo 部署未完成，请根据上方提示处理后重新运行本脚本。
pause
exit /b 1
