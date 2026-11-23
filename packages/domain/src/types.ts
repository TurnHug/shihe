/**
 * 诗河 · 千年星图 — 共享领域模型
 *
 * 该文件只包含跨端共享的纯类型，不依赖数据库、React 或 PixiJS。
 * API 响应、数据库查询映射与前端渲染都以此为准。
 */

/** 内部统一整数年份：天文纪年（公元前 1 年 = 0，公元前 1046 年 = -1045）。 */
export type AstronomicalYear = number;

export type DatePrecision = 'exact' | 'approx' | 'period' | 'unknown';

/** 文学影响力审核分级；unranked 不是最低级，而是尚未评级。 */
export type ImpactTier = 'A' | 'B' | 'C' | 'unranked';

export type Genre = 'shi' | 'ci' | 'qu';

export type SkyMode = 'river' | 'galaxy';

export type PublishStatus = 'published' | 'draft' | 'retracted';

export type RightsStatus = 'cleared' | 'restricted' | 'pending_review';

export type PeriodMembershipType = 'primary' | 'secondary' | 'transition';

export type PeriodKind = 'dynasty' | 'era' | 'realm' | 'literary';

export interface Period {
  id: string;
  name: string;
  shortName: string;
  startYear: AstronomicalYear;
  endYear: AstronomicalYear;
  parentId: string | null;
  periodKind: PeriodKind;
  sortOrder: number;
  /** 该时期在历史星河里是否与其他时期并行（如宋、辽、金）。 */
  parallel: boolean;
  description: string;
}

/**
 * 朝代星系里的“文学星域”：一种面向导航的宏观分组，
 * 允许把相邻时期合并展示，不是严格的历史断代。
 */
export interface GalaxyRealm {
  id: string;
  name: string;
  subtitle: string;
  periodIds: string[];
  /** 归一化世界坐标（0–1），由视觉设计稿确定。 */
  anchor: { x: number; y: number };
  /** 星域聚类的基础半径（世界单位），最终半径会按作者数量缩放。 */
  baseRadius: number;
}

export interface PeriodMembership {
  periodId: string;
  periodName: string;
  membershipType: PeriodMembershipType;
}

export interface ImpactRating {
  tier: ImpactTier;
  /** 可追溯的评级依据，例如文学史、经典选本；unranked 时为空数组。 */
  sources: string[];
  /** 审核备注：说明该评级是初评还是已复核。 */
  reviewNote: string;
}

export interface PoetSummary {
  id: string;
  name: string;
  /** 主要朝代展示名，如「唐」「北宋」。 */
  dynastyLabel: string;
  dateDisplay: string;
  datePrecision: DatePrecision;
  /** 主要归属时期 ID。 */
  periodId: string;
  periodName: string;
  /** 已发布、已去重、可打开全文的作品数（来自数据库统计，不是导入行数）。 */
  publishedWorkCount: number;
  impactTier: ImpactTier;
  bioShort: string;
  /** 用于文字的姓氏展示（只取首字，不杜撰字号）。 */
  initial: string;
  /** curated = 人工校核作者；imported = 批量导入语料作者。 */
  dataTier: 'curated' | 'imported';
  /** 是否进入可交互星图。批量导入作者默认不进入。 */
  skyVisible: boolean;
}

export interface PoetDetail extends PoetSummary {
  aliases: PoetAlias[];
  birthYear: AstronomicalYear | null;
  deathYear: AstronomicalYear | null;
  activityStart: AstronomicalYear | null;
  activityEnd: AstronomicalYear | null;
  /** 人类可读年代及可信度说明。 */
  dateNote: string;
  impact: ImpactRating;
  periods: PeriodMembership[];
  genres: Genre[];
  /** 数据边界说明，例如收录口径、抽样范围。 */
  dataNote: string;
}

export interface PoetAlias {
  alias: string;
  /** 字 / 号 / 别名 / 异体写法 */
  aliasType: 'courtesy' | 'art_name' | 'alias' | 'variant';
}

export interface WorkSummary {
  id: string;
  poetId: string;
  poetName: string;
  title: string;
  genre: Genre;
  /** 是否属于经典选本中的代表作（用于目录排序，不代表文学价值评分）。 */
  featured: boolean;
  /** 首句摘要，用于搜索结果。 */
  excerpt: string;
  /** curated = 人工校核文本；imported = 批量导入文本。 */
  dataTier: 'curated' | 'imported';
  /** 导入文本质量标记。 */
  qualityFlags: string[];
}

export interface WorkDetail extends WorkSummary {
  /** 原文，换行已规范化但未增删任何字句。 */
  text: string;
  paragraphs: string[];
  dynastyLabel: string;
  source: SourceRef;
  attributionNote: string | null;
  /** 同一作者下按目录稳定排序的上/下一篇永久路径信息。 */
  prevWork: WorkNeighbor | null;
  nextWork: WorkNeighbor | null;
}

export interface WorkNeighbor {
  id: string;
  title: string;
}

