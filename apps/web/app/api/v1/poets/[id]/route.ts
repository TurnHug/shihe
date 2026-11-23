import { getPoetDetail } from '@shihe/db/server';

import { fail, ok, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const poet = await getPoetDetail(id);
    if (!poet) {
      return fail('NOT_FOUND', '未找到该诗人，或内容尚未发布。');
    }
    return ok(poet, {
      headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  });
}
