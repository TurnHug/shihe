import type { NextRequest } from 'next/server';

import { listPoets } from '@shihe/db/server';
import { isGenre } from '@shihe/domain';
import type { Genre } from '@shihe/domain';

import { fail, ok, parseInteger, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return route(async () => {
    const params = request.nextUrl.searchParams;
    const genre = params.get('genre');
    if (genre && !isGenre(genre)) {
      return fail('BAD_REQUEST', 'genre 必须是 shi、ci 或 qu。');
    }
    const scope = params.get('scope');
    if (scope && scope !== 'curated' && scope !== 'corpus' && scope !== 'all') {
      return fail('BAD_REQUEST', 'scope 必须是 curated、corpus 或 all。');
    }
    const result = await listPoets({
      scope: (scope as 'curated' | 'corpus' | 'all' | null) ?? undefined,
      periodId: params.get('periodId') ?? undefined,
      genre: (genre as Genre | null) ?? undefined,
      q: params.get('q') ?? undefined,
      cursor: params.get('cursor') ?? undefined,
      limit: parseInteger(params.get('limit'), 30, 1, 100),
    });
    return ok(result.data, { meta: result.meta });
  });
}
