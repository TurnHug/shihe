import {
  PERIOD_BY_ID,
  RIVER_BANDS,
  RIVER_BAND_COLLISION,
  RIVER_UNKNOWN_BAND,
  riverBandForPeriod,
  riverXForYearInBand,
  type RiverBand,
} from '@shihe/domain';
import type { LayoutResult, StarLayoutInput } from '@shihe/domain';

import { hashUnit } from './hash';

export interface RiverLayoutOptions {
  version: string;
  /** 兼容旧调用；新布局由朝代星群带决定，不再使用线性时间尺度。 */
  yLimit?: number;
}

interface PlacedPoint {
  x: number;
  y: number;
}

const GOLDEN_RATIO = 0.6180339887498949;

/**
 * 历史星河布局 v2：朝代星群带。
 *
 * 背景：109 位作者中唐、宋两代占 66 位，若严格按年份线性映射，
 * 全景会挤在长河中段，无法分辨不同朝代的诗人。
 *
 * 新规则：
 * - 十个时期各占一条独立的纵向星群带，按时间顺序横向排列；
 * - 带内 X 仍按作者代表年份先后排列，保持“时间从左到右”；
 * - 带内 Y 用确定性黄金分割分层 + 碰撞避让，让同期诗人散开；
 * - 相邻朝代之间保留明确的空白间隔；
 * - 年代待考作者放在最右侧独立星群带，不伪造年份。
 */
export function buildRiverLayout(
  stars: readonly StarLayoutInput[],
  options: RiverLayoutOptions,
): LayoutResult {
  const points: { poetId: string; x: number; y: number }[] = [];
  const byBand = new Map<string, StarLayoutInput[]>();

  for (const star of stars) {
    const band = resolveBandForStar(star);
    const key = band.periodId;
    const list = byBand.get(key) ?? [];
    list.push(star);
    byBand.set(key, list);
  }

  const allBands = [...RIVER_BANDS, RIVER_UNKNOWN_BAND];
  for (const band of allBands) {
    const bandStars = byBand.get(band.periodId);
    if (!bandStars || bandStars.length === 0) continue;
    const ordered = [...bandStars].sort((a, b) => {
      const aYear = a.eventYear ?? Number.POSITIVE_INFINITY;
      const bYear = b.eventYear ?? Number.POSITIVE_INFINITY;
      if (aYear !== bYear) return aYear - bYear;
      return a.sortIndex - b.sortIndex || a.poetId.localeCompare(b.poetId);
    });

    const placed: PlacedPoint[] = [];
    ordered.forEach((star, index) => {
      const point = placeInBand(star, index, ordered.length, band, placed);
      placed.push(point);
      points.push({ poetId: star.poetId, ...point });
    });
  }

  if (points.length === 0) {
    return {
      mode: 'river',
      version: options.version,
      bounds: emptyBounds(),
      points: [],
    };
  }

  return {
    mode: 'river',
    version: options.version,
    bounds: computeBounds(points),
    points: points.map((point) => ({ ...point, mode: 'river' as const })),
  };
}

function resolveBandForStar(star: StarLayoutInput): RiverBand {
  if (!star.periodId) return RIVER_UNKNOWN_BAND;
  return riverBandForPeriod(star.periodId) ?? RIVER_UNKNOWN_BAND;
}

function placeInBand(
  star: StarLayoutInput,
  index: number,
  total: number,
  band: RiverBand,
  placed: readonly PlacedPoint[],
): PlacedPoint {
  const { X_PADDING, MIN_GAP } = RIVER_BAND_COLLISION;
  const period = PERIOD_BY_ID.get(band.periodId);
  const jitterX = (hashUnit(star.poetId, 'river-band-x') * 2 - 1) * 16;

  // 有确切年份的作者严格按年份映射，保证带内时间顺序；
  // 仅“朝代已知、年份待考”者以带中心为基准轻微散开。
  const x =
    period && star.eventYear != null
      ? clamp(
          riverXForYearInBand(star.eventYear, band),
          band.x + X_PADDING,
          band.x + band.width - X_PADDING,
        )
      : clamp(
          band.x + band.width / 2 + jitterX,
          band.x + X_PADDING,
          band.x + band.width - X_PADDING,
        );

  // 黄金分割分层：按作者在朝代内的顺序给出均匀但非规则的纵向位置，
  // 避免“越晚出生越靠下”的机械斜线，也避免随机聚成一团。
  const baseRank = fract(
    (index + 0.5) * GOLDEN_RATIO + hashUnit(star.poetId, 'river-band-y') * 0.21,
  );
  const baseY = band.y + (baseRank * 2 - 1) * band.height * 0.44;

  const candidate = resolveBandY(baseY, x, band, placed, MIN_GAP);
  if (candidate != null) return { x, y: candidate };

  // 极端拥挤时沿带内再找空位。
  for (let step = 1; step <= 80; step += 1) {
    const offset = (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * MIN_GAP * 0.9;
    const y = clamp(baseY + offset, band.y - band.height * 0.46, band.y + band.height * 0.46);
    if (!collides(x, y, placed, MIN_GAP)) return { x, y };
  }

  return {
    x,
    y: clamp(baseY, band.y - band.height * 0.46, band.y + band.height * 0.46),
  };
}

function resolveBandY(
  baseY: number,
  x: number,
  band: RiverBand,
  placed: readonly PlacedPoint[],
  minGap: number,
): number | null {
  const minY = band.y - band.height * 0.46;
  const maxY = band.y + band.height * 0.46;
  const candidate = clamp(baseY, minY, maxY);
  if (!collides(x, candidate, placed, minGap)) return candidate;

  const direction = hashUnit(`${x.toFixed(2)}`, 'river-band-dir') > 0.5 ? 1 : -1;
  for (let step = 1; step <= 60; step += 1) {
    const offset = Math.ceil(step / 2) * (step % 2 === 0 ? -1 : 1) * direction * (minGap * 0.92);
    const y = clamp(baseY + offset, minY, maxY);
    if (!collides(x, y, placed, minGap)) return y;
  }
  return null;
}

function collides(x: number, y: number, placed: readonly PlacedPoint[], minGap: number): boolean {
  // 同一带内按二维距离避让；带之间由布局几何保证有足够间隔。
  return placed.some((point) => Math.hypot(point.x - x, point.y - y) < minGap);
}

function computeBounds(points: readonly PlacedPoint[]): LayoutResult['bounds'] {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const first = RIVER_BANDS[0];
  const last = RIVER_UNKNOWN_BAND;
  return {
    minX: Math.min(...xs, first?.x ?? 0) - 170,
    minY: Math.min(...ys) - 260,
    maxX: Math.max(...xs, last.x + last.width) + 190,
    maxY: Math.max(...ys) + 260,
  };
}

function emptyBounds(): LayoutResult['bounds'] {
  const last = RIVER_UNKNOWN_BAND;
  return {
    minX: -170,
    minY: -RIVER_BANDS[0]!.height / 2 - 260,
    maxX: last.x + last.width + 190,
    maxY: RIVER_BANDS[0]!.height / 2 + 260,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function fract(value: number): number {
  return value - Math.floor(value);
}

/** 导出供测试/文档使用。 */
export const RIVER_COLLISION = {
  MIN_Y_GAP: RIVER_BAND_COLLISION.MIN_GAP,
  COLUMN_WIDTH: RIVER_BAND_COLLISION.X_PADDING,
} as const;
