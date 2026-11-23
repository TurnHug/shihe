import { sql } from 'drizzle-orm';

import type { CuratedDataset } from '@shihe/domain';

import type { Database } from './client';
import * as schema from './schema';

/**
 * 将离线构建好的数据集写入 PostgreSQL。
 * - 整个导入在单个事务中完成，失败自动回滚；
 * - 先写来源、时期、诗人，再写作品与坐标，最后记录导入审计；
 * - `content_hash` 唯一索引用于捕捉重复作品。
 */
export async function ingestDataset(db: Database, dataset: CuratedDataset): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. 清空公开数据（保留 schema 与扩展）。CASCADE 处理外键顺序。
    await tx.execute(sql`
      TRUNCATE TABLE
        layout_positions,
        work_sources,
        work_variants,
        work_authors,
        works,
        poet_periods,
        poet_aliases,
        poet_relations,
        poets,
        periods,
        sources,
        app_meta,
        ingestion_jobs
      RESTART IDENTITY CASCADE
    `);

    // 2. 历史时期使用领域常量作为唯一真源，避免种子数据各说各话。
    const { PERIODS } = await import('@shihe/domain');
    await tx.insert(schema.periods).values(
      PERIODS.map((period) => ({
        id: period.id,
        name: period.name,
        shortName: period.shortName,
        startYear: period.startYear,
        endYear: period.endYear,
        parentId: period.parentId,
        periodKind: period.periodKind,
        sortOrder: period.sortOrder,
        parallel: period.parallel,
        description: period.description,
      })),
    );

    // 3. 来源与许可。
    if (dataset.sources.length > 0) {
      await tx.insert(schema.sources).values(
        dataset.sources.map((source) => ({
          id: source.id,
          title: source.title,
          editor: source.editor,
          edition: source.edition,
          urlOrBib: source.urlOrBib,
          license: source.license,
          rightsStatus: source.rightsStatus,
          rightsNote: source.rightsNote,
          verifiedAt: source.verifiedAt ? new Date(source.verifiedAt) : null,
        })),
      );
    }

    // 4. 诗人主档。
    if (dataset.poets.length > 0) {
      await tx.insert(schema.poets).values(
        dataset.poets.map((poet) => ({
          id: poet.id,
          slug: poet.slug,
          name: poet.name,
          initial: poet.initial,
          dynastyLabel: poet.dynastyLabel,
          bioShort: poet.bioShort,
          birthYear: poet.birthYear,
          deathYear: poet.deathYear,
          activityStart: poet.activityStart,
          activityEnd: poet.activityEnd,
          datePrecision: poet.datePrecision,
          dateNote: poet.dateNote,
          impactTier: poet.impactTier,
          impactSources: poet.impactSources,
          impactReviewNote: poet.impactReviewNote,
          primaryPeriodId: poet.primaryPeriodId,
          publishStatus: 'published' as const,
          dataNote: poet.dataNote,
        })),
      );
    }

    // 5. 别名与朝代多对多。
    const aliasRows = dataset.poets.flatMap((poet) =>
      poet.aliases.map((alias) => ({
        poetId: poet.id,
        alias: alias.alias,
        aliasType: alias.aliasType,
      })),
    );
    if (aliasRows.length > 0) {
      await tx.insert(schema.poetAliases).values(aliasRows);
    }

    const membershipRows = dataset.poets.flatMap((poet) =>
      poet.periodMemberships.map((membership) => ({
        poetId: poet.id,
        periodId: membership.periodId,
        membershipType: membership.membershipType,
        evidenceId: null,
      })),
    );
    if (membershipRows.length > 0) {
      await tx.insert(schema.poetPeriods).values(membershipRows);
    }

    // 6. 作品与来源。分批插入，避免单条 SQL 参数过多。
    const chunkSize = 200;
    for (let index = 0; index < dataset.works.length; index += chunkSize) {
      const chunk = dataset.works.slice(index, index + chunkSize);
      await tx.insert(schema.works).values(
        chunk.map((work) => ({
          id: work.id,
          poetId: work.poetId,
          title: work.title,
          genre: work.genre,
          textOriginal: work.text,
          textNormalized: work.text,
          featured: work.featured,
          attributionStatus: work.attributionStatus,
          publishStatus: 'published' as const,
          rightsStatus: 'cleared' as const,
          canonicalWorkId: null,
          sourceId: work.sourceId,
          sourceLocator: work.sourceLocator,
          contentHash: work.contentHash,
          sortIndex: work.sortIndex,
        })),
      );
    }

    const workAuthorRows = dataset.works.map((work) => ({
      workId: work.id,
      poetId: work.poetId,
      attributionType: 'primary' as const,
      evidenceId: null,
    }));
    for (let index = 0; index < workAuthorRows.length; index += chunkSize) {
      await tx.insert(schema.workAuthors).values(workAuthorRows.slice(index, index + chunkSize));
    }

    const workSourceRows = dataset.works.map((work) => ({
      workId: work.id,
      sourceId: work.sourceId,
      relationType: 'text',
      sourceLocator: work.sourceLocator,
    }));
    for (let index = 0; index < workSourceRows.length; index += chunkSize) {
      await tx.insert(schema.workSources).values(workSourceRows.slice(index, index + chunkSize));
    }

    // 6.1 人物关系（只写入已审核、有来源的关系）。
    if (dataset.relations.length > 0) {
      await tx.insert(schema.poetRelations).values(
        dataset.relations.map((relation) => ({
          id: relation.id,
          poetAId: relation.poetAId,
          poetBId: relation.poetBId,
          relationType: relation.relationType,
          direction: relation.direction,
          sourceId: relation.sourceId,
          confidence: relation.confidence,
          evidence: relation.evidence,
          publishStatus: 'published' as const,
        })),
      );
    }

    // 7. 双模式坐标。
    const layoutRows = [
      ...dataset.layouts.river.points.map((point) => ({
        poetId: point.poetId,
        mode: 'river' as const,
        x: point.x,
        y: point.y,
        layoutVersion: dataset.layouts.version,
      })),
      ...dataset.layouts.galaxy.points.map((point) => ({
        poetId: point.poetId,
        mode: 'galaxy' as const,
        x: point.x,
        y: point.y,
        layoutVersion: dataset.layouts.version,
      })),
    ];
    for (let index = 0; index < layoutRows.length; index += chunkSize) {
      await tx.insert(schema.layoutPositions).values(layoutRows.slice(index, index + chunkSize));
    }

    // 8. 星图世界范围与统计快照（manifest / 瓦片查询使用）。
    const metaRows = [
      {
        key: 'layout:river',
        value: {
          mode: 'river',
          version: dataset.layouts.version,
          ...dataset.layouts.river.bounds,
          defaultView: dataset.layouts.river.defaultView,
          maxWorkCount: dataset.layouts.maxWorkCount,
        },
      },
      {
        key: 'layout:galaxy',
        value: {
          mode: 'galaxy',
          version: dataset.layouts.version,
          ...dataset.layouts.galaxy.bounds,
          defaultView: dataset.layouts.galaxy.defaultView,
          maxWorkCount: dataset.layouts.maxWorkCount,
        },
      },
      {
        key: 'dataNote',
        value:
          '本网站为持续整理的数字诗词资料库。当前为阶段 0–4 工程验证样本：收录先秦至民国代表性诗人，作品来自《全唐诗》《全宋诗》《全宋词》《元曲》《楚辞》及纳兰词等公开古籍数据，并与经典选本交叉核对代表作；人物关系仅收录有史传、别集、诗文篇目或文学史并称依据的条目。收录数量不等于作者传世作品总数。',
      },
    ];
    await tx.insert(schema.appMeta).values(metaRows);

    // 9. 导入审计。
    await tx.insert(schema.ingestionJobs).values({
      datasetName: 'shihe-curated-sample',
      version: dataset.version,
      reviewStatus: 'reviewed-for-phase-02',
      statistics: {
        poets: dataset.stats.poets,
        works: dataset.stats.works,
        byGenre: dataset.stats.byGenre,
        byPeriod: dataset.stats.byPeriod,
        layoutVersion: dataset.layouts.version,
      },
      notes: dataset.notes,
    });
  });
}