export interface SourceRef {
  id: string;
  title: string;
  editor: string | null;
  edition: string | null;
  urlOrBib: string | null;
  license: string;
  rightsStatus: RightsStatus;
  rightsNote: string | null;
  verifiedAt: string | null;
}

export interface PoetRelation {
  id: string;
  poetAId: string;
  poetBId: string;
  poetAName: string;
  poetBName: string;
  relationType: 'friendship' | 'teacher_student' | 'literary_influence' | 'association' | 'kinship';
  direction: 'undirected' | 'a_to_b' | 'b_to_a';
  evidence: string;
  source: SourceRef;
  confidence: 'high' | 'medium' | 'low';
}

/** 星图星辰：只包含轻量字段，绝不携带全文。 */
export interface StarPoint {
  poetId: string;
  name: string;
  x: number;
  y: number;
  /** 基础核心半径（CSS px 名义值），渲染层会结合相机缩放做屏幕空间限幅。 */
  radiusBase: number;
  publishedWorkCount: number;
  impactTier: ImpactTier;
  periodId: string;
  realmId: string | null;
  /** 该作者已发布作品的体裁集合，用于星图体裁筛选。 */
  genres: Genre[];
  /** 标签优先级：影响力与作品量共同决定；数值越大越优先显示。 */
  labelPriority: number;
  dateDisplay: string;
}

export interface SkyWorld {
  mode: SkyMode;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** 初始相机建议：世界坐标中心与缩放倍数。 */
  defaultView: { x: number; y: number; zoom: number };
  starCount: number;
}

export interface SkyManifest {
  dataVersion: string;
  layoutVersion: string;
  generatedAt: string;
  stats: {
    publishedPoets: number;
    publishedWorks: number;
    catalogedPoets: number;
    catalogedWorks: number;
    periods: number;
    genres: Record<Genre, number>;
  };
  periods: Period[];
  realms: GalaxyRealm[];
  modes: Record<SkyMode, SkyWorld>;
}

export interface SkyTileResponse {
  mode: SkyMode;
  z: number;
  x: number;
  y: number;
  stars: StarPoint[];
}

export interface SkyTileQuery {
  mode: SkyMode;
  z: number;
  x: number;
  y: number;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    /** 游标分页：本页最后一条的稳定排序键。 */
    nextCursor: string | null;
  };
}

export interface PoetWorkListQuery {
  cursor?: string;
  limit?: number;
  q?: string;
  genre?: Genre;
}

export interface SearchResultGroups {
  query: string;
  poets: PoetSummary[];
  works: WorkSummary[];
  total: number;
}

export interface PublicStats {
  /** 星图可交互作者数（sky_visible = true 且 published）。 */
  publishedPoets: number;
  /** 星图作者名下已发布作品数（含批量语料归并到该作者的额外作品）。 */
  publishedWorks: number;
  publishedPeriods: number;
  publishedRelations: number;
  /** 全库可访问作者数（人工校核 + 批量导入）。 */
  catalogedPoets: number;
  /** 全库可访问作品数（去重后）。 */
  catalogedWorks: number;
  importedPoets: number;
  importedWorks: number;
  /** 已登记的数据集来源数量。 */
  corpusSources: number;
  /** 本次导入原始记录数（未去重）。 */
  corpusRawRecords: number;
  dataVersion: string;
  lastUpdated: string;
  dataNote: string;
}

export interface CorpusSourceStat {
  id: string;
  title: string;
  license: string;
  url: string | null;
  rawRecords: number;
  acceptedRecords: number;
  skippedRecords: number;
  note?: string;
}

export interface CorpusImportStats {
  generatedAt: string;
  version: string;
  durationSeconds: number;
  sources: CorpusSourceStat[];
  totals: {
    rawRecords: number;
    acceptedRecords: number;
    skippedModern: number;
    skippedInvalid: number;
    uniqueWorks: number;
    importedWorks: number;
    mergedWithCurated: number;
    importedPoets: number;
    crossSourceDuplicates: number;
  };
  notes: string;
}

export interface ApiErrorBody {
  error: {
    code: 'BAD_REQUEST' | 'NOT_FOUND' | 'GONE' | 'RATE_LIMITED' | 'INTERNAL';
    message: string;
  };
}

export interface StarLayoutInput {
  poetId: string;
  /** 用于布局的代表年份（出生年或活动期中心）；null 表示年代待考。 */
  eventYear: AstronomicalYear | null;
  publishedWorkCount: number;
  impactTier: ImpactTier;
  periodId: string;
  realmId: string | null;
  /** 该作者已发布作品的体裁集合，用于星图体裁筛选。 */
  genres: Genre[];
  /** 稳定排序用：同一作者每次布局结果必须一致。 */
  sortIndex: number;
}

export interface LayoutPoint {
  poetId: string;
  mode: SkyMode;
  x: number;
  y: number;
}

export interface LayoutResult {
  mode: SkyMode;
  version: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  points: LayoutPoint[];
}
