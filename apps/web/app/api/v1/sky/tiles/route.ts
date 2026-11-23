import type { NextRequest } from 'next/server';

import { getSkyTile } from '@shihe/db/server';
import { isSkyMode, MAX_TILE_Z } from '@shihe/domain';

import { fail, ok, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return route(async () => {
    const params = request.nextUrl.searchParams;
    const mode = params.get('mode');
    if (!isSkyMode(mode)) {
      return fail('BAD_REQUEST', 'mode 必须是 river 或 galaxy。');
    }
    const z = Number.parseInt(params.get('z') ?? '0', 10);
    const x = Number.parseInt(params.get('x') ?? '0', 10);
    const y = Number.parseInt(params.get('y') ?? '0', 10);
    if (!Number.isFinite(z) || z < 0 || z > MAX_TILE_Z) {
      return fail('BAD_REQUEST', `z 必须在 0–${MAX_TILE_Z} 之间。`);
    }
    try {
      const tile = await getSkyTile({ mode, z, x, y });
      return ok(tile.stars, {
        meta: { mode: tile.mode, z: tile.z, x: tile.x, y: tile.y, count: tile.stars.length },
        headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' },
      });
    } catch (error) {
      if (error instanceof RangeError) {
        return fail('BAD_REQUEST', error.message);
      }
      throw error;
    }
  });
}
