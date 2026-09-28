/**
 * AI 能力层统一出口。
 *
 * 直连各家 OpenAI 兼容接口与搜索服务商，不绑定任何中间平台。
 * 上层路由只依赖 getChatClient() / getSearchClient() / getImageClient()，
 * 更换服务商不需要改动业务代码。
 */
export * from './types';
export * from './presets';
export { ChatClient } from './chat';
export { WebSearchClient, SEARCH_PROVIDER_DEFAULTS, SEARCH_PROVIDER_LABELS } from './search';
export { ImageClient } from './image';
export { httpJson, normalizeBaseUrl } from './http';
export {
  resolveProvider,
  resolveProviderSafe,
  getChatClient,
  getSearchClient,
  getImageClient,
  trySearchClient,
  tryImageClient,
  getProviderStatus,
} from './resolve';
