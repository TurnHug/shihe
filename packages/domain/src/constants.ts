import type { GalaxyRealm, Genre, ImpactTier, Period } from './types';

/** 公元前年份转天文纪年：前1046 → -1045。 */
export const bce = (year: number): number => 1 - year;

/**
 * 历史时期导航表。
 *
 * 说明：
 * - 时期是文学导航分组，不追求无重叠的严格断代；宋辽夏金与五代、隋唐与魏晋
 *   在时间上存在有意保留的并立/交叠。
 * - 所有年份使用天文纪年（前 1 年 = 0），因此不存在公元 0 年。
 */
export const PERIODS: Period[] = [
  {
    id: 'pre-qin',
    name: '先秦',
    shortName: '先秦',
    startYear: bce(1046),
    endYear: bce(221),
    parentId: null,
    periodKind: 'era',
    sortOrder: 1,
    parallel: false,
    description: '《诗经》《楚辞》所开启的古典诗歌源头',
  },
  {
    id: 'qin-han',
    name: '秦汉',
    shortName: '秦汉',
    startYear: bce(221),
    endYear: 220,
    parentId: null,
    periodKind: 'era',
    sortOrder: 2,
    parallel: false,
    description: '乐府与文人五言诗的成形时期',
  },
  {
    id: 'wei-jin',
    name: '魏晋南北朝',
    shortName: '魏晋',
    startYear: 220,
    endYear: 589,
    parentId: null,
    periodKind: 'era',
    sortOrder: 3,
    parallel: false,
    description: '建安风骨、正始之音与山水田园诗',
  },
  {
    id: 'sui-tang',
    name: '隋唐',
    shortName: '隋唐',
    startYear: 581,
    endYear: 907,
    parentId: null,
    periodKind: 'era',
    sortOrder: 4,
    parallel: false,
    description: '近体诗成熟、诗人群星闪耀的时代',
  },
  {
    id: 'five-dynasties',
    name: '五代十国',
    shortName: '五代',
    startYear: 907,
    endYear: 979,
    parentId: null,
    periodKind: 'era',
    sortOrder: 5,
    parallel: false,
    description: '花间词与南唐二主，词体初盛',
  },
  {
    id: 'song-liao-jin',
    name: '宋辽夏金',
    shortName: '宋',
    startYear: 916,
    endYear: 1279,
    parentId: null,
    periodKind: 'era',
    sortOrder: 6,
    parallel: true,
    description: '宋词极盛，宋诗自成一格；辽、西夏、金并行',
  },
  {
    id: 'yuan',
    name: '元',
    shortName: '元',
    startYear: 1271,
    endYear: 1368,
    parentId: null,
    periodKind: 'era',
    sortOrder: 7,
    parallel: false,
    description: '散曲与杂剧兴起，曲体成为一代之文学',
  },
  {
    id: 'ming',
    name: '明',
    shortName: '明',
    startYear: 1368,
    endYear: 1644,
    parentId: null,
    periodKind: 'era',
    sortOrder: 8,
    parallel: false,
    description: '复古与性灵并存的诗坛',
  },
  {
    id: 'qing',
    name: '清',
    shortName: '清',
    startYear: 1644,
    endYear: 1912,
    parentId: null,
    periodKind: 'era',
    sortOrder: 9,
    parallel: false,
    description: '诗词中兴与集大成式的整理',
  },
  {
    id: 'republic',
    name: '民国',
    shortName: '民国',
    startYear: 1912,
    endYear: 1949,
    parentId: null,
    periodKind: 'era',
    sortOrder: 10,
    parallel: false,
    description: '旧体诗词在现代转型中的延续',
  },
];

export const PERIOD_BY_ID: ReadonlyMap<string, Period> = new Map(
  PERIODS.map((period) => [period.id, period]),
);

/**
 * 朝代星系星域：六个可辨认的宏观星群，与视觉设计稿一致。
 * 它们把相邻的历史时期合并为导航单元，不代表历史断代。
 */
