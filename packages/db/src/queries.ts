import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';

import {
  DATA_VERSION,
  GALAXY_REALMS,
  GALAXY_WORLD_HEIGHT,
  GALAXY_WORLD_WIDTH,
  LAYOUT_VERSION,
  MAX_TILE_Z,
  PERIOD_TO_REALM,
  RIVER_UNKNOWN_YEAR_X,
  decodeCursor,
  describeDates,
  encodeCursor,
  excerptFromText,
  isGenre,
  labelPriority,
  normalizePoemText,
  starRadius,
} from '@shihe/domain';
import type {
  Genre,
  Paginated,
  PoetDetail,
  PoetRelation,
  PoetSummary,
  PoetWorkListQuery,
  PublicStats,
  SearchResultGroups,
  SkyManifest,
  SkyMode,
  SkyTileResponse,
  SkyWorld,
  SourceRef,
  StarPoint,
  WorkDetail,
  WorkSummary,
} from '@shihe/domain';

import type { Database } from './client';
import { getDatabase } from './client';
import * as schema from './schema';

type DB = Database;

type PoetRow = typeof schema.poets.$inferSelect;
type WorkRow = typeof schema.works.$inferSelect;
type SourceRow = typeof schema.sources.$inferSelect;

const publishedWorkCondition = and(
  eq(schema.works.publishStatus, 'published'),
  eq(schema.works.rightsStatus, 'cleared'),
);

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MAX_SEARCH_LIMIT = 30;

export interface ListPoetsParams {
  periodId?: string;
  genre?: Genre;
  q?: string;
  cursor?: string;
  limit?: number;
  /** curated = 仅星图作者（默认）；corpus = 仅批量导入；all = 全部 */
  scope?: 'curated' | 'corpus' | 'all';
}

export interface SearchParams {
  q: string;
  type?: 'poet' | 'work';
  limit?: number;
}

interface WorldMeta {
  mode: SkyMode;
  version: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  defaultView: { x: number; y: number; zoom: number };
  maxWorkCount: number;
}

/* ------------------------------------------------------------------ */
/* 工具函数                                                            */
/* ------------------------------------------------------------------ */

function clampLimit(value: number | undefined, fallback = DEFAULT_LIMIT): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
}

function mapSource(row: SourceRow): SourceRef {
  return {
    id: row.id,
    title: row.title,
    editor: row.editor,
    edition: row.edition,
    urlOrBib: row.urlOrBib,
    license: row.license,
    rightsStatus: row.rightsStatus,
    rightsNote: row.rightsNote,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  };
}

function mapPoet(
  row: PoetRow,
  context: {
    periodName: string | null;
    publishedWorkCount: number;
  },
): PoetSummary {
  const dates = describeDates({
    birthYear: row.birthYear,
    deathYear: row.deathYear,
    activityStart: row.activityStart,
    activityEnd: row.activityEnd,
    datePrecision: row.datePrecision,
    periodId: row.primaryPeriodId ?? undefined,
  });
  return {
    id: row.id,
    name: row.name,
    dynastyLabel: row.dynastyLabel,
    dateDisplay: row.dataTier === 'imported' ? '年代待考' : dates.display,
    datePrecision: row.datePrecision,
    periodId: row.primaryPeriodId ?? '',
    periodName: context.periodName ?? '',
    publishedWorkCount: context.publishedWorkCount,
    impactTier: row.impactTier,
    bioShort: row.bioShort,
    initial: row.initial,
    dataTier: row.dataTier,
    skyVisible: row.skyVisible,
  };
}

async function countWorksByPoet(db: DB, poetIds: readonly string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (poetIds.length === 0) return result;
  const rows = await db
    .select({ poetId: schema.works.poetId, total: count() })
    .from(schema.works)
    .where(and(publishedWorkCondition, inArray(schema.works.poetId, [...poetIds])))
    .groupBy(schema.works.poetId);
  for (const row of rows) {
    if (row.poetId) result.set(row.poetId, Number(row.total));
  }
  return result;
}

async function getMaxWorkCount(db: DB): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(schema.works)
    .innerJoin(schema.poets, eq(schema.poets.id, schema.works.poetId))
    .where(and(publishedWorkCondition, eq(schema.poets.skyVisible, true)))
    .groupBy(schema.works.poetId)
    .orderBy(desc(count()))
    .limit(1);
  return rows[0] ? Number(rows[0].total) : 1;
}

