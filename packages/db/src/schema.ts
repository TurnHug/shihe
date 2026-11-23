import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const publishStatusEnum = pgEnum('publish_status', ['published', 'draft', 'retracted']);
export const rightsStatusEnum = pgEnum('rights_status', [
  'cleared',
  'restricted',
  'pending_review',
]);
export const datePrecisionEnum = pgEnum('date_precision', ['exact', 'approx', 'period', 'unknown']);
export const impactTierEnum = pgEnum('impact_tier', ['A', 'B', 'C', 'unranked']);
export const genreEnum = pgEnum('genre', ['shi', 'ci', 'qu']);
export const membershipTypeEnum = pgEnum('membership_type', ['primary', 'secondary', 'transition']);
export const periodKindEnum = pgEnum('period_kind', ['dynasty', 'era', 'realm', 'literary']);
export const aliasTypeEnum = pgEnum('alias_type', ['courtesy', 'art_name', 'alias', 'variant']);
export const attributionTypeEnum = pgEnum('attribution_type', ['primary', 'secondary', 'disputed']);
export const attributionStatusEnum = pgEnum('attribution_status', [
  'attributed',
  'disputed',
  'anonymous',
]);
export const relationTypeEnum = pgEnum('relation_type', [
  'friendship',
  'teacher_student',
  'literary_influence',
  'association',
  'kinship',
]);
export const relationDirectionEnum = pgEnum('relation_direction', [
  'undirected',
  'a_to_b',
  'b_to_a',
]);
export const confidenceEnum = pgEnum('confidence', ['high', 'medium', 'low']);
export const skyModeEnum = pgEnum('sky_mode', ['river', 'galaxy']);
export const dataTierEnum = pgEnum('data_tier', ['curated', 'imported']);
export const verificationStatusEnum = pgEnum('verification_status', ['curated', 'imported']);

export const sources = pgTable('sources', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  editor: text('editor'),
  edition: text('edition'),
  urlOrBib: text('url_or_bib'),
  license: text('license').notNull().default('unknown'),
  rightsStatus: rightsStatusEnum('rights_status').notNull().default('pending_review'),
  rightsNote: text('rights_note'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
});

export const periods = pgTable(
  'periods',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    startYear: integer('start_year').notNull(),
    endYear: integer('end_year').notNull(),
    parentId: text('parent_id'),
    periodKind: periodKindEnum('period_kind').notNull().default('era'),
    sortOrder: integer('sort_order').notNull().default(0),
    parallel: boolean('parallel').notNull().default(false),
    description: text('description').notNull().default(''),
  },
  (table) => [index('periods_sort_order_idx').on(table.sortOrder)],
);

export const poets = pgTable(
  'poets',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    /** 姓氏首字，用于详情页的大字视觉；不是字号或别称。 */
    initial: text('initial').notNull(),
    /** 展示用朝代标签，如「唐」「北宋」「金」，属于展示字段，具体年代另存。 */
    dynastyLabel: text('dynasty_label').notNull().default(''),
    bioShort: text('bio_short').notNull().default(''),
    birthYear: integer('birth_year'),
    deathYear: integer('death_year'),
    activityStart: integer('activity_start'),
    activityEnd: integer('activity_end'),
    datePrecision: datePrecisionEnum('date_precision').notNull().default('unknown'),
    dateNote: text('date_note').notNull().default(''),
    impactTier: impactTierEnum('impact_tier').notNull().default('unranked'),
    impactSources: jsonb('impact_sources').$type<string[]>().notNull().default([]),
    impactReviewNote: text('impact_review_note').notNull().default(''),
    primaryPeriodId: text('primary_period_id').references(() => periods.id, {
      onDelete: 'set null',
    }),
    publishStatus: publishStatusEnum('publish_status').notNull().default('draft'),
    /** curated = 人工校核作者；imported = 批量导入语料作者（不上星图、待校核） */
    dataTier: dataTierEnum('data_tier').notNull().default('curated'),
    /** 是否进入可交互星图；批量导入作者默认 false，仍可通过全库检索/作者页访问 */
    skyVisible: boolean('sky_visible').notNull().default(true),
    /** 跨数据集作者归并键（规范姓名 + 时期）；curated 作者可为空 */
    corpusKey: text('corpus_key'),
    dataNote: text('data_note').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('poets_publish_status_idx').on(table.publishStatus),
    index('poets_primary_period_idx').on(table.primaryPeriodId),
    index('poets_name_idx').on(table.name),
    index('poets_sky_visible_idx').on(table.skyVisible),
    uniqueIndex('poets_corpus_key_idx').on(table.corpusKey),
  ],
);