export const GALAXY_REALMS: GalaxyRealm[] = [
  {
    id: 'realm-pre-qin',
    name: '先秦',
    subtitle: '古典诗歌之源',
    periodIds: ['pre-qin'],
    anchor: { x: 0.17, y: 0.32 },
    baseRadius: 150,
  },
  {
    id: 'realm-wei-jin',
    name: '魏晋南北朝',
    subtitle: '风骨与山水',
    periodIds: ['qin-han', 'wei-jin'],
    anchor: { x: 0.31, y: 0.56 },
    baseRadius: 210,
  },
  {
    id: 'realm-sui-tang',
    name: '隋唐',
    subtitle: '诗歌的星河',
    periodIds: ['sui-tang', 'five-dynasties'],
    anchor: { x: 0.55, y: 0.46 },
    baseRadius: 260,
  },
  {
    id: 'realm-song',
    name: '两宋',
    subtitle: '词的千般境界',
    periodIds: ['song-liao-jin'],
    anchor: { x: 0.79, y: 0.42 },
    baseRadius: 250,
  },
  {
    id: 'realm-yuan-ming',
    name: '元明',
    subtitle: '曲韵与诗风',
    periodIds: ['yuan', 'ming'],
    anchor: { x: 0.58, y: 0.8 },
    baseRadius: 200,
  },
  {
    id: 'realm-qing-republic',
    name: '清至民国',
    subtitle: '诗脉的延续',
    periodIds: ['qing', 'republic'],
    anchor: { x: 0.23, y: 0.79 },
    baseRadius: 190,
  },
];

export const REALM_BY_ID: ReadonlyMap<string, GalaxyRealm> = new Map(
  GALAXY_REALMS.map((realm) => [realm.id, realm]),
);

export const PERIOD_TO_REALM: ReadonlyMap<string, string> = new Map(
  GALAXY_REALMS.flatMap((realm) =>
    realm.periodIds.map((periodId) => [periodId, realm.id] as const),
  ),
);

export const GENRES: { id: Genre; label: string; shortLabel: string }[] = [
  { id: 'shi', label: '诗', shortLabel: '诗' },
  { id: 'ci', label: '词', shortLabel: '词' },
  { id: 'qu', label: '曲', shortLabel: '曲' },
];

export const GENRE_LABEL: Record<Genre, string> = {
  shi: '诗',
  ci: '词',
  qu: '曲',
};

export const IMPACT_TIER_LABEL: Record<ImpactTier, string> = {
  A: '代表诗人',
  B: '重要诗人',
  C: '有诗名传世',
  unranked: '影响力未评级',
};

export const IMPACT_TIER_DESCRIPTION: Record<ImpactTier, string> = {
  A: '文学史与经典选本中反复论及的代表性作者（初评）',
  B: '在文学史或选本中具有稳定地位的重要作者（初评）',
  C: '有作品传世、诗名可考的较重要作者（初评）',
  unranked: '尚未完成可追溯的影响力评级；以中性亮度展示，不代表水平较低',
};

/** 产品级常量。 */
export const SITE_NAME = '诗河 · 千年星图';
export const SITE_TAGLINE = 'THE CONSTELLATION OF CHINESE POETRY';
export const SITE_TITLE_SUFFIX = '诗河 · 千年星图';
export const SITE_DESCRIPTION =
  '先秦至民国的中国古典诗词交互星图：沿历史长河漫游，在星辰之间遇见诗人，阅读经校核的诗词原文。';

export const DATA_VERSION = '2026.11-phase05';
export const LAYOUT_VERSION = 'layout-v2';

