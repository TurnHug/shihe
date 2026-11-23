/**
 * 确定性布局工具：不使用 Math.random，保证同一 layoutVersion 下
 * 每次生成的诗人世界坐标完全一致。
 */

/** FNV-1a 32 位字符串哈希。 */
export function hashString(input: string, seed = 2166136261): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/** 把字符串哈希映射到 [0,1)。 */
export function hashUnit(input: string, salt = ''): number {
  return hashString(`${salt}|${input}`) / 4294967296;
}

/** mulberry32 伪随机数生成器（仅在需要序列时使用）。 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 稳定的 32 位 FNV 哈希（导出给去重/ID 生成脚本复用）。 */
export function fnv1a(input: string): string {
  return hashString(input).toString(36);
}