function buildWorld(mode: SkyMode, meta: WorldMeta | undefined, starCount: number): SkyWorld {
  if (mode === 'river') {
    const minX = meta?.minX ?? -280;
    const maxX = meta?.maxX ?? RIVER_UNKNOWN_YEAR_X + 640;
    const minY = meta?.minY ?? -380;
    const maxY = meta?.maxY ?? 380;
    return {
      mode,
      minX,
      minY,
      maxX,
      maxY,
      defaultView: meta?.defaultView ?? {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        zoom: 1,
      },
      starCount,
    };
  }
  const minX = meta?.minX ?? 0;
  const maxX = meta?.maxX ?? GALAXY_WORLD_WIDTH;
  const minY = meta?.minY ?? 0;
  const maxY = meta?.maxY ?? GALAXY_WORLD_HEIGHT;
  return {
    mode,
    minX,
    minY,
    maxX,
    maxY,
    defaultView: meta?.defaultView ?? {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom: 1,
    },
    starCount,
  };
}

async function readAppMeta<T>(db: DB, key: string): Promise<T | null> {
  const rows = await db
    .select({ value: schema.appMeta.value })
    .from(schema.appMeta)
    .where(eq(schema.appMeta.key, key))
    .limit(1);
  const row = rows[0];
  return row ? (row.value as T) : null;
}

async function readWorldMeta(db: DB, mode: SkyMode): Promise<WorldMeta | undefined> {
  const meta = await readAppMeta<WorldMeta>(db, `layout:${mode}`);
  return meta ?? undefined;
}

/* ------------------------------------------------------------------ */
/* 历史时期与统计数据                                                  */
/* ------------------------------------------------------------------ */

export async function listPeriods(db: DB = getDatabase()) {
  const rows = await db.select().from(schema.periods).orderBy(asc(schema.periods.sortOrder));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    startYear: row.startYear,
    endYear: row.endYear,
    parentId: row.parentId,
    periodKind: row.periodKind,
    sortOrder: row.sortOrder,
    parallel: row.parallel,
    description: row.description,
  }));
}

export async function getPublicStats(db: DB = getDatabase()): Promise<PublicStats> {
  const publishedPoet = eq(schema.poets.publishStatus, 'published');

  const [
    starPoetRows,
    catalogPoetRows,
    starWorkRows,
    catalogWorkRows,
    importedPoetRows,
    importedWorkRows,
    periodRows,
    relationRows,
    sourceRows,
    jobRows,
    corpusMeta,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.poets)
      .where(and(publishedPoet, eq(schema.poets.skyVisible, true))),
    db.select({ total: count() }).from(schema.poets).where(publishedPoet),
    db
      .select({ total: count() })
      .from(schema.works)
      .innerJoin(schema.poets, eq(schema.poets.id, schema.works.poetId))
      .where(and(publishedWorkCondition, eq(schema.poets.skyVisible, true))),
    db.select({ total: count() }).from(schema.works).where(publishedWorkCondition),
    db
      .select({ total: count() })
      .from(schema.poets)
      .where(and(publishedPoet, eq(schema.poets.dataTier, 'imported'))),
    db
      .select({ total: count() })
      .from(schema.works)
      .where(and(publishedWorkCondition, eq(schema.works.verificationStatus, 'imported'))),
    db.select({ total: count() }).from(schema.periods),
    db
      .select({ total: count() })
      .from(schema.poetRelations)
      .where(eq(schema.poetRelations.publishStatus, 'published')),
    db.select({ total: count() }).from(schema.sources),
    db
      .select({
        version: schema.ingestionJobs.version,
        importedAt: schema.ingestionJobs.importedAt,
        notes: schema.ingestionJobs.notes,
      })
      .from(schema.ingestionJobs)
      .orderBy(desc(schema.ingestionJobs.importedAt))
      .limit(1),
    readAppMeta<{ totals?: { rawRecords?: number } }>(db, 'corpus:stats'),
  ]);

  const job = jobRows[0];
  const dataNote = await readAppMeta<string>(db, 'dataNote');
  return {
    publishedPoets: Number(starPoetRows[0]?.total ?? 0),
    publishedWorks: Number(starWorkRows[0]?.total ?? 0),
    publishedPeriods: Number(periodRows[0]?.total ?? 0),
    publishedRelations: Number(relationRows[0]?.total ?? 0),
    catalogedPoets: Number(catalogPoetRows[0]?.total ?? 0),
    catalogedWorks: Number(catalogWorkRows[0]?.total ?? 0),
    importedPoets: Number(importedPoetRows[0]?.total ?? 0),
    importedWorks: Number(importedWorkRows[0]?.total ?? 0),
    corpusSources: Number(sourceRows[0]?.total ?? 0),
    corpusRawRecords: Number(corpusMeta?.totals?.rawRecords ?? 0),
    dataVersion: job?.version ?? DATA_VERSION,
    lastUpdated: job ? job.importedAt.toISOString() : '',
    dataNote:
      dataNote ?? '本网站为持续整理的数字诗词资料库，当前为工程验证样本，不代表全部传世作品。',
  };
}

