/**
 * AI 能力层的公共类型定义。
 *
 * 平台把外部 AI 能力拆成三类（capability）：
 *   chat   — 对话/文本生成，专利说明书、摘要、权利要求书、灵感都走这里
 *   search — 联网检索，专利生成搜 50 篇文献、审查查法规依据走这里
 *   image  — 图像生成，专利附图走这里
 *
 * 每一类都可以由「用户自带配置」或「管理员配置的全局默认」或「环境变量」提供。
 */

export type Capability = 'chat' | 'search' | 'image';

export const CAPABILITIES: Capability[] = ['chat', 'search', 'image'];

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatInvokeOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface WebSearchItem {
  title: string;
  url: string;
  snippet: string;
}

/** 联网搜索的统一返回结构 */
export interface WebSearchResponse {
  web_items: WebSearchItem[];
  summary?: string;
}

export interface ImageGenerateParams {
  prompt: string;
  /** 允许 '1K' | '2K' | '4K' 这类语义值，或直接的 '1024x1024' */
  size?: string;
  watermark?: boolean;
}

export interface ImageGenerateResult {
  success: boolean;
  imageUrls: string[];
  error?: string;
}

/** 解析后可直接用于发起请求的一份配置 */
export interface ResolvedProvider {
  /** 数据库中的配置 id，来自环境变量时为 undefined */
  id?: string;
  name: string;
  capability: Capability;
  /** 供应商标识，例如 openai / deepseek / tavily / bocha */
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number | null;
  /** 该配置的来源，用于前端提示与排障 */
  source: 'user' | 'global' | 'env';
}

/** 配置来源缺失时抛出的错误，路由可据此返回带引导的 4xx */
export class ProviderNotConfiguredError extends Error {
  readonly capability: Capability;

  constructor(capability: Capability, detail?: string) {
    const labels: Record<Capability, string> = {
      chat: '对话模型',
      search: '联网搜索',
      image: '图像生成',
    };
    super(
      detail ??
        `尚未配置${labels[capability]}服务。请在「个人中心 → 我的模型 API」填写自己的密钥，` +
          `或联系管理员在「管理后台 → AI 服务配置」中添加全局配置。`
    );
    this.name = 'ProviderNotConfiguredError';
    this.capability = capability;
  }
}
