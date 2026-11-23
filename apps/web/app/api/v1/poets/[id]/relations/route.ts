import { getPoetDetail, getPoetRelations } from '@shihe/db/server';

import { fail, ok, route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const poet = await getPoetDetail(id);
    if (!poet) {
      return fail('NOT_FOUND', '未找到该诗人，或内容尚未发布。');
    }
    const relations = await getPoetRelations(id);
    return ok(relations, {
      meta: {
        available: relations.length > 0,
        note:
          relations.length > 0
            ? '仅展示已审核且有史料来源的关系连线。'
            : '该诗人的关系资料尚在审核整理中。',
        phase: '阶段 4（PRD Phase 3）',
      },
    });
  });
}