export async function getCorpusImportStats(
  db: DB = getDatabase(),
): Promise<Record<string, unknown> | null> {
  return readAppMeta<Record<string, unknown>>(db, 'corpus:stats');
}

export async function getSkyManifest(db: DB = getDatabase()): Promise<SkyManifest> {
  const [stats, periods, riverMeta, galaxyMeta] = await Promise.all([
    getPublicStats(db),
    listPeriods(db),
    readWorldMeta(db, 'river'),
    readWorldMeta(db, 'galaxy'),
  ]);
  const layoutVersion = riverMeta?.version ?? LAYOUT_VERSION;
  const starCountRows = await db
    .select({ total: count() })
    .from(schema.layoutPositions)
    .where(
      and(
        eq(schema.layoutPositions.mode, 'river'),
        eq(schema.layoutPositions.layoutVersion, layoutVersion),
      ),
    );

  const genreRows = await db
    .select({ genre: schema.works.genre, total: count() })
    .from(schema.works)
    .innerJoin(schema.poets, eq(schema.poets.id, schema.works.poetId))
    .where(and(publishedWorkCondition, eq(schema.poets.skyVisible, true)))
    .groupBy(schema.works.genre);

  const genres: Record<Genre, number> = { shi: 0, ci: 0, qu: 0 };
  for (const row of genreRows) {
    genres[row.genre] = Number(row.total);
  }

  const starCount = Number(starCountRows[0]?.total ?? stats.publishedPoets);
  const jobRows = await db
    .select({ importedAt: schema.ingestionJobs.importedAt })
    .from(schema.ingestionJobs)
    .orderBy(desc(schema.ingestionJobs.importedAt))
    .limit(1);

  return {
    dataVersion: stats.dataVersion,
    layoutVersion,
    generatedAt: jobRows[0]?.importedAt.toISOString() ?? stats.lastUpdated,
    stats: {
      publishedPoets: stats.publishedPoets,
      publishedWorks: stats.publishedWorks,
      catalogedPoets: stats.catalogedPoets,
      catalogedWorks: stats.catalogedWorks,
      periods: periods.length,
      genres,
    },
    periods,
    realms: GALAXY_REALMS,
    modes: {
      river: buildWorld('river', riverMeta, starCount),
      galaxy: buildWorld('galaxy', galaxyMeta, starCount),
    },
  };
}

/* ------------------------------------------------------------------ */
/* 星图瓦片                                                            */
/* ------------------------------------------------------------------ */

