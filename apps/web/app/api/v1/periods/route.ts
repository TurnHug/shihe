import { listPeriods } from '@shihe/db/server';

import { ok, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET() {
  return route(async () => {
    const periods = await listPeriods();
    return ok(periods, {
      headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  });
}
