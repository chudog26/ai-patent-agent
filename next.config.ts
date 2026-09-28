import type { NextConfig } from 'next';

/**
 * 自部署配置。
 *
 * 用反向代理 / 自定义域名做开发联调时，可通过环境变量追加允许的 dev origin：
 *   ALLOWED_DEV_ORIGINS="*.example.com,localhost:3000"
 */
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),

  // 附图由用户自配的图像服务返回，域名不可预知；
  // 项目内一律使用原生 <img>，因此无需配置 images.remotePatterns。

  // /api/setup 会在运行时读取 sql/init.sql，standalone 产物需要显式带上它
  outputFileTracingIncludes: {
    '/api/setup': ['./sql/**/*'],
  },

  // Docker 部署时产出精简的独立运行目录
  ...(process.env.NEXT_OUTPUT_STANDALONE === 'true'
    ? { output: 'standalone' as const }
    : {}),
};

export default nextConfig;
