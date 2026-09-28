import { httpJson, normalizeBaseUrl } from './http';
import type { ChatInvokeOptions, ChatMessage, ChatResult, ResolvedProvider } from './types';

interface OpenAICompatibleChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
    reasoning_content?: string;
  };
  text?: string;
}

interface OpenAICompatibleResponse {
  choices?: OpenAICompatibleChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string } | string;
}

/** 把 content 可能是数组的多模态响应急转为纯文本 */
function extractText(choice: OpenAICompatibleChoice | undefined): string {
  if (!choice) return '';

  const content = choice.message?.content;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const merged = content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (merged) return merged;
  }

  // 少数国产模型会把正文放在 reasoning_content，作为兜底
  const reasoning = choice.message?.reasoning_content;
  if (typeof reasoning === 'string' && reasoning.trim()) {
    return reasoning;
  }

  if (typeof choice.text === 'string') {
    return choice.text;
  }

  return '';
}

function readErrorMessage(payload: OpenAICompatibleResponse): string | undefined {
  if (!payload.error) return undefined;
  return typeof payload.error === 'string' ? payload.error : payload.error.message;
}

/**
 * OpenAI 兼容的对话客户端。
 *
 * 适配 OpenAI / DeepSeek / 通义千问 / Kimi / 智谱 / 硅基流动 / Ollama / vLLM
 * 以及各类 OpenAI 兼容中转服务——只要填对 baseURL + Key + 模型名即可。
 */
export class ChatClient {
  private readonly endpoint: string;

  constructor(private readonly config: ResolvedProvider) {
    this.endpoint = `${normalizeBaseUrl(config.baseUrl)}/chat/completions`;
  }

  async invoke(
    messages: ChatMessage[],
    options: ChatInvokeOptions = {}
  ): Promise<ChatResult> {
    const model = options.model || this.config.model;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? this.config.maxTokens ?? undefined;

    if (!model) {
      throw new Error('未指定对话模型名称，请在 AI 服务配置中填写 model。');
    }

    const basePayload: Record<string, unknown> = {
      model,
      messages,
      temperature,
    };
    if (maxTokens) {
      basePayload.max_tokens = maxTokens;
    }

    let payload: OpenAICompatibleResponse;

    try {
      payload = await httpJson<OpenAICompatibleResponse>(this.endpoint, {
        headers: this.authHeaders(),
        body: basePayload,
        timeoutMs: 300_000,
      });
    } catch (error) {
      // OpenAI 新一代推理模型拒绝 max_tokens，需要改用 max_completion_tokens
      const message = error instanceof Error ? error.message : String(error);
      if (maxTokens && /max_tokens|max_completion_tokens/i.test(message)) {
        delete basePayload.max_tokens;
        basePayload.max_completion_tokens = maxTokens;
        payload = await httpJson<OpenAICompatibleResponse>(this.endpoint, {
          headers: this.authHeaders(),
          body: basePayload,
          timeoutMs: 300_000,
        });
      } else {
        throw new Error(`对话模型调用失败：${message}`);
      }
    }

    const apiError = readErrorMessage(payload);
    if (apiError) {
      throw new Error(`对话模型返回错误：${apiError}`);
    }

    const text = extractText(payload.choices?.[0]);
    if (!text) {
      throw new Error('对话模型返回了空内容，请检查模型名称与账户额度。');
    }

    return {
      content: text,
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * 流式调用（SSE），逐段吐出增量文本。
   *
   * 用法：`for await (const chunk of client.stream(...))`。
   * 若服务端忽略了 stream 参数直接返回完整 JSON，会自动降级为一次性吐出。
   */
  async *stream(
    messages: ChatMessage[],
    options: ChatInvokeOptions = {}
  ): AsyncGenerator<{ content: string }> {
    const model = options.model || this.config.model;
    if (!model) {
      throw new Error('未指定对话模型名称，请在 AI 服务配置中填写 model。');
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        stream: true,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `对话模型调用失败：HTTP ${response.status} ${response.statusText} — ${detail.slice(0, 500)}`
      );
    }

    const contentType = response.headers.get('content-type') ?? '';

    // 服务端不支持流式，按完整 JSON 处理
    if (!contentType.includes('text/event-stream') || !response.body) {
      const raw = await response.text();
      let text = raw;
      try {
        const parsed = JSON.parse(raw) as OpenAICompatibleResponse;
        text = extractText(parsed.choices?.[0]);
      } catch {
        // 保持原始文本
      }
      if (text) yield { content: text };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE 以空行分隔事件，逐行处理即可（容忍 \r\n）
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line.startsWith('data:')) continue;

          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
            };
            const delta =
              parsed.choices?.[0]?.delta?.content ??
              parsed.choices?.[0]?.message?.content ??
              '';
            if (delta) {
              yield { content: delta };
            }
          } catch {
            // 忽略心跳/非 JSON 数据行
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }
}
