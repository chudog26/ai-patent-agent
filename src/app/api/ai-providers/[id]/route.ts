import { NextRequest, NextResponse } from 'next/server';
import {
  providerManager,
  ConfigConflictError,
  type ProviderConfigInput,
} from '@/storage/database/providerManager';
import { getCurrentUser } from '@/lib/api-helpers';
import { CAPABILITIES, type Capability } from '@/lib/ai';

/**
 * PUT    /api/ai-providers/[id]  更新配置
 * DELETE /api/ai-providers/[id]  删除配置
 *
 * 权限：管理员可操作全局配置；用户只能操作自己名下的配置。
 * 注意：apiKey 传空字符串表示「保持原密钥不变」，避免前端脱敏展示后误清空。
 */

function parseCapability(value: unknown): Capability | null {
  return CAPABILITIES.includes(value as Capability) ? (value as Capability) : null;
}

/** 校验当前用户是否有权操作这条配置 */
async function assertEditable(id: string, userId: string, isAdmin: boolean) {
  const config = await providerManager.getConfigById(id);
  if (!config) {
    return { error: NextResponse.json({ error: '配置不存在' }, { status: 404 }) };
  }

  const isGlobal = config.userId === null;
  if (isGlobal && !isAdmin) {
    return { error: NextResponse.json({ error: '需要管理员权限' }, { status: 403 }) };
  }
  if (!isGlobal && config.userId !== userId) {
    return { error: NextResponse.json({ error: '无权操作他人的配置' }, { status: 403 }) };
  }

  return { config };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const guard = await assertEditable(id, user.id, user.role === 'admin');
    if ('error' in guard) return guard.error;

    const body = await request.json();

    const patch: Partial<ProviderConfigInput> = {};
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.provider !== undefined) patch.provider = String(body.provider).trim();
    if (body.model !== undefined) patch.model = String(body.model).trim();
    if (body.baseUrl !== undefined) patch.baseUrl = body.baseUrl ? String(body.baseUrl).trim() : null;
    if (body.description !== undefined) patch.description = body.description || null;
    if (body.temperature !== undefined) patch.temperature = String(body.temperature);
    if (body.maxTokens !== undefined) {
      patch.maxTokens =
        body.maxTokens === null || body.maxTokens === '' ? null : Number(body.maxTokens);
    }
    if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
    if (body.isDefault !== undefined) patch.isDefault = Boolean(body.isDefault);

    if (body.capability !== undefined) {
      const capability = parseCapability(body.capability);
      if (!capability) {
        return NextResponse.json(
          { error: 'capability 必须是 chat / search / image 之一' },
          { status: 400 }
        );
      }
      patch.capability = capability;
    }

    // 空串视为保留原密钥
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      patch.apiKey = body.apiKey.trim();
    }

    const config = await providerManager.updateConfig(id, patch);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Failed to update AI provider:', error);
    if (error instanceof ConfigConflictError) {
      return NextResponse.json(
        { error: error.message, code: 'CONFIG_CONFLICT' },
        { status: 409 }
      );
    }
    // 驱动层异常可能夹带 SQL 与参数，只记服务端日志，对外给通用文案
    return NextResponse.json({ error: '更新配置失败，请稍后重试' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const guard = await assertEditable(id, user.id, user.role === 'admin');
    if ('error' in guard) return guard.error;

    await providerManager.deleteConfig(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete AI provider:', error);
    return NextResponse.json({ error: '删除配置失败' }, { status: 500 });
  }
}
