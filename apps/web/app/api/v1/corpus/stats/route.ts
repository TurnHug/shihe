import { getCorpusImportStats } from '@shihe/db/server';

import { ok, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** 三源语料导入统计（供「全库」数据说明页使用）。 */
export function GET() {
  return route(async () => {
    const stats = await getCorpusImportStats();
    return ok(stats, {
      headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  });
}
