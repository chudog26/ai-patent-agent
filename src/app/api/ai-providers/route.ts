import { NextRequest, NextResponse } from 'next/server';
import {
  providerManager,
  ConfigConflictError,
  type ProviderConfigInput,
} from '@/storage/database/providerManager';
import { getCurrentUser, publicErrorMessage } from '@/lib/api-helpers';
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  PROVIDER_PRESETS,
  getProviderStatus,
  type Capability,
} from '@/lib/ai';
import type { ProviderConfigView } from '@/storage/database/providerManager';

/**
 * GET  /api/ai-providers  返回配置列表 + 供应商预设 + 当前生效状态
 * POST /api/ai-providers  新建配置
 *
 * 作用域规则：
 *   - 管理员可以创建 scope=global 的全局配置，供所有用户兜底使用
 *   - 任何登录用户都可以创建 scope=user 的配置，即「自带 Key」
 */

interface AiProviderResponse {
  configs: ProviderConfigView[];
  presets: typeof PROVIDER_PRESETS;
  capabilityLabels: typeof CAPABILITY_LABELS;
  capabilities: Capability[];
  status: Awaited<ReturnType<typeof getProviderStatus>>;
  isAdmin: boolean;
}

function parseCapability(value: unknown): Capability | null {
  return CAPABILITIES.includes(value as Capability) ? (value as Capability) : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin';
    const requestedScope = request.nextUrl.searchParams.get('scope');

    // 默认：管理员看全局配置，普通用户看自己那份
    const scope = requestedScope ?? (isAdmin ? 'global' : 'user');

    if (scope === 'global' && !isAdmin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const configs =
      scope === 'global'
        ? await providerManager.listGlobalConfigs()
        : await providerManager.listUserConfigs(user.id);

    const payload: AiProviderResponse = {
      configs,
      presets: PROVIDER_PRESETS,
      capabilityLabels: CAPABILITY_LABELS,
      capabilities: CAPABILITIES,
      status: await getProviderStatus(user.id),
      isAdmin,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to list AI providers:', error);
    return NextResponse.json(
      { error: '获取 AI 服务配置失败', detail: publicErrorMessage(error, '获取 AI 服务配置失败') },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const isAdmin = user.role === 'admin';

    const scope: 'global' | 'user' =
      body.scope === 'global' && isAdmin ? 'global' : 'user';

    const capability = parseCapability(body.capability);
    if (!capability) {
      return NextResponse.json(
        { error: 'capability 必须是 chat / search / image 之一' },
        { status: 400 }
      );
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: '配置名称不能为空' }, { status: 400 });
    }

    if (!body.provider || typeof body.provider !== 'string') {
      return NextResponse.json({ error: '请选择服务商' }, { status: 400 });
    }

    // 图像与对话必须有模型名；搜索不需要
    if (capability !== 'search' && !body.model) {
      return NextResponse.json({ error: '模型名称不能为空' }, { status: 400 });
    }

    const input: ProviderConfigInput = {
      name: body.name.trim(),
      capability,
      provider: String(body.provider).trim(),
      model: String(body.model ?? '').trim(),
      baseUrl: body.baseUrl ? String(body.baseUrl).trim() : null,
      apiKey: body.apiKey ? String(body.apiKey).trim() : null,
      temperature: body.temperature != null ? String(body.temperature) : null,
      maxTokens:
        body.maxTokens !== undefined && body.maxTokens !== null && body.maxTokens !== ''
          ? Number(body.maxTokens)
          : null,
      description: body.description ? String(body.description) : null,
      userId: scope === 'global' ? null : user.id,
      isActive: body.isActive ?? true,
      isDefault: body.isDefault ?? false,
    };

    const config = await providerManager.createConfig(input);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Failed to create AI provider:', error);
    if (error instanceof ConfigConflictError) {
      return NextResponse.json(
        { error: error.message, code: 'CONFIG_CONFLICT' },
        { status: 409 }
      );
    }
    // 驱动层异常可能夹带 SQL 与参数，只记服务端日志，对外给通用文案
    return NextResponse.json({ error: '创建配置失败，请稍后重试' }, { status: 500 });
  }
}