export const poetAliases = pgTable(
  'poet_aliases',
  {
    id: serial('id').primaryKey(),
    poetId: text('poet_id')
      .notNull()
      .references(() => poets.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    aliasType: aliasTypeEnum('alias_type').notNull().default('alias'),
  },
  (table) => [
    index('poet_aliases_poet_idx').on(table.poetId),
    index('poet_aliases_alias_idx').on(table.alias),
  ],
);

export const poetPeriods = pgTable(
  'poet_periods',
  {
    poetId: text('poet_id')
      .notNull()
      .references(() => poets.id, { onDelete: 'cascade' }),
    periodId: text('period_id')
      .notNull()
      .references(() => periods.id, { onDelete: 'cascade' }),
    membershipType: membershipTypeEnum('membership_type').notNull().default('primary'),
    evidenceId: text('evidence_id').references(() => sources.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.poetId, table.periodId] })],
);

export const works = pgTable(
  'works',
  {
    id: text('id').primaryKey(),
    poetId: text('poet_id').references(() => poets.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    genre: genreEnum('genre').notNull().default('shi'),
    textOriginal: text('text_original').notNull(),
    textNormalized: text('text_normalized').notNull(),
    featured: boolean('featured').notNull().default(false),
    attributionStatus: attributionStatusEnum('attribution_status').notNull().default('attributed'),
    publishStatus: publishStatusEnum('publish_status').notNull().default('draft'),
    rightsStatus: rightsStatusEnum('rights_status').notNull().default('pending_review'),
    canonicalWorkId: text('canonical_work_id'),
    sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
    sourceLocator: text('source_locator'),
    contentHash: text('content_hash').notNull(),
    /** 仅由正文规范化后生成的去重指纹（跨来源合并） */
    textFingerprint: text('text_fingerprint'),
    /** curated = 人工校核文本；imported = 批量导入文本（待逐条校核） */
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('curated'),
    /** 导入质量标记：contains_placeholder / short_text / converted_traditional 等 */
    qualityFlags: jsonb('quality_flags').$type<string[]>().notNull().default([]),
    /** 数据集内原始记录 ID（UUID/行号），便于回溯 */
    sourceExternalId: text('source_external_id'),
    sortIndex: integer('sort_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('works_poet_idx').on(table.poetId),
    index('works_publish_status_idx').on(table.publishStatus),
    index('works_poet_order_idx').on(table.poetId, table.featured, table.title),
    index('works_content_hash_idx').on(table.contentHash),
    index('works_genre_idx').on(table.genre),
    index('works_poet_fingerprint_idx').on(table.poetId, table.textFingerprint),
    index('works_verification_idx').on(table.verificationStatus),
    index('works_source_external_idx').on(table.sourceExternalId),
  ],
);

export const workAuthors = pgTable(
  'work_authors',
  {
    workId: text('work_id')
      .notNull()
      .references(() => works.id, { onDelete: 'cascade' }),
    poetId: text('poet_id')
      .notNull()
      .references(() => poets.id, { onDelete: 'cascade' }),
    attributionType: attributionTypeEnum('attribution_type').notNull().default('primary'),
    evidenceId: text('evidence_id').references(() => sources.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.workId, table.poetId] })],
);

