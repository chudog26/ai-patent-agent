/**
 * 轻量 HTTP 封装：统一超时、错误信息与 JSON 解析。
 * 所有外部 AI 服务的调用都经过这里，便于排障。
 */

export interface HttpJsonOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

/** 去除 URL 结尾斜杠，便于安全拼接路径 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function truncate(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function httpJson<T>(url: string, options: HttpJsonOptions = {}): Promise<T> {
  const { method = 'POST', headers = {}, body, timeoutMs = 120_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} — ${truncate(raw)}`
      );
    }

    if (!raw) {
      return {} as T;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(`响应不是合法 JSON — ${truncate(raw)}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`请求超时（${Math.round(timeoutMs / 1000)}s）：${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
