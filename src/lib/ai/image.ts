import { httpJson, normalizeBaseUrl } from './http';
import type {
  ImageGenerateParams,
  ImageGenerateResult,
  ResolvedProvider,
} from './types';

/** 语义尺寸 → 具体像素。第三方 OpenAI 兼容服务多数只接受标准尺寸。 */
const SIZE_ALIASES: Record<string, string> = {
  '1k': '1024x1024',
  '2k': '1792x1024',
  '4k': '1792x1024',
  small: '1024x1024',
  medium: '1024x1024',
  large: '1792x1024',
};

const DEFAULT_SIZE = '1024x1024';

function resolveSize(size?: string): string {
  if (!size) return DEFAULT_SIZE;
  const trimmed = size.trim();
  if (/^\d+\s*x\s*\d+$/i.test(trimmed)) {
    return trimmed.replace(/\s/g, '').toLowerCase();
  }
  return SIZE_ALIASES[trimmed.toLowerCase()] ?? DEFAULT_SIZE;
}

interface ImageApiResponse {
  data?: Array<{ url?: string; b64_json?: string; image_url?: string }>;
  images?: Array<{ url?: string; b64_json?: string; image_url?: string }>;
  error?: { message?: string } | string;
}

/**
 * OpenAI 兼容的图像生成客户端。
 *
 * 覆盖 OpenAI、智谱 CogView、阿里百炼、硅基流动、各类中转服务与本地
 * ComfyUI/SD 网关——只要对方实现 /images/generations 即可。
 */
export class ImageClient {
  private readonly endpoint: string;

  constructor(private readonly config: ResolvedProvider) {
    this.endpoint = `${normalizeBaseUrl(config.baseUrl)}/images/generations`;
  }

  async generate(params: ImageGenerateParams): Promise<ImageGenerateResult> {
    const prompt = params.prompt?.trim();
    if (!prompt) {
      return { success: false, imageUrls: [], error: '图像提示词为空' };
    }

    if (!this.config.model) {
      return {
        success: false,
        imageUrls: [],
        error: '未指定图像模型名称，请在 AI 服务配置中填写 model。',
      };
    }

    const buildBody = (size: string) => ({
      model: this.config.model,
      prompt,
      size,
      n: 1,
    });

    let payload: ImageApiResponse;
    const size = resolveSize(params.size);

    try {
      payload = await httpJson<ImageApiResponse>(this.endpoint, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        body: buildBody(size),
        timeoutMs: 180_000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 部分服务只接受固定的方图尺寸，降级重试一次
      if (size !== DEFAULT_SIZE && /size/i.test(message)) {
        try {
          payload = await httpJson<ImageApiResponse>(this.endpoint, {
            headers: { Authorization: `Bearer ${this.config.apiKey}` },
            body: buildBody(DEFAULT_SIZE),
            timeoutMs: 180_000,
          });
        } catch (retryError) {
          return {
            success: false,
            imageUrls: [],
            error: `图像生成失败：${
              retryError instanceof Error ? retryError.message : String(retryError)
            }`,
          };
        }
      } else {
        return { success: false, imageUrls: [], error: `图像生成失败：${message}` };
      }
    }

    const apiError = payload.error;
    if (apiError) {
      return {
        success: false,
        imageUrls: [],
        error:
          typeof apiError === 'string' ? apiError : apiError.message ?? '图像服务返回错误',
      };
    }

    const items = payload.data ?? payload.images ?? [];
    const imageUrls: string[] = [];

    for (const item of items) {
      const directUrl = item.url ?? item.image_url;
      if (directUrl) {
        imageUrls.push(directUrl);
      } else if (item.b64_json) {
        imageUrls.push(`data:image/png;base64,${item.b64_json}`);
      }
    }

    if (imageUrls.length === 0) {
      return { success: false, imageUrls: [], error: '图像服务未返回任何图片' };
    }

    return { success: true, imageUrls };
  }
}
