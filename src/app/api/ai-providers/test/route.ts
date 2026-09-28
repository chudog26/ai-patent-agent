import { NextRequest, NextResponse } from 'next/server';
import { providerManager, toResolvedProvider } from '@/storage/database/providerManager';
import { getCurrentUser, publicErrorMessage } from '@/lib/api-helpers';
import {
  CAPABILITIES,
  ChatClient,
  ImageClient,
  WebSearchClient,
  findPreset,
  type Capability,
  type ResolvedProvider,
} from '@/lib/ai';
import { decryptSecret } from '@/lib/crypto';

/**
 * POST /api/ai-providers/test  连通性测试
 *
 * 支持两种入参：
 *   1. { id }                                  —— 测已保存的配置
 *   2. { capability, provider, baseUrl, ... }   —— 测还没保存的草稿（表单里的「测试连接」）
 *
 * 注意：图像能力的测试会真实产生一次生图调用（消耗额度）。
 */

const CAPABILITY_LABELS: Record<Capability, string> = {
  chat: '对话生成',
  search: '联网搜索',
  image: '图像生成',
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const isAdmin = user.role === 'admin';

    let config: ResolvedProvider;

    if (body.id) {
      const row = await providerManager.getConfigById(String(body.id));
      if (!row) {
        return NextResponse.json({ error: '配置不存在' }, { status: 404 });
      }
      // 全局配置所有人都能测（本来就会用到它）；个人配置只有本人能测
      if (row.userId !== null && row.userId !== user.id) {
        return NextResponse.json({ error: '无权测试他人的配置' }, { status: 403 });
      }

      config = toResolvedProvider(row, row.userId ? 'user' : 'global');

      // 表单里可能改过但还没保存，用传入值覆盖
      if (body.baseUrl) config.baseUrl = String(body.baseUrl).trim();
      if (body.model) config.model = String(body.model).trim();
      if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
        config.apiKey = body.apiKey.trim();
      } else if (!config.apiKey) {
        config.apiKey = decryptSecret(row.apiKey);
      }
    } else {
      const capability = body.capability as Capability;
      if (!CAPABILITIES.includes(capability)) {
        return NextResponse.json(
          { error: 'capability 必须是 chat / search / image 之一' },
          { status: 400 }
        );
      }

      const provider = String(body.provider ?? '').trim() || 'openai';
      const preset = findPreset(capability, provider);

      config = {
        name: body.name ? String(body.name) : '临时测试配置',
        capability,
        provider,
        model: String(body.model ?? '').trim() || preset?.defaultModel || '',
        baseUrl: String(body.baseUrl ?? '').trim() || preset?.baseUrl || '',
        apiKey: String(body.apiKey ?? '').trim(),
        temperature: body.temperature != null ? Number(body.temperature) : 0.7,
        maxTokens: body.maxTokens ? Number(body.maxTokens) : null,
        source: 'user',
      };
    }

    if (!config.baseUrl) {
      return NextResponse.json(
        { error: '接口地址（baseURL）不能为空' },
        { status: 400 }
      );
    }

    const startedAt = Date.now();
    const result = await runProbe(config, isAdmin);

    return NextResponse.json({
      success: result.ok,
      capability: config.capability,
      capabilityLabel: CAPABILITY_LABELS[config.capability],
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      elapsedMs: Date.now() - startedAt,
      message: result.message,
      sample: result.sample,
    });
  } catch (error) {
    console.error('Failed to test AI provider:', error);
    return NextResponse.json(
      { success: false, message: publicErrorMessage(error, '测试失败，请稍后重试') },
      { status: 200 }
    );
  }
}

interface ProbeResult {
  ok: boolean;
  message: string;
  sample?: string;
}

async function runProbe(config: ResolvedProvider, isAdmin: boolean): Promise<ProbeResult> {
  try {
    switch (config.capability) {
      case 'chat': {
        const client = new ChatClient(config);
        const result = await client.invoke(
          [
            { role: 'system', content: '你是一个连通性测试助手。' },
            { role: 'user', content: '请只回复两个字：可用' },
          ],
          { temperature: 0, maxTokens: 32 }
        );
        return {
          ok: true,
          message: '对话模型连接正常',
          sample: result.content.slice(0, 120),
        };
      }

      case 'search': {
        const client = new WebSearchClient(config);
        const result = await client.webSearch('专利法', 3, false);
        if (result.web_items.length === 0) {
          return { ok: false, message: '连接成功，但没有检索到任何结果，请检查账户额度或查询参数' };
        }
        return {
          ok: true,
          message: `搜索服务正常，返回 ${result.web_items.length} 条结果`,
          sample: result.web_items
            .slice(0, 3)
            .map((item) => item.title)
            .join(' | '),
        };
      }

      case 'image': {
        const client = new ImageClient(config);
        const result = await client.generate({
          prompt: '一张极简的专利附图风格线框图，白色背景，黑色线条',
          size: '1K',
        });
        if (!result.success) {
          return { ok: false, message: result.error ?? '图像生成失败' };
        }
        return {
          ok: true,
          message: '图像服务正常（本次测试已产生 1 次生图调用）',
          sample: result.imageUrls[0]?.slice(0, 80),
        };
      }

      default:
        return { ok: false, message: `不支持的能力类型：${config.capability}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: isAdmin
        ? message
        : `${message}。如果这是管理员的全局配置，请联系管理员排查。`,
    };
  }
}
