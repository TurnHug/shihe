/**
 * 极简内存限流：用于搜索等公开读接口。
 * 单实例开发/小规模部署足够；生产环境应替换为 Redis 或网关级限流。
 */
const buckets = new Map<string, { tokens: number; updatedAt: number }>();

const CAPACITY = 30;
const REFILL_PER_SECOND = 1.2;

export function takeToken(key: string, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket) {
    buckets.set(key, { tokens: CAPACITY - 1, updatedAt: now });
    return true;
  }
  const elapsedSeconds = Math.max(0, (now - bucket.updatedAt) / 1000);
  const tokens = Math.min(CAPACITY, bucket.tokens + elapsedSeconds * REFILL_PER_SECOND);
  bucket.updatedAt = now;
  if (tokens < 1) {
    bucket.tokens = tokens;
    return false;
  }
  bucket.tokens = tokens - 1;
  return true;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'anonymous';
  return request.headers.get('x-real-ip') ?? 'anonymous';
}
