import type { Capability } from './types';
import { SEARCH_PROVIDER_DEFAULTS, SEARCH_PROVIDER_LABELS } from './search';

/**
 * 供应商预设目录。
 *
 * 前端用它渲染「服务商」下拉框，选中后自动填入 baseURL，把用户的填写成本
 * 压缩到「选一家 + 粘一个 Key」。后端在解析配置时也用它兜底默认地址。
 */
export interface ProviderPreset {
  /** 存入 llm_configs.provider 的值 */
  key: string;
  label: string;
  capability: Capability;
  /** 默认接口地址；留空表示必须由用户填写 */
  baseUrl: string;
  /** 选中后自动填入的模型名 */
  defaultModel?: string;
  /** 常用模型，供前端下拉建议 */
  models?: string[];
  /** 是否允许不填 API Key（如本地 Ollama / 自建 SearXNG） */
  apiKeyOptional?: boolean;
  note?: string;
}

const CHAT_PRESETS: ProviderPreset[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    capability: 'chat',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'],
  },
  {
    key: 'deepseek',
    label: 'DeepSeek 深度求索',
    capability: 'chat',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    note: '中文专利撰写性价比高，长文生成稳定。',
  },
  {
    key: 'dashscope',
    label: '阿里云百炼（通义千问）',
    capability: 'chat',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-max',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-max'],
    note: '国内直连，长上下文，适合 8000 字说明书生成。',
  },
  {
    key: 'moonshot',
    label: '月之暗面 Kimi',
    capability: 'chat',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-128k',
    models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'kimi-k2-0711-preview'],
  },
  {
    key: 'zhipu',
    label: '智谱 GLM',
    capability: 'chat',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
  },
  {
    key: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    capability: 'chat',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    models: [
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen3-235B-A22B',
    ],
    note: '一个 Key 可同时调用多家开源模型。',
  },
  {
    key: 'openrouter',
    label: 'OpenRouter（聚合）',
    capability: 'chat',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
    note: '聚合多家模型，一个 Key 打通所有。',
  },
  {
    key: 'ollama',
    label: '本地 Ollama',
    capability: 'chat',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:14b',
    models: ['qwen2.5:14b', 'llama3.1:8b', 'deepseek-r1:14b'],
    apiKeyOptional: true,
    note: '完全本地推理，无需联网与付费，Key 可留空。',
  },
  {
    key: 'custom',
    label: '自定义（OpenAI 兼容）',
    capability: 'chat',
    baseUrl: '',
    note: '任何兼容 /chat/completions 的服务都可接入。',
  },
];

const SEARCH_PRESETS: ProviderPreset[] = (
  Object.keys(SEARCH_PROVIDER_DEFAULTS) as Array<keyof typeof SEARCH_PROVIDER_DEFAULTS>
).map((key) => ({
  key,
  label: SEARCH_PROVIDER_LABELS[key] ?? key,
  capability: 'search' as Capability,
  baseUrl: SEARCH_PROVIDER_DEFAULTS[key],
  apiKeyOptional: key === 'searxng',
}));

const IMAGE_PRESETS: ProviderPreset[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    capability: 'image',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-image-1',
    models: ['gpt-image-1', 'dall-e-3'],
  },
  {
    key: 'zhipu',
    label: '智谱 CogView',
    capability: 'image',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'cogview-4',
    models: ['cogview-4', 'cogview-3-flash'],
    note: '国内直连，中文提示词理解好。',
  },
  {
    key: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    capability: 'image',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Kwai-Kolors/Kolors',
    models: ['Kwai-Kolors/Kolors'],
  },
  {
    key: 'custom',
    label: '自定义（OpenAI 兼容）',
    capability: 'image',
    baseUrl: '',
    note: '任何兼容 /images/generations 的服务都可接入。',
  },
];

export const PROVIDER_PRESETS: ProviderPreset[] = [
  ...CHAT_PRESETS,
  ...SEARCH_PRESETS,
  ...IMAGE_PRESETS,
];

export function getPresetsForCapability(capability: Capability): ProviderPreset[] {
  return PROVIDER_PRESETS.filter((preset) => preset.capability === capability);
}

export function findPreset(
  capability: Capability,
  provider: string
): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find(
    (preset) =>
      preset.capability === capability &&
      preset.key.toLowerCase() === (provider || '').toLowerCase()
  );
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  chat: '对话生成',
  search: '联网搜索',
  image: '图像生成',
};
