import type {
  DatePrecision,
  Genre,
  ImpactTier,
  LayoutPoint,
  PeriodMembershipType,
  PoetAlias,
  RightsStatus,
  SkyMode,
} from './types';

/**
 * 离线数据构建产物（data/curated/dataset.json）的结构。
 * 该文件是“原始数据 → 清洗 → 审核 → 发布库”的中间契约：
 * 脚本产出它，seed 脚本只读取它，不在运行时调用任何外部数据源。
 */
export interface CuratedDataset {
  version: string;
  generatedAt: string;
  /** 数据来源与许可说明，写入 sources 表。 */
  sources: CuratedSource[];
  poets: CuratedPoet[];
  works: CuratedWork[];
  /** 经审核的人物关系；关系模式默认关闭，只有已发布关系会被 API 返回。 */
  relations: CuratedRelation[];
  /** 离线预计算的双模式坐标，seed 时写入 layout_positions。 */
  layouts: {
    version: string;
    river: CuratedLayout;
    galaxy: CuratedLayout;
    maxWorkCount: number;
  };
  stats: {
    poets: number;
    works: number;
    relations: number;
    byGenre: Record<Genre, number>;
    byPeriod: Record<string, number>;
  };
  notes: string;
}

export interface CuratedSource {
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

export interface CuratedPoet {
  id: string;
  slug: string;
  name: string;
  initial: string;
  dynastyLabel: string;
  bioShort: string;
  birthYear: number | null;
  deathYear: number | null;
  activityStart: number | null;
  activityEnd: number | null;
  datePrecision: DatePrecision;
  dateNote: string;
  impactTier: ImpactTier;
  impactSources: string[];
  impactReviewNote: string;
  primaryPeriodId: string;
  periodMemberships: { periodId: string; membershipType: PeriodMembershipType }[];
  dataNote: string;
  aliases: PoetAlias[];
}

export interface CuratedWork {
  id: string;
  poetId: string;
  title: string;
  genre: Genre;
  /** 原文，段落之间使用 \n。 */
  text: string;
  featured: boolean;
  attributionStatus: 'attributed' | 'disputed' | 'anonymous';
  sourceId: string;
  sourceLocator: string | null;
  /** 同一作者目录内稳定排序键（代表作优先，其后按来源顺序）。 */
  sortIndex: number;
  contentHash: string;
}

export interface CuratedRelation {
  id: string;
  poetAId: string;
  poetBId: string;
  relationType: 'friendship' | 'teacher_student' | 'literary_influence' | 'association' | 'kinship';
  direction: 'undirected' | 'a_to_b' | 'b_to_a';
  evidence: string;
  sourceId: string;
  sourceLocator: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface CuratedLayout {
  mode: SkyMode;
  version: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  defaultView: { x: number; y: number; zoom: number };
  points: LayoutPoint[];
}
