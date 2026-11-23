import { getWorkDetail } from '@shihe/db/server';

import { fail, ok, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const work = await getWorkDetail(id);
    if (!work) {
      return fail('NOT_FOUND', '未找到该作品，或内容已撤回。');
    }
    return ok(work, {
      headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  });
}
