import type { Genre } from '@shihe/domain';

export const GENRE_LABELS: Record<Genre, string> = {
  shi: '诗',
  ci: '词',
  qu: '曲',
};

export function formatWorkCount(count: number): string {
  return `${count} 首`;
}

export function formatDateWithDynasty(dynasty: string, dateDisplay: string): string {
  return dynasty ? `${dynasty} · ${dateDisplay}` : dateDisplay;
}

export function joinNonEmpty(parts: (string | null | undefined)[], separator = ' · '): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(separator);
}

/** 搜索防抖 Hook 用的小工具（在客户端使用）。 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}
