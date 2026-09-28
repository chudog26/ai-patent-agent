import { providerManager } from '@/storage/database/providerManager';
import { findPreset } from './presets';
import { ChatClient } from './chat';
import { WebSearchClient } from './search';
import { ImageClient } from './image';
import {
  ProviderNotConfiguredError,
  type Capability,
  type ResolvedProvider,
} from './types';

/**
 * 配置解析：三级优先级
 *
 *   1. 用户在「我的模型 API」里配置的（BYOK）
 *   2. 管理员在「AI 服务配置」里配的全局默认
 *   3. 环境变量（适合一人一机的极简部署，配好 .env 就能跑）
 *
 * 前两级在数据库里，第三级在这里兜底。
 */

function fromEnvChat(): ResolvedProvider | null {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;

  if (!baseUrl && !apiKey) return null;

  const preset = findPreset('chat', 'openai');

  return {
    name: '环境变量配置（对话）',
    capability: 'chat',
    provider: 'env',
    model: process.env.LLM_MODEL || preset?.defaultModel || 'gpt-4o',
    baseUrl: baseUrl || preset?.baseUrl || '',
    apiKey: apiKey || '',
    temperature: process.env.LLM_TEMPERATURE
      ? parseFloat(process.env.LLM_TEMPERATURE)
      : 0.7,
    maxTokens: process.env.LLM_MAX_TOKENS
      ? parseInt(process.env.LLM_MAX_TOKENS, 10)
      : null,
    source: 'env',
  };
}

function fromEnvSearch(): ResolvedProvider | null {
  const provider = process.env.SEARCH_PROVIDER;
  const apiKey = process.env.SEARCH_API_KEY;
  const baseUrl = process.env.SEARCH_BASE_URL;

  if (!provider && !apiKey && !baseUrl) return null;

  const resolvedProvider = provider || 'tavily';
  const preset = findPreset('search', resolvedProvider);

  // 该服务商是否允许不带 Key（只有自建 SearXNG 允许）。
  // 环境变量里常见「填了 SEARCH_PROVIDER 但 Key 留空」的写法，
  // 若据此判定为「已配置」，前端会把搜索显示成已就绪，
  // 而每次生成都会白白发起一次注定 401 的检索请求。
  if (!preset?.apiKeyOptional && !apiKey) return null;

  return {
    name: '环境变量配置（搜索）',
    capability: 'search',
    provider: resolvedProvider,
    model: '',
    baseUrl: baseUrl || preset?.baseUrl || '',
    apiKey: apiKey || '',
    source: 'env',
  };
}

function fromEnvImage(): ResolvedProvider | null {
  const baseUrl = process.env.IMAGE_BASE_URL;
  const apiKey = process.env.IMAGE_API_KEY;

  if (!baseUrl && !apiKey) return null;

  const preset = findPreset('image', 'openai');

  return {
    name: '环境变量配置（图像）',
    capability: 'image',
    provider: 'env',
    model: process.env.IMAGE_MODEL || preset?.defaultModel || 'gpt-image-1',
    baseUrl: baseUrl || preset?.baseUrl || '',
    apiKey: apiKey || '',
    source: 'env',
  };
}

const ENV_FALLBACKS: Record<Capability, () => ResolvedProvider | null> = {
  chat: fromEnvChat,
  search: fromEnvSearch,
  image: fromEnvImage,
};

/** 解析某能力实际生效的配置；都没有则抛 ProviderNotConfiguredError */
export async function resolveProvider(
  capability: Capability,
  userId?: string | null
): Promise<ResolvedProvider> {
  const fromDb = await providerManager.resolveEffective(capability, userId);

  if (fromDb && fromDb.baseUrl) {
    return fromDb;
  }

  const fromEnv = ENV_FALLBACKS[capability]();
  if (fromEnv && fromEnv.baseUrl) {
    return fromEnv;
  }

  throw new ProviderNotConfiguredError(capability);
}

/** 不抛异常版本，用于「配置状态」面板 */
export async function resolveProviderSafe(
  capability: Capability,
  userId?: string | null
): Promise<ResolvedProvider | null> {
  try {
    return await resolveProvider(capability, userId);
  } catch {
    return null;
  }
}

export async function getChatClient(userId?: string | null) {
  const config = await resolveProvider('chat', userId);
  return { client: new ChatClient(config), config };
}

export async function getSearchClient(userId?: string | null) {
  const config = await resolveProvider('search', userId);
  return { client: new WebSearchClient(config), config };
}

export async function getImageClient(userId?: string | null) {
  const config = await resolveProvider('image', userId);
  return { client: new ImageClient(config), config };
}

/**
 * 可选的搜索客户端。
 *
 * 搜索与图像属于「锦上添花」的能力：没配置时应当跳过相应步骤，
 * 而不是让整个生成流程失败。因此这两个用 tryXxx 版本，
 * 返回 null 表示未配置，调用方据此降级。
 */
export async function trySearchClient(
  userId?: string | null
): Promise<WebSearchClient | null> {
  const config = await resolveProviderSafe('search', userId);
  return config ? new WebSearchClient(config) : null;
}

/** 可选的图像客户端，语义同上 */
export async function tryImageClient(
  userId?: string | null
): Promise<ImageClient | null> {
  const config = await resolveProviderSafe('image', userId);
  return config ? new ImageClient(config) : null;
}

/** 汇总三门能力当前是否可用，供前端做配置引导 */
export async function getProviderStatus(userId?: string | null) {
  const capabilities: Capability[] = ['chat', 'search', 'image'];

  const entries = await Promise.all(
    capabilities.map(async (capability) => {
      const resolved = await resolveProviderSafe(capability, userId);
      return [
        capability,
        resolved
          ? {
              configured: true,
              source: resolved.source,
              name: resolved.name,
              model: resolved.model,
              provider: resolved.provider,
            }
          : { configured: false },
      ] as const;
    })
  );

  return Object.fromEntries(entries);
}
