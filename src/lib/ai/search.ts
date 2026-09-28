import { httpJson, normalizeBaseUrl } from './http';
import type { ResolvedProvider, WebSearchItem, WebSearchResponse } from './types';

/** 各搜索服务商的默认接口地址 */
export const SEARCH_PROVIDER_DEFAULTS: Record<string, string> = {
  tavily: 'https://api.tavily.com',
  bocha: 'https://api.bochaai.com',
  searxng: 'http://localhost:8080',
};

export const SEARCH_PROVIDER_LABELS: Record<string, string> = {
  tavily: 'Tavily（国际通用，需科学上网）',
  bocha: '博查 Bocha（国内可直连，中文语料好）',
  searxng: 'SearXNG（自建元搜索，零 API 费用）',
};

interface TavilyResponse {
  answer?: string;
  results?: Array<{ title?: string; url?: string; content?: string }>;
}

interface BochaResponse {
  code?: number;
  msg?: string;
  data?: {
    webPages?: {
      value?: Array<{
        name?: string;
        url?: string;
        snippet?: string;
        summary?: string;
      }>;
    };
  };
}

interface SearxngResponse {
  results?: Array<{ title?: string; url?: string; content?: string }>;
}

/**
 * 联网搜索客户端。
 *
 * 通过 provider 字段切换实现（tavily / bocha / searxng），
 * 上层路由无需感知具体服务商。
 */
export class WebSearchClient {
  private readonly provider: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ResolvedProvider) {
    this.provider = (config.provider || 'tavily').toLowerCase();
    this.baseUrl = normalizeBaseUrl(
      config.baseUrl || SEARCH_PROVIDER_DEFAULTS[this.provider] || ''
    );
  }

  async webSearch(
    query: string,
    count: number = 10,
    needSummary: boolean = false
  ): Promise<WebSearchResponse> {
    switch (this.provider) {
      case 'bocha':
        return this.searchBocha(query, count, needSummary);
      case 'searxng':
        return this.searchSearxng(query, count);
      case 'tavily':
      default:
        return this.searchTavily(query, count, needSummary);
    }
  }

  /** 语义上要求返回摘要，实际由各provider尽力而为 */
  async webSearchWithSummary(query: string, count: number = 3): Promise<WebSearchResponse> {
    return this.webSearch(query, count, true);
  }

  // ---------------------------------------------------------------- Tavily

  private async searchTavily(
    query: string,
    count: number,
    needSummary: boolean
  ): Promise<WebSearchResponse> {
    const payload = await httpJson<TavilyResponse>(`${this.baseUrl}/search`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body: {
        api_key: this.config.apiKey,
        query,
        max_results: count,
        include_answer: needSummary,
        search_depth: 'basic',
      },
      timeoutMs: 60_000,
    });

    const web_items: WebSearchItem[] = (payload.results ?? []).map((item) => ({
      title: item.title ?? '',
      url: item.url ?? '',
      snippet: item.content ?? '',
    }));

    return { web_items, summary: payload.answer };
  }

  // ----------------------------------------------------------------- Bocha

  private async searchBocha(
    query: string,
    count: number,
    needSummary: boolean
  ): Promise<WebSearchResponse> {
    const payload = await httpJson<BochaResponse>(`${this.baseUrl}/v1/web-search`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body: {
        query,
        summary: needSummary,
        count,
        page: 1,
        freshness: 'noLimit',
      },
      timeoutMs: 60_000,
    });

    if (payload.code && payload.code !== 200) {
      throw new Error(`博查搜索返回错误：${payload.msg ?? payload.code}`);
    }

    const web_items: WebSearchItem[] = (payload.data?.webPages?.value ?? []).map(
      (item) => ({
        title: item.name ?? '',
        url: item.url ?? '',
        snippet: item.summary || item.snippet || '',
      })
    );

    const summary = needSummary
      ? web_items
          .slice(0, 3)
          .map((item) => item.snippet)
          .filter(Boolean)
          .join('\n')
      : undefined;

    return { web_items, summary: summary || undefined };
  }

  // --------------------------------------------------------------- SearXNG

  private async searchSearxng(query: string, count: number): Promise<WebSearchResponse> {
    const url =
      `${this.baseUrl}/search?format=json&language=zh-CN` +
      `&q=${encodeURIComponent(query)}`;

    const payload = await httpJson<SearxngResponse>(url, {
      method: 'GET',
      headers: this.config.apiKey
        ? { Authorization: `Bearer ${this.config.apiKey}` }
        : undefined,
      timeoutMs: 60_000,
    });

    const web_items: WebSearchItem[] = (payload.results ?? [])
      .slice(0, count)
      .map((item) => ({
        title: item.title ?? '',
        url: item.url ?? '',
        snippet: item.content ?? '',
      }));

    return {
      web_items,
      summary: web_items
        .slice(0, 3)
        .map((item) => item.snippet)
        .filter(Boolean)
        .join('\n') || undefined,
    };
  }
}
