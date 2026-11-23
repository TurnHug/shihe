import type { AstronomicalYear, DatePrecision, Genre } from './types';

/** 数据类型层级：人工校核 / 批量导入。 */
export type DataTier = 'curated' | 'imported';

export type VerificationStatus = 'curated' | 'imported';

/** 批量导入文本的质量标记（只描述数据情况，不改写原文）。 */
export type QualityFlag =
  | 'contains_placeholder'
  | 'short_text'
  | 'converted_traditional'
  | 'missing_title'
  | 'anonymous_author'
  | 'unknown_dynasty'
  | 'modern_excluded';

export interface CorpusDynastyMapping {
  /** 规范后的展示朝代标签，如「唐」「宋末元初」。 */
  label: string;
  /** 映射到站内文学时期；未知为 null。 */
  periodId: string | null;
  /** 是否属于本次公开导入范围（古典、权利状态可确认）。 */
  publishable: boolean;
  /** 不公开导入时的原因。 */
  exclusionReason?: string;
  /** 是否为跨代时期（用于作者多时期归属提示）。 */
  transition: boolean;
}

/**
 * 朝代标签 → 站内时期映射。
 *
 * 设计原则：
 * - 只做导航归类，不被视为严格历史断代；
 * - 近现代 / 当代 / 民国（批量语料）默认不公开导入：作者卒年与作品创作时间无法逐条核验，
 *   可能仍在著作权保护期，需人工审核后再放行；
 * - 完全未知朝代保留为「朝代待考」，不伪造时期。
 */
export function mapCorpusDynasty(raw: string | null | undefined): CorpusDynastyMapping {
  const value = (raw ?? '').trim();
  const label = value || '朝代待考';

  if (!value) {
    return { label, periodId: null, publishable: true, transition: false };
  }

  // 明确不公开导入的现代语料：权利状态无法仅凭数据集确认。
  if (/当代|近现代|民国/.test(value)) {
    return {
      label,
      periodId: null,
      publishable: false,
      exclusionReason: '现代/民国批量语料需逐条核验作者卒年与作品权利状态',
      transition: false,
    };
  }

  // 跨代标签优先归入后一朝代，避免“宋末元初”被笼统归入宋。
  if (/元末明初/.test(value)) {
    return { label, periodId: 'ming', publishable: true, transition: true };
  }
  if (/明末清初/.test(value)) {
    return { label, periodId: 'qing', publishable: true, transition: true };
  }
  if (/宋末元初|金末元初/.test(value)) {
    return { label, periodId: 'yuan', publishable: true, transition: true };
  }
  if (/唐末宋初/.test(value)) {
    return { label, periodId: 'song-liao-jin', publishable: true, transition: true };
  }
  if (/宋末金初/.test(value)) {
    return { label, periodId: 'song-liao-jin', publishable: true, transition: true };
  }
  if (/魏晋末南北朝初/.test(value)) {
    return { label, periodId: 'wei-jin', publishable: true, transition: true };
  }

  if (/先秦|周/.test(value)) {
    return { label, periodId: 'pre-qin', publishable: true, transition: false };
  }
  if (/秦(?!汉)|^秦$|汉/.test(value)) {
    return { label, periodId: 'qin-han', publishable: true, transition: false };
  }
  if (/魏晋|晋|南北朝|魏/.test(value)) {
    return { label, periodId: 'wei-jin', publishable: true, transition: false };
  }
  if (/隋|唐/.test(value)) {
    const transition = /末|初/.test(value);
    return { label, periodId: 'sui-tang', publishable: true, transition };
  }
  if (/五代/.test(value)) {
    return { label, periodId: 'five-dynasties', publishable: true, transition: false };
  }
  if (/宋|辽|金|西夏/.test(value)) {
    const transition = /末|初/.test(value);
    return { label, periodId: 'song-liao-jin', publishable: true, transition };
  }
  if (/元/.test(value)) {
    const transition = /末|初/.test(value);
    return { label, periodId: 'yuan', publishable: true, transition };
  }
  if (/明/.test(value)) {
    const transition = /末|初/.test(value);
    return { label, periodId: 'ming', publishable: true, transition };
  }
  if (/清/.test(value)) {
    const transition = /末|初/.test(value);
    return { label, periodId: 'qing', publishable: true, transition };
  }

  return { label, periodId: null, publishable: true, transition: false };
}

/** 作者姓名规范化（仅用于归并键，不改变展示名）。 */
export function normalizeAuthorKeyName(name: string): string {
  return name
    .replace(/[\s\u3000]+/gu, '')
    .replace(/[（(][^）)]*[）)]/gu, '')
    .replace(/[·・]/gu, '')
    .trim();
}

/** 判断是否为佚名/无名氏署名。 */
export function isAnonymousAuthorName(name: string): boolean {
  return /^(佚名|无名氏|不详|无名|阙名|失名)/u.test(name.trim());
}

/** 作者归并键：姓名 + 时期；不同时期同名作者不合并。 */
export function corpusAuthorKey(name: string, periodId: string | null): string {
  const normalizedName = normalizeAuthorKeyName(name);
  if (isAnonymousAuthorName(name)) {
    return `anonymous|${periodId ?? 'unknown'}`;
  }
  return `${normalizedName}|${periodId ?? 'unknown'}`;
}

/** 批量导入作者默认的年代展示（不伪造具体年份）。 */
export function corpusDateDisplay(periodLabel: string): {
  display: string;
  note: string;
  precision: DatePrecision;
  eventYear: AstronomicalYear | null;
} {
  return {
    display: `${periodLabel}（年代待考）`,
    note: '批量导入语料仅提供朝代标注；具体生卒年与活动时期尚未核补，不伪造年份。',
    precision: 'period',
    eventYear: null,
  };
}

/** 数据来源类型。 */
export type CorpusSourceKey = 'werneror' | 'chinese-poetry' | 'poetry-collection';

/** 文本来源优先级：数值越小越优先作为正文底本。 */
export const CORPUS_SOURCE_PRIORITY: Record<CorpusSourceKey | 'curated', number> = {
  curated: 0,
  'chinese-poetry': 1,
  'poetry-collection': 2,
  werneror: 3,
};

/** 批量语料默认体裁（仅三类；无法可靠判断时归为诗，并在页面声明）。 */
export function inferCorpusGenre(input: {
  genreHint?: Genre | null;
  title?: string;
  sourceKey: CorpusSourceKey;
}): Genre {
  if (input.genreHint) return input.genreHint;
  if (input.sourceKey === 'chinese-poetry') {
    // 仅词/曲目录会在 adapter 中传入 hint；其余归诗。
    return 'shi';
  }
  return 'shi';
}