export async function getSkyTile(
  params: { mode: SkyMode; z: number; x: number; y: number },
  db: DB = getDatabase(),
): Promise<SkyTileResponse> {
  const { mode } = params;
  const z = Math.max(0, Math.min(MAX_TILE_Z, Math.trunc(params.z)));
  const tilesPerAxis = 2 ** z;
  if (params.x < 0 || params.y < 0 || params.x >= tilesPerAxis || params.y >= tilesPerAxis) {
    throw new RangeError('瓦片坐标超出范围');
  }

  const meta = await readWorldMeta(db, mode);
  const world = buildWorld(mode, meta, 0);
  const worldWidth = world.maxX - world.minX;
  const worldHeight = world.maxY - world.minY;
  const tileWidth = worldWidth / tilesPerAxis;
  const tileHeight = worldHeight / tilesPerAxis;
  const minX = world.minX + tileWidth * params.x;
  const maxX = minX + tileWidth;
  const minY = world.minY + tileHeight * params.y;
  const maxY = minY + tileHeight;

  const layoutVersion = meta?.version ?? LAYOUT_VERSION;
  const maxWorkCount = meta?.maxWorkCount ?? (await getMaxWorkCount(db));

  const rows = await db
    .select({
      poetId: schema.poets.id,
      name: schema.poets.name,
      x: schema.layoutPositions.x,
      y: schema.layoutPositions.y,
      impactTier: schema.poets.impactTier,
      periodId: schema.poets.primaryPeriodId,
      birthYear: schema.poets.birthYear,
      deathYear: schema.poets.deathYear,
      activityStart: schema.poets.activityStart,
      activityEnd: schema.poets.activityEnd,
      datePrecision: schema.poets.datePrecision,
    })
    .from(schema.layoutPositions)
    .innerJoin(schema.poets, eq(schema.poets.id, schema.layoutPositions.poetId))
    .where(
      and(
        eq(schema.layoutPositions.mode, mode),
        eq(schema.layoutPositions.layoutVersion, layoutVersion),
        eq(schema.poets.publishStatus, 'published'),
        eq(schema.poets.skyVisible, true),
        gte(schema.layoutPositions.x, minX),
        lte(schema.layoutPositions.x, maxX),
        gte(schema.layoutPositions.y, minY),
        lte(schema.layoutPositions.y, maxY),
      ),
    );

  const poetIds = rows.map((row) => row.poetId);
  const [counts, genreRows] = await Promise.all([
    countWorksByPoet(db, poetIds),
    poetIds.length > 0
      ? db
          .select({ poetId: schema.works.poetId, genre: schema.works.genre })
          .from(schema.works)
          .where(
            and(
              publishedWorkCondition,
              eq(schema.works.verificationStatus, 'curated'),
              inArray(schema.works.poetId, poetIds),
            ),
          )
          .groupBy(schema.works.poetId, schema.works.genre)
      : Promise.resolve([] as { poetId: string | null; genre: Genre }[]),
  ]);
  const genresByPoet = new Map<string, Genre[]>();
  for (const row of genreRows) {
    if (!row.poetId) continue;
    const list = genresByPoet.get(row.poetId) ?? [];
    list.push(row.genre);
    genresByPoet.set(row.poetId, list);
  }

  const stars: StarPoint[] = rows.map((row) => {
    const workCount = counts.get(row.poetId) ?? 0;
    const dates = describeDates({
      birthYear: row.birthYear,
      deathYear: row.deathYear,
      activityStart: row.activityStart,
      activityEnd: row.activityEnd,
      datePrecision: row.datePrecision,
      periodId: row.periodId ?? undefined,
    });
    return {
      poetId: row.poetId,
      name: row.name,
      x: row.x,
      y: row.y,
      radiusBase: starRadius(workCount, maxWorkCount),
      publishedWorkCount: workCount,
      impactTier: row.impactTier,
      periodId: row.periodId ?? '',
      realmId: PERIOD_TO_REALM.get(row.periodId ?? '') ?? null,
      genres: genresByPoet.get(row.poetId) ?? [],
      labelPriority: labelPriority(row.impactTier, workCount),
      dateDisplay: dates.display,
    };
  });

  stars.sort((a, b) => b.labelPriority - a.labelPriority);
  return { mode, z, x: params.x, y: params.y, stars };
}

/* ------------------------------------------------------------------ */
/* 诗人目录 / 详情                                                     */
/* ------------------------------------------------------------------ */

interface PoetCursor {
  o: number;
  b: number;
  i: string;
}