/** 历史星河中的“朝代星群带”几何。 */
export interface RiverBand {
  /** 所属时期；未知年代使用 unknown。 */
  periodId: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 每个朝代星群带的视觉宽度（世界单位）：作品多的唐、宋更宽，但不按作品数硬性放大。 */
const RIVER_BAND_WIDTHS: Record<string, number> = {
  'pre-qin': 300,
  'qin-han': 280,
  'wei-jin': 380,
  'sui-tang': 560,
  'five-dynasties': 320,
  'song-liao-jin': 540,
  yuan: 380,
  ming: 340,
  qing: 420,
  republic: 340,
};

const RIVER_BAND_GAP = 74;
const RIVER_BAND_HEIGHT = 1250;

function buildRiverBands(): RiverBand[] {
  let cursor = 0;
  return PERIODS.map((period, index) => {
    const width = RIVER_BAND_WIDTHS[period.id] ?? 320;
    // 交替的纵向中心让相邻朝代既分离，又保持“同一条河”的流动感。
    const y = Math.sin(index * 1.05) * 250;
    const band: RiverBand = {
      periodId: period.id,
      index,
      x: cursor,
      y,
      width,
      height: RIVER_BAND_HEIGHT,
    };
    cursor += width + RIVER_BAND_GAP;
    return band;
  });
}

/** 按时间顺序排列的十个朝代星群带。 */
export const RIVER_BANDS: RiverBand[] = buildRiverBands();

/** 年代待考作者专用星群带（最右侧，不伪造年代）。 */
export const RIVER_UNKNOWN_BAND: RiverBand = {
  periodId: 'unknown',
  index: RIVER_BANDS.length,
  x: (RIVER_BANDS.at(-1)?.x ?? 0) + (RIVER_BANDS.at(-1)?.width ?? 0) + RIVER_BAND_GAP * 1.3,
  y: 0,
  width: 340,
  height: RIVER_BAND_HEIGHT,
};

export const RIVER_BAND_COLLISION = { MIN_GAP: 34, X_PADDING: 44 } as const;

/** 历史星河的世界尺寸按“朝代星群带”计算。 */
export const RIVER_WORLD_WIDTH = RIVER_UNKNOWN_BAND.x + RIVER_UNKNOWN_BAND.width;
export const RIVER_WORLD_HEIGHT = RIVER_BAND_HEIGHT + 900;
/** 年代待考的作者放在最右侧专属星群带，不伪造年份。 */
export const RIVER_UNKNOWN_YEAR_X = RIVER_UNKNOWN_BAND.x;

/** 时期 → 星河星群带。 */
export function riverBandForPeriod(periodId: string): RiverBand | undefined {
  return RIVER_BANDS.find((band) => band.periodId === periodId);
}

/** 年份 → 所属星群带；用于时间轴/年份聚焦。 */
export function riverBandForYear(year: number): RiverBand | undefined {
  return (
    RIVER_BANDS.find((band) => {
      const period = PERIOD_BY_ID.get(band.periodId);
      return period ? year >= period.startYear && year <= period.endYear : false;
    }) ??
    RIVER_BANDS.find((band) => {
      const period = PERIOD_BY_ID.get(band.periodId);
      return period ? year < period.startYear : false;
    }) ??
    RIVER_BANDS.at(-1)
  );
}

/** 年份在一个朝代星群带内的 X 坐标（带内仍保持年份先后）。 */
export function riverXForYearInBand(year: number, band: RiverBand): number {
  const period = PERIOD_BY_ID.get(band.periodId);
  const padding = RIVER_BAND_COLLISION.X_PADDING;
  if (!period) return band.x + band.width / 2;
  const span = Math.max(period.endYear - period.startYear, 1);
  const fraction = Math.max(0, Math.min(1, (year - period.startYear) / span));
  return band.x + padding + fraction * (band.width - padding * 2);
}

/** 朝代星系世界画布尺寸（可相机缩放）。 */
export const GALAXY_WORLD_WIDTH = 2400;
export const GALAXY_WORLD_HEIGHT = 1400;

export const DEFAULT_TILE_Z = 0;
export const MAX_TILE_Z = 3;

export const WORKS_PAGE_SIZE = 30;

/** 供「星辰指南」使用的图例文案。 */
export const SKY_LEGEND = {
  size: '星辰大小 · 已收录作品量',
  brightness: '星辰亮度 · 文学影响力',
  note: '影响力评级仅依据可追溯的文学史与选本初评；未评级以中性亮度展示。',
};
