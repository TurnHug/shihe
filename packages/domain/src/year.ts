import { PERIOD_BY_ID, PERIODS } from './constants';
import type { AstronomicalYear, DatePrecision, Period, SkyMode } from './types';

export const YEAR_UNKNOWN_LABEL = '年代待考';

/** 公元前年份转天文纪年：前1046 → -1045。 */
export function bceToAstronomical(bceYear: number): AstronomicalYear {
  if (!Number.isInteger(bceYear) || bceYear < 1) {
    throw new RangeError('公元前年份必须是大于 0 的整数');
  }
  return 1 - bceYear;
}

/** 天文纪年转公元前年份：-1045 → 1046。 */
export function astronomicalToBce(astronomicalYear: AstronomicalYear): number {
  return 1 - astronomicalYear;
}

/**
 * 简洁年份展示：前1046 / 701。
 * 天文纪年 0 显示为「前1」，永远不产生「公元0年」。
 */
export function formatYear(astronomicalYear: AstronomicalYear): string {
  if (!Number.isFinite(astronomicalYear)) {
    return YEAR_UNKNOWN_LABEL;
  }
  const year = Math.trunc(astronomicalYear);
  return year <= 0 ? `前${1 - year}` : `${year}`;
}

/** 完整年份展示：公元前1046年 / 公元701年。 */
export function formatYearFull(astronomicalYear: AstronomicalYear): string {
  if (!Number.isFinite(astronomicalYear)) {
    return YEAR_UNKNOWN_LABEL;
  }
  const year = Math.trunc(astronomicalYear);
  return year <= 0 ? `公元前${1 - year}年` : `公元${year}年`;
}

export interface DateDisplayInput {
  birthYear: AstronomicalYear | null;
  deathYear: AstronomicalYear | null;
  activityStart: AstronomicalYear | null;
  activityEnd: AstronomicalYear | null;
  datePrecision: DatePrecision;
  periodId?: string;
}

export interface DateDisplayResult {
  /** 设计稿中的紧凑展示，如「701—762」「约365—427」「生卒年待考」。 */
  display: string;
  /** 可信度说明，用于详情面板。 */
  note: string;
  /** 用于星图布局的代表年份；null 表示年代待考。 */
  eventYear: AstronomicalYear | null;
  isEstimated: boolean;
}

function approxPrefix(precision: DatePrecision): string {
  return precision === 'approx' ? '约' : '';
}

/**
 * 生成年代展示与星图代表年份。
 *
 * 规则（与 PRD §6.2 一致）：
 * 1. 生卒年齐全时优先使用；出生年未知、活动期已知时使用活动期代表值；
 * 2. 仅有朝代归属时，以所属时期中点作为视觉估计位置并标记「年代约略」；
 * 3. 完全无可考年代时返回 null，由星图放入「年代待考」区域，不伪造年份。
 */
export function describeDates(input: DateDisplayInput): DateDisplayResult {
  const { birthYear, deathYear, activityStart, activityEnd, datePrecision } = input;
  const prefix = approxPrefix(datePrecision);

  if (birthYear != null && deathYear != null) {
    return {
      display: `${prefix}${formatYear(birthYear)}—${formatYear(deathYear)}`,
      note:
        datePrecision === 'approx'
          ? '生卒年据通行年表整理，存在约略误差。'
          : '生卒年据通行年表整理。',
      eventYear: birthYear,
      isEstimated: datePrecision === 'approx',
    };
  }

  if (birthYear != null) {
    return {
      display: `${prefix}${formatYear(birthYear)}—卒年待考`,
      note: '仅存出生年，卒年待考。',
      eventYear: birthYear,
      isEstimated: true,
    };
  }

  if (deathYear != null) {
    return {
      display: `生年待考—${prefix}${formatYear(deathYear)}`,
      note: '仅存卒年，生年待考。',
      eventYear: deathYear,
      isEstimated: true,
    };
  }

  if (activityStart != null && activityEnd != null) {
    return {
      display: `${prefix}${formatYear(activityStart)}—${formatYear(activityEnd)}（活动时期）`,
      note: '生卒年无确考，以有据可查的活动时期作为视觉位置，标注「年代约略」。',
      eventYear: Math.round((activityStart + activityEnd) / 2),
      isEstimated: true,
    };
  }

  if (activityStart != null || activityEnd != null) {
    const anchor = (activityStart ?? activityEnd) as AstronomicalYear;
    return {
      display: `${prefix}${formatYear(anchor)}前后（活动时期）`,
      note: '生卒年无确考，以有据可查的活动时期作为视觉位置，标注「年代约略」。',
      eventYear: anchor,
      isEstimated: true,
    };
  }

  const period = input.periodId ? PERIOD_BY_ID.get(input.periodId) : undefined;
  if (period) {
    return {
      display: `${period.name}（年代待考）`,
      note: '仅知所属时期，具体年代待考；星图位置按所属时期中点作视觉估计。',
      eventYear: Math.round((period.startYear + period.endYear) / 2),
      isEstimated: true,
    };
  }

  return {
    display: YEAR_UNKNOWN_LABEL,
    note: '生卒年与活动时期均无可考，归入「年代待考」。',
    eventYear: null,
    isEstimated: true,
  };
}

/** 判断某天文纪年是否落在时期内（含端点）。 */
export function periodContainsYear(period: Period, year: AstronomicalYear): boolean {
  return year >= period.startYear && year <= period.endYear;
}

/** 返回与给定年份相交的所有时期（并立时期可能多于一个）。 */
export function periodsAtYear(year: AstronomicalYear): Period[] {
  return PERIODS.filter((period) => periodContainsYear(period, year)).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function findPeriodById(periodId: string | null | undefined): Period | null {
  if (!periodId) return null;
  return PERIOD_BY_ID.get(periodId) ?? null;
}

/** 时期中点年份，用于相机聚焦。 */
export function periodCenterYear(period: Period): AstronomicalYear {
  return Math.round((period.startYear + period.endYear) / 2);
}

/** 两个时期是否在时间上并行/交叠。 */
export function periodsOverlap(a: Period, b: Period): boolean {
  return a.startYear <= b.endYear && b.startYear <= a.endYear;
}

/** 星图两种模式下的相机聚焦年份区间。 */
export function defaultFocusYearForMode(mode: SkyMode): AstronomicalYear {
  return mode === 'river' ? 760 : 760;
}

/** 用于 `<time>` 与分享文案的年代范围展示。 */
export function formatPeriodRange(period: Period): string {
  const start = formatYear(period.startYear);
  const end = formatYear(period.endYear);
  return `${start}—${end}`;
}