export async function listPoets(
  params: ListPoetsParams = {},
  db: DB = getDatabase(),
): Promise<Paginated<PoetSummary>> {
  const limit = clampLimit(params.limit);
  const conditions = [eq(schema.poets.publishStatus, 'published')];
  if (params.scope === 'corpus') {
    conditions.push(eq(schema.poets.dataTier, 'imported'));
  } else if (params.scope === 'all') {
    // 全库
  } else {
    conditions.push(eq(schema.poets.skyVisible, true));
  }

  if (params.periodId) {
    conditions.push(eq(schema.poets.primaryPeriodId, params.periodId));
  }
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(schema.poets.name, pattern),
        sql`EXISTS (SELECT 1 FROM poet_aliases pa WHERE pa.poet_id = ${schema.poets.id} AND pa.alias ILIKE ${pattern})`,
      )!,
    );
  }
  if (params.genre && isGenre(params.genre)) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM works w WHERE w.poet_id = ${schema.poets.id} AND w.publish_status = 'published' AND w.rights_status = 'cleared' AND w.verification_status = 'curated' AND w.genre = ${params.genre})`,
    );
  }

  const cursor = params.cursor ? decodeCursor<PoetCursor>(params.cursor) : null;
  const sortOrderSql = sql<number>`COALESCE(${schema.periods.sortOrder}, 99)`;
  const birthSortSql = sql<number>`COALESCE(${schema.poets.birthYear}, 99999)`;

  if (cursor) {
    conditions.push(
      sql`(${sortOrderSql} > ${cursor.o}
        OR (${sortOrderSql} = ${cursor.o} AND ${birthSortSql} > ${cursor.b})
        OR (${sortOrderSql} = ${cursor.o} AND ${birthSortSql} = ${cursor.b} AND ${schema.poets.id} > ${cursor.i}))`,
    );
  }

  const rows = await db
    .select({
      poet: schema.poets,
      periodName: schema.periods.name,
      sortOrder: sortOrderSql,
      birthSort: birthSortSql,
    })
    .from(schema.poets)
    .leftJoin(schema.periods, eq(schema.periods.id, schema.poets.primaryPeriodId))
    .where(and(...conditions))
    .orderBy(sortOrderSql, birthSortSql, asc(schema.poets.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const counts = await countWorksByPoet(
    db,
    page.map((row) => row.poet.id),
  );

  const data = page.map((row) =>
    mapPoet(row.poet, {
      periodName: row.periodName,
      publishedWorkCount: counts.get(row.poet.id) ?? 0,
    }),
  );

  const last = page.at(-1);
  return {
    data,
    meta: {
      total: await countPoetsMatching(db, params),
      limit,
      nextCursor:
        hasMore && last
          ? encodeCursor({ o: Number(last.sortOrder), b: Number(last.birthSort), i: last.poet.id })
          : null,
    },
  };
}

async function countPoetsMatching(db: DB, params: ListPoetsParams): Promise<number> {
  const conditions = [eq(schema.poets.publishStatus, 'published')];
  if (params.scope === 'corpus') {
    conditions.push(eq(schema.poets.dataTier, 'imported'));
  } else if (params.scope !== 'all') {
    conditions.push(eq(schema.poets.skyVisible, true));
  }
  if (params.periodId) conditions.push(eq(schema.poets.primaryPeriodId, params.periodId));
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(schema.poets.name, pattern),
        sql`EXISTS (SELECT 1 FROM poet_aliases pa WHERE pa.poet_id = ${schema.poets.id} AND pa.alias ILIKE ${pattern})`,
      )!,
    );
  }
  if (params.genre && isGenre(params.genre)) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM works w WHERE w.poet_id = ${schema.poets.id} AND w.publish_status = 'published' AND w.rights_status = 'cleared' AND w.verification_status = 'curated' AND w.genre = ${params.genre})`,
    );
  }
  const rows = await db
    .select({ total: count() })
    .from(schema.poets)
    .where(and(...conditions));
  return Number(rows[0]?.total ?? 0);
}

export async function getPoetDetail(
  poetId: string,
  db: DB = getDatabase(),
): Promise<PoetDetail | null> {
  const rows = await db
    .select({ poet: schema.poets, periodName: schema.periods.name })
    .from(schema.poets)
    .leftJoin(schema.periods, eq(schema.periods.id, schema.poets.primaryPeriodId))
    .where(and(eq(schema.poets.id, poetId), eq(schema.poets.publishStatus, 'published')))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [aliasRows, membershipRows, workGenreRows, workCountRows] = await Promise.all([
    db
      .select()
      .from(schema.poetAliases)
      .where(eq(schema.poetAliases.poetId, poetId))
      .orderBy(asc(schema.poetAliases.id)),
    db
      .select({
        periodId: schema.poetPeriods.periodId,
        membershipType: schema.poetPeriods.membershipType,
        name: schema.periods.name,
      })
      .from(schema.poetPeriods)
      .innerJoin(schema.periods, eq(schema.periods.id, schema.poetPeriods.periodId))
      .where(eq(schema.poetPeriods.poetId, poetId))
      .orderBy(asc(schema.periods.sortOrder)),
    db
      .select({ genre: schema.works.genre })
      .from(schema.works)
      .where(and(publishedWorkCondition, eq(schema.works.poetId, poetId)))
      .groupBy(schema.works.genre),
    db
      .select({ total: count() })
      .from(schema.works)
      .where(and(publishedWorkCondition, eq(schema.works.poetId, poetId))),
  ]);

  const dates = describeDates({
    birthYear: row.poet.birthYear,
    deathYear: row.poet.deathYear,
    activityStart: row.poet.activityStart,
    activityEnd: row.poet.activityEnd,
    datePrecision: row.poet.datePrecision,
    periodId: row.poet.primaryPeriodId ?? undefined,
  });

  return {
    ...mapPoet(row.poet, {
      periodName: row.periodName,
      publishedWorkCount: Number(workCountRows[0]?.total ?? 0),
    }),
    aliases: aliasRows.map((alias) => ({ alias: alias.alias, aliasType: alias.aliasType })),
    birthYear: row.poet.birthYear,
    deathYear: row.poet.deathYear,
    activityStart: row.poet.activityStart,
    activityEnd: row.poet.activityEnd,
    dateNote: row.poet.dateNote || dates.note,
    impact: {
      tier: row.poet.impactTier,
      sources: row.poet.impactSources,
      reviewNote: row.poet.impactReviewNote,
    },
    periods: membershipRows.map((membership) => ({
      periodId: membership.periodId,
      periodName: membership.name,
      membershipType: membership.membershipType,
    })),
    genres: workGenreRows.map((item) => item.genre),
    dataNote: row.poet.dataNote,
  };
}

