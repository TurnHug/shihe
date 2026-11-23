import type { NextRequest } from 'next/server';

import { searchAll } from '@shihe/db/server';

import { fail, ok, parseInteger, route } from '@/lib/server/http';
import { clientKey, takeToken } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return route(async () => {
    if (!takeToken(`search:${clientKey(request)}`)) {
      return fail('RATE_LIMITED', '搜索请求过于频繁，请稍后再试。');
    }
    const params = request.nextUrl.searchParams;
    const q = (params.get('q') ?? '').trim();
    if (q.length === 0) {
      return fail('BAD_REQUEST', '请输入搜索关键词。');
    }
    if (Array.from(q).length > 48) {
      return fail('BAD_REQUEST', '搜索关键词过长，请精简后再试。');
    }
    const type = params.get('type');
    if (type && type !== 'poet' && type !== 'work') {
      return fail('BAD_REQUEST', 'type 必须是 poet 或 work。');
    }
    const result = await searchAll({
      q,
      type: (type as 'poet' | 'work' | null) ?? undefined,
      limit: parseInteger(params.get('limit'), 20, 1, 30),
    });
    return ok(
      {
        query: result.query,
        poets: result.poets,
        works: result.works,
        total: result.total,
      },
      {
        meta: {
          poets: result.poets.length,
          works: result.works.length,
          limited: true,
          note: '结果为已发布诗人与作品的匹配展示，按标题相关度与代表作优先排序。',
        },
      },
    );
  });
}