export const workSources = pgTable(
  'work_sources',
  {
    workId: text('work_id')
      .notNull()
      .references(() => works.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    relationType: text('relation_type').notNull().default('text'),
    sourceLocator: text('source_locator'),
  },
  (table) => [primaryKey({ columns: [table.workId, table.sourceId] })],
);

export const workVariants = pgTable(
  'work_variants',
  {
    id: text('id').primaryKey(),
    workId: text('work_id')
      .notNull()
      .references(() => works.id, { onDelete: 'cascade' }),
    sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
    variantText: text('variant_text').notNull(),
    variantNote: text('variant_note'),
  },
  (table) => [index('work_variants_work_idx').on(table.workId)],
);

export const poetRelations = pgTable(
  'poet_relations',
  {
    id: text('id').primaryKey(),
    poetAId: text('poet_a_id')
      .notNull()
      .references(() => poets.id, { onDelete: 'cascade' }),
    poetBId: text('poet_b_id')
      .notNull()
      .references(() => poets.id, { onDelete: 'cascade' }),
    relationType: relationTypeEnum('relation_type').notNull(),
    direction: relationDirectionEnum('direction').notNull().default('undirected'),
    sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
    confidence: confidenceEnum('confidence').notNull().default('low'),
    evidence: text('evidence').notNull().default(''),
    publishStatus: publishStatusEnum('publish_status').notNull().default('draft'),
  },
  (table) => [
    index('poet_relations_a_idx').on(table.poetAId),
    index('poet_relations_b_idx').on(table.poetBId),
  ],
);

export const layoutPositions = pgTable(
  'layout_positions',
  {
    poetId: text('poet_id')
      .notNull()
      .references(() => poets.id, { onDelete: 'cascade' }),
    mode: skyModeEnum('mode').notNull(),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    layoutVersion: text('layout_version').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.poetId, table.mode, table.layoutVersion] }),
    index('layout_positions_mode_idx').on(table.mode, table.layoutVersion),
    index('layout_positions_bbox_idx').on(table.mode, table.layoutVersion, table.x, table.y),
  ],
);

export const appMeta = pgTable('app_meta', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<Record<string, unknown> | string>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ingestionJobs = pgTable(
  'ingestion_jobs',
  {
    id: serial('id').primaryKey(),
    datasetName: text('dataset_name').notNull(),
    version: text('version').notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
    reviewStatus: text('review_status').notNull().default('pending'),
    statistics: jsonb('statistics').$type<Record<string, unknown>>().notNull().default({}),
    notes: text('notes').notNull().default(''),
  },
  (table) => [index('ingestion_jobs_imported_idx').on(table.importedAt)],
);

export const periodsRelations = relations(periods, ({ many, one }) => ({
  poets: many(poets),
  parent: one(periods, {
    fields: [periods.parentId],
    references: [periods.id],
    relationName: 'period_parent',
  }),
}));

export const poetsRelations = relations(poets, ({ many, one }) => ({
  aliases: many(poetAliases),
  works: many(works),
  periodLinks: many(poetPeriods),
  primaryPeriod: one(periods, {
    fields: [poets.primaryPeriodId],
    references: [periods.id],
  }),
}));

export const worksRelations = relations(works, ({ one, many }) => ({
  poet: one(poets, { fields: [works.poetId], references: [poets.id] }),
  source: one(sources, { fields: [works.sourceId], references: [sources.id] }),
  authors: many(workAuthors),
}));

/** 显式导出 SQL 片段，供迁移脚本补充 trigram 索引。 */
export const TRIGRAM_INDEXES_SQL = sql`
  CREATE INDEX IF NOT EXISTS poets_name_trgm_idx ON poets USING gin (name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS poet_aliases_alias_trgm_idx ON poet_aliases USING gin (alias gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS works_title_trgm_idx ON works USING gin (title gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS works_text_trgm_idx ON works USING gin (text_normalized gin_trgm_ops);
`;
