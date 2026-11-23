import { getPublicStats } from '@shihe/db/server';

import { ok, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET() {
  return route(async () => {
    const stats = await getPublicStats();
    return ok(stats, {
      headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  });
}
