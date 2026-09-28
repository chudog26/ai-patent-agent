import { NextRequest, NextResponse } from 'next/server';
import { userManager } from '@/storage/database';
import type { User } from '@/storage/database/shared/schema';
import { ProviderNotConfiguredError } from '@/lib/ai/types';

/**
 * 路由层公共工具：统一取用户、校验管理员、把 AI 相关异常翻译成可读的响应。
 *
 * 注意：当前鉴权仍沿用「前端传 x-user-id 请求头」的历史方案，仅作为过渡；
 * 它无法防止请求头伪造，生产环境建议接入真正的会话/Token 机制。
 */

export function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

/** 取当前用户，未登录返回 null */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const userId = getUserIdFromRequest(request);
  if (!userId) return null;
  return userManager.getUserById(userId);
}

/** 要求管理员权限；不满足时直接返回错误响应 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: User } | { error: NextResponse }> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return {
      error: NextResponse.json({ error: '请先登录' }, { status: 401 }),
    };
  }

  const user = await userManager.getUserById(userId);
  if (!user) {
    return {
      error: NextResponse.json({ error: '用户不存在或已失效' }, { status: 401 }),
    };
  }

  if (user.role !== 'admin') {
    return {
      error: NextResponse.json({ error: '需要管理员权限' }, { status: 403 }),
    };
  }

  return { user };
}

/**
 * 判断一段异常文本是否来自数据库驱动/SQL 层，而非用户可理解的上游服务报错。
 * 驱动层文本会带上完整 SQL 与绑定参数（含加密后的密钥），绝不能回显给客户端。
 */
const DRIVER_ERROR_PATTERNS: RegExp[] = [
  /Failed query:/i,
  /\bparams:/i,
  /\b(insert into|update|delete from|select)\s+"/i,
  /duplicate key value violates/i,
  /violates unique constraint/i,
  /syntax error at or near/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /enc:v\d+:/,
];

export function looksLikeDriverError(message: string): boolean {
  return DRIVER_ERROR_PATTERNS.some((re) => re.test(message));
}

/**
 * 把异常转换成可以安全展示给用户的文案。
 * - 模型未配置、上游服务返回的报错（如密钥无效）属于用户能自行解决的问题，原样透出；
 * - 数据库驱动层报错只保留通用兜底文案，原文留待服务端日志排查。
 */
export function publicErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (!message.trim() || looksLikeDriverError(message)) {
    return fallback;
  }
  return message;
}

/**
 * 把异常转换成 JSON 响应。
 * 模型未配置属于用户可自行解决的问题，返回 400 并附上引导文案，
 * 而不是笼统的 500——这样前端可以直接把提示展示给用户。
 */
export function errorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof ProviderNotConfiguredError) {
    return NextResponse.json(
      { error: error.message, code: 'PROVIDER_NOT_CONFIGURED', capability: error.capability },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: fallbackMessage, detail: publicErrorMessage(error, fallbackMessage) },
    { status: 500 }
  );
}

/** 从 SSE 流里向客户端发一条 JSON 事件 */
export function sseEncode(payload: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload) + '\n\n');
}

interface ZodLikeIssue {
  path?: Array<string | number>;
  message?: string;
}

/**
 * 判断是否为 zod 校验失败。
 * 不直接 import zod 类型，改为 duck-typing，避免路由层额外耦合。
 */
export function getValidationIssues(error: unknown): ZodLikeIssue[] | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { name?: string; issues?: unknown };
  if (candidate.name !== 'ZodError' || !Array.isArray(candidate.issues)) return null;
  return candidate.issues as ZodLikeIssue[];
}

/**
 * 把 zod 校验失败转成可读文案。
 * 这类问题出在请求入参上，属于调用方可自行修正的错误，应当返回 400 而不是 500。
 */
export function validationErrorMessage(error: unknown): string {
  const issues = getValidationIssues(error);
  if (!issues || issues.length === 0) return '请求参数不合法';
  const parts = issues.slice(0, 3).map((issue) => {
    const field = (issue.path ?? []).filter((p) => typeof p === 'string').join('.');
    return field ? `${field}: ${issue.message}` : String(issue.message);
  });
  const more = issues.length > 3 ? ` 等 ${issues.length} 处` : '';
  return `请求参数不合法（${parts.join('；')}${more}）`;
}
