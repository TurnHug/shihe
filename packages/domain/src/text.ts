import type { Genre } from './types';

/** 将数据库中的 \r\n、多余空行与行首尾空白规范化，不增删任何字句。 */
export function normalizePoemText(raw: string | readonly string[]): string {
  const joined = typeof raw === 'string' ? raw : raw.join('\n');
  return joined
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u3000]+$/u, '').replace(/^[ \t\u3000]+/u, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitParagraphs(text: string): string[] {
  return normalizePoemText(text)
    .split('\n')
    .filter((line) => line.trim().length > 0);
}

/** 标题规范化：只用于去重与检索键，不修改展示标题。 */
export function normalizeTitle(title: string): string {
  return title
    .replace(/[\s\u3000]+/gu, '')
    .replace(/^[《〈]+|[》〉]+$/gu, '')
    .trim();
}

/** 取正文首行作为搜索摘要，保持原文。 */
export function excerptFromText(text: string, maxLength = 52): string {
  const firstLine = normalizePoemText(text)
    .split('\n')
    .find((line) => line.trim().length > 0);
  if (!firstLine) return '';
  return firstLine.length > maxLength ? `${firstLine.slice(0, maxLength)}…` : firstLine;
}

/** 用于鉴权的稳定字符串比较（避免 timing attack 的简单写法）。 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 转义 SQL LIKE 中的通配符，配合 `ILIKE ... ESCAPE '\'` 使用。 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** 中文检索用 bigram；保留 ASCII 连续串。用于本地单元测试与索引校验。 */
export function chineseBigrams(input: string): string[] {
  const chars = Array.from(input.replace(/[\s\p{P}\p{S}]+/gu, ''));
  if (chars.length < 2) return chars;
  const grams: string[] = [];
  for (let i = 0; i < chars.length - 1; i += 1) {
    grams.push(`${chars[i]}${chars[i + 1]}`);
  }
  return grams;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatWorkCount(count: number): string {
  return `${count} ${count === 1 ? '首' : '首'}`;
}

export const GENRE_TEXT: Record<Genre, string> = {
  shi: '诗',
  ci: '词',
  qu: '曲',
};

/** 游标分页编解码：base64url(JSON)。 */
export function encodeCursor(value: Record<string, string | number>): string {
  const json = JSON.stringify(value);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeCursor<T extends object>(cursor: string): T | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return null;
  } catch {
    return null;
  }
}

/** 把 `?mode=` 等查询参数收敛为允许值。 */
export function isSkyMode(value: unknown): value is 'river' | 'galaxy' {
  return value === 'river' || value === 'galaxy';
}

export function isGenre(value: unknown): value is Genre {
  return value === 'shi' || value === 'ci' || value === 'qu';
}

/** 校验公开 ID 形态，避免把任意字符串塞进查询。 */
export function isValidPublicId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,80}$/.test(value);
}

/** 中文数字序列表，用于「其一」「其二」等标题的展示，不做内容改写。 */
export const CN_ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;
