import type { NextRequest } from 'next/server';

import { getPoetDetail, listPoetWorks } from '@shihe/db/server';
import { isGenre } from '@shihe/domain';
import type { Genre } from '@shihe/domain';

import { fail, ok, parseInteger, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const params = request.nextUrl.searchParams;
    const genre = params.get('genre');
    if (genre && !isGenre(genre)) {
      return fail('BAD_REQUEST', 'genre 必须是 shi、ci 或 qu。');
    }
    const poet = await getPoetDetail(id);
    if (!poet) {
      return fail('NOT_FOUND', '未找到该诗人，或内容尚未发布。');
    }
    const result = await listPoetWorks(id, {
      cursor: params.get('cursor') ?? undefined,
      limit: parseInteger(params.get('limit'), 30, 1, 100),
      q: params.get('q') ?? undefined,
      genre: (genre as Genre | null) ?? undefined,
    });
    return ok(result.data, {
      meta: {
        ...result.meta,
        poetId: poet.id,
        poetName: poet.name,
        dynastyLabel: poet.dynastyLabel,
        genres: poet.genres,
      },
    });
  });
}
