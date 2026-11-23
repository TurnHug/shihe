import type { NextRequest } from 'next/server';

import { getSkyManifest } from '@shihe/db/server';

import { ok, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET(_request: NextRequest) {
  return route(async () => {
    const manifest = await getSkyManifest();
    return ok(manifest, {
      headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=120' },
    });
  });
}
