import { IMPACT_TIER_LABEL } from './constants';
import type { ImpactTier } from './types';

/** 星辰核心半径的视觉参数（单位：CSS px 名义半径）。 */
export const STAR_RADIUS = {
  min: 2.4,
  max: 7.6,
} as const;

/**
 * 作品数量到星辰半径的平滑对数压缩（PRD §7.4）。
 * radius = r_min + (r_max - r_min) * log(1+n) / log(1+n_max)
 */
export function starRadius(workCount: number, maxWorkCount: number): number {
  const n = Math.max(0, Math.min(workCount, maxWorkCount));
  const nMax = Math.max(1, maxWorkCount);
  const ratio = Math.log(1 + n) / Math.log(1 + nMax);
  return STAR_RADIUS.min + (STAR_RADIUS.max - STAR_RADIUS.min) * ratio;
}

/**
 * 星等亮度权重：作用于核心白度、光晕与选中强调。
 * unranked 使用中性亮度，不代表最低级。
 */
export const STAR_BRIGHTNESS: Record<ImpactTier, number> = {
  A: 1,
  B: 0.84,
  C: 0.7,
  unranked: 0.58,
};

/** 核心颜色：未评级使用中性银白，避免被当作「差」。 */
export const STAR_CORE_COLOR: Record<ImpactTier, number> = {
  A: 0xfff1cf,
  B: 0xf6e3bf,
  C: 0xe8dcc6,
  unranked: 0xd7e2ec,
};

/** 光晕颜色：A/B/C 偏暖金，unranked 偏冷银蓝。 */
export const STAR_GLOW_COLOR: Record<ImpactTier, number> = {
  A: 0xf3c97e,
  B: 0xe6bd7c,
  C: 0xd9b97f,
  unranked: 0x9db8d6,
};

/**
 * 标签优先级：影响力权重为主，收录作品量为辅。
 * 仅影响标签显示顺序，不参与任何「水平评分」。
 */
export function labelPriority(impactTier: ImpactTier, workCount: number): number {
  const base: Record<ImpactTier, number> = { A: 3000, B: 2200, C: 1500, unranked: 800 };
  return base[impactTier] + Math.min(workCount, 1000) * 0.03;
}

export function impactTierLabel(tier: ImpactTier): string {
  return IMPACT_TIER_LABEL[tier];
}

/** 供图例/详情使用的亮度描述，而不是分数。 */
export function impactTierBrightnessLabel(tier: ImpactTier): string {
  switch (tier) {
    case 'A':
      return '高亮';
    case 'B':
      return '明亮';
    case 'C':
      return '温和';
    case 'unranked':
      return '中性';
  }
}
