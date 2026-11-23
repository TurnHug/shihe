import { NextResponse } from 'next/server';

import type { ApiErrorBody } from '@shihe/domain';

type ErrorCode = ApiErrorBody['error']['code'];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  GONE: 410,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export function ok<T>(data: T, init?: { meta?: Record<string, unknown>; headers?: HeadersInit }) {
  return NextResponse.json(init?.meta ? { data, meta: init.meta } : { data }, {
    status: 200,
    headers: init?.headers,
  });
}

export function fail(code: ErrorCode, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  return NextResponse.json(body, { status: STATUS_BY_CODE[code] });
}

/**
 * 统一处理 API 错误，避免把内部异常细节返回给客户端。
 * 参数校验错误应在上层显式返回 400，这里只兜底 500。
 */
export async function route(
  handler: () => Promise<NextResponse<unknown>>,
): Promise<NextResponse<unknown>> {
  try {
    return await handler();
  } catch (error) {
    console.error('[api] 未处理异常', error);
    return fail('INTERNAL', '服务暂时不可用，请稍后重试。');
  }
}

export function parseInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value == null) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