/* ------------------------------------------------------------------ */
/* 作品目录 / 原文                                                     */
/* ------------------------------------------------------------------ */

interface WorkCursor {
  s: number;
  i: string;
}

function mapWorkSummary(row: WorkRow, poet: { name: string; dynastyLabel: string }): WorkSummary {
  return {
    id: row.id,
    poetId: row.poetId ?? '',
    poetName: poet.name,
    title: row.title,
    genre: row.genre,
    featured: row.featured,
    excerpt: excerptFromText(row.textNormalized),
    dataTier: row.verificationStatus,
    qualityFlags: row.qualityFlags,
  };
}

export async function listPoetWorks(
  poetId: string,
  query: PoetWorkListQuery = {},
  db: DB = getDatabase(),
): Promise<Paginated<WorkSummary> & { poetName: string; dynastyLabel: string }> {
  const limit = clampLimit(query.limit);
  const conditions = [eq(schema.works.poetId, poetId), publishedWorkCondition];
  if (query.genre && isGenre(query.genre)) {
    conditions.push(eq(schema.works.genre, query.genre));
  }
  if (query.q && query.q.trim()) {
    const pattern = `%${query.q.trim()}%`;
    conditions.push(
      or(ilike(schema.works.title, pattern), ilike(schema.works.textNormalized, pattern))!,
    );
  }

  const cursor = query.cursor ? decodeCursor<WorkCursor>(query.cursor) : null;
  if (cursor) {
    conditions.push(
      sql`(${schema.works.sortIndex} > ${cursor.s}
        OR (${schema.works.sortIndex} = ${cursor.s} AND ${schema.works.id} > ${cursor.i}))`,
    );
  }

  const rows = await db
    .select({
      work: schema.works,
      poetName: schema.poets.name,
      dynastyLabel: schema.poets.dynastyLabel,
    })
    .from(schema.works)
    .innerJoin(schema.poets, eq(schema.poets.id, schema.works.poetId))
    .where(and(...conditions))
    .orderBy(asc(schema.works.sortIndex), asc(schema.works.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const poetName = rows[0]?.poetName ?? '';
  const dynastyLabel = rows[0]?.dynastyLabel ?? '';

  const totalConditions = [eq(schema.works.poetId, poetId), publishedWorkCondition];
  if (query.genre && isGenre(query.genre))
    totalConditions.push(eq(schema.works.genre, query.genre));
  if (query.q && query.q.trim()) {
    const pattern = `%${query.q.trim()}%`;
    totalConditions.push(
      or(ilike(schema.works.title, pattern), ilike(schema.works.textNormalized, pattern))!,
    );
  }
  const totalRows = await db
    .select({ total: count() })
    .from(schema.works)
    .where(and(...totalConditions));

  return {
    data: page.map((row) =>
      mapWorkSummary(row.work, { name: row.poetName, dynastyLabel: row.dynastyLabel }),
    ),
    meta: {
      total: Number(totalRows[0]?.total ?? 0),
      limit,
      nextCursor:
        hasMore && last ? encodeCursor({ s: last.work.sortIndex, i: last.work.id }) : null,
    },
    poetName,
    dynastyLabel,
  };
}

export async function getWorkDetail(
  workId: string,
  db: DB = getDatabase(),
): Promise<WorkDetail | null> {
  const rows = await db
    .select({
      work: schema.works,
      poet: schema.poets,
      source: schema.sources,
    })
    .from(schema.works)
    .innerJoin(schema.poets, eq(schema.poets.id, schema.works.poetId))
    .leftJoin(schema.sources, eq(schema.sources.id, schema.works.sourceId))
    .where(
      and(
        eq(schema.works.id, workId),
        eq(schema.works.publishStatus, 'published'),
        eq(schema.works.rightsStatus, 'cleared'),
        eq(schema.poets.publishStatus, 'published'),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [prevRows, nextRows] = await Promise.all([
    db
      .select({ id: schema.works.id, title: schema.works.title })
      .from(schema.works)
      .where(
        and(
          eq(schema.works.poetId, row.poet.id),
          publishedWorkCondition,
          sql`(${schema.works.sortIndex} < ${row.work.sortIndex}
            OR (${schema.works.sortIndex} = ${row.work.sortIndex} AND ${schema.works.id} < ${row.work.id}))`,
        ),
      )
      .orderBy(desc(schema.works.sortIndex), desc(schema.works.id))
      .limit(1),
    db
      .select({ id: schema.works.id, title: schema.works.title })
      .from(schema.works)
      .where(
        and(
          eq(schema.works.poetId, row.poet.id),
          publishedWorkCondition,
          sql`(${schema.works.sortIndex} > ${row.work.sortIndex}
            OR (${schema.works.sortIndex} = ${row.work.sortIndex} AND ${schema.works.id} > ${row.work.id}))`,
        ),
      )
      .orderBy(asc(schema.works.sortIndex), asc(schema.works.id))
      .limit(1),
  ]);

  const text = normalizePoemText(row.work.textNormalized);
  const prev = prevRows[0];
  const next = nextRows[0];
  const attributionNote =
    row.work.attributionStatus === 'attributed'
      ? null
      : row.work.attributionStatus === 'disputed'
        ? '作者归属存在争议，本页按通行归属展示，请注意版本差异。'
        : '本作品作者佚名，按来源文献归属展示。';

  return {
    ...mapWorkSummary(row.work, {
      name: row.poet.name,
      dynastyLabel: row.poet.dynastyLabel,
    }),
    text,
    paragraphs: text.split('\n').filter((line) => line.length > 0),
    dynastyLabel: row.poet.dynastyLabel,
    source: row.source
      ? mapSource(row.source)
      : {
          id: 'unknown',
          title: '来源待补',
          editor: null,
          edition: null,
          urlOrBib: null,
          license: 'unknown',
          rightsStatus: 'pending_review',
          rightsNote: '该作品来源信息尚待补录，公开前需完成核验。',
          verifiedAt: null,
        },
    attributionNote,
    prevWork: prev ? { id: prev.id, title: prev.title } : null,
    nextWork: next ? { id: next.id, title: next.title } : null,
  };
}

/* ------------------------------------------------------------------ */
/* 搜索                                                                */
/* ------------------------------------------------------------------ */

export async function searchAll(
  params: SearchParams,
  db: DB = getDatabase(),
): Promise<SearchResultGroups> {
  const raw = params.q?.trim() ?? '';
  if (!raw) {
    return { query: '', poets: [], works: [], total: 0 };
  }
  const needle = raw.slice(0, 48);
  const pattern = `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const limit = clampLimit(params.limit, MAX_SEARCH_LIMIT);
  const type = params.type;

  const poets: PoetSummary[] = [];
  const workSummaries: WorkSummary[] = [];

  if (!type || type === 'poet') {
    const poetRows = await db
      .select({
        poet: schema.poets,
        periodName: schema.periods.name,
        score: sql<number>`GREATEST(
          similarity(${schema.poets.name}, ${needle}),
          COALESCE((
            SELECT MAX(similarity(pa.alias, ${needle}))
            FROM poet_aliases pa
            WHERE pa.poet_id = ${schema.poets.id}
          ), 0)
        )`,
      })
      .from(schema.poets)
      .leftJoin(schema.periods, eq(schema.periods.id, schema.poets.primaryPeriodId))
      .where(
        and(
          eq(schema.poets.publishStatus, 'published'),
          or(
            ilike(schema.poets.name, pattern),
            sql`EXISTS (SELECT 1 FROM poet_aliases pa WHERE pa.poet_id = ${schema.poets.id} AND pa.alias ILIKE ${pattern})`,
          ),
        ),
      )
      .orderBy(
        desc(sql`CASE WHEN ${schema.poets.dataTier} = 'curated' THEN 1 ELSE 0 END`),
        desc(sql`GREATEST(
        similarity(${schema.poets.name}, ${needle}),
        COALESCE((
          SELECT MAX(similarity(pa.alias, ${needle}))
          FROM poet_aliases pa
          WHERE pa.poet_id = ${schema.poets.id}
        ), 0)
      )`),
        asc(schema.poets.name),
      )
      .limit(type === 'poet' ? limit : Math.min(5, limit));

    const counts = await countWorksByPoet(
      db,
      poetRows.map((row) => row.poet.id),
    );
    for (const row of poetRows) {
      const score = Number(row.score ?? 0);
      // 低相似度且不包含查询串的结果不展示，避免无关结果。
      if (score <= 0 && !row.poet.name.includes(needle)) continue;
      poets.push(
        mapPoet(row.poet, {
          periodName: row.periodName,
          publishedWorkCount: counts.get(row.poet.id) ?? 0,
        }),
      );
    }
  }

  if (!type || type === 'work') {
    const workRows = await db
      .select({
        work: schema.works,
        poetName: schema.poets.name,
        dynastyLabel: schema.poets.dynastyLabel,
        titleMatch: sql<number>`CASE WHEN ${schema.works.title} ILIKE ${pattern} THEN 1 ELSE 0 END`,
        score: sql<number>`similarity(${schema.works.title}, ${needle})`,
      })
      .from(schema.works)
      .innerJoin(schema.poets, eq(schema.poets.id, schema.works.poetId))
      .where(
        and(
          publishedWorkCondition,
          eq(schema.poets.publishStatus, 'published'),
          or(ilike(schema.works.title, pattern), ilike(schema.works.textNormalized, pattern)),
        ),
      )
      .orderBy(
        desc(sql`CASE WHEN ${schema.works.verificationStatus} = 'curated' THEN 1 ELSE 0 END`),
        desc(sql`CASE WHEN ${schema.works.title} ILIKE ${pattern} THEN 1 ELSE 0 END`),
        desc(sql`similarity(${schema.works.title}, ${needle})`),
        desc(schema.works.featured),
        asc(schema.works.sortIndex),
      )
      .limit(limit);

    for (const row of workRows) {
      workSummaries.push(
        mapWorkSummary(row.work, { name: row.poetName, dynastyLabel: row.dynastyLabel }),
      );
    }
  }

  return {
    query: needle,
    poets,
    works: workSummaries,
    total: poets.length + workSummaries.length,
  };
}

/* ------------------------------------------------------------------ */
/* 站点地图                                                            */
/* ------------------------------------------------------------------ */

export async function listPublishedIds(
  db: DB = getDatabase(),
): Promise<{ poets: string[]; works: string[] }> {
  const [poetRows, workRows] = await Promise.all([
    db
      .select({ id: schema.poets.id })
      .from(schema.poets)
      .where(and(eq(schema.poets.publishStatus, 'published'), eq(schema.poets.skyVisible, true)))
      .orderBy(asc(schema.poets.id)),
    db
      .select({ id: schema.works.id })
      .from(schema.works)
      .where(and(publishedWorkCondition, eq(schema.works.verificationStatus, 'curated')))
      .orderBy(asc(schema.works.id)),
  ]);
  return {
    poets: poetRows.map((row) => row.id),
    works: workRows.map((row) => row.id),
  };
}

/* ------------------------------------------------------------------ */
/* 关系（Phase 3 数据入口，当前无已审核关系数据时返回空数组）            */
/* ------------------------------------------------------------------ */

export async function getPoetRelations(
  poetId: string,
  db: DB = getDatabase(),
): Promise<PoetRelation[]> {
  const rows = await db
    .select({
      relation: schema.poetRelations,
      source: schema.sources,
      poetAName: sql<string>`(SELECT name FROM poets WHERE id = ${schema.poetRelations.poetAId})`,
      poetBName: sql<string>`(SELECT name FROM poets WHERE id = ${schema.poetRelations.poetBId})`,
    })
    .from(schema.poetRelations)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.poetRelations.sourceId))
    .where(
      and(
        eq(schema.poetRelations.publishStatus, 'published'),
        or(eq(schema.poetRelations.poetAId, poetId), eq(schema.poetRelations.poetBId, poetId)),
      ),
    );

  return rows
    .filter((row) => row.source)
    .map((row) => ({
      id: row.relation.id,
      poetAId: row.relation.poetAId,
      poetBId: row.relation.poetBId,
      poetAName: row.poetAName,
      poetBName: row.poetBName,
      relationType: row.relation.relationType,
      direction: row.relation.direction,
      evidence: row.relation.evidence,
      source: mapSource(row.source as SourceRow),
      confidence: row.relation.confidence,
    }));
}
