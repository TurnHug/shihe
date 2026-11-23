import { GALAXY_REALMS, GALAXY_WORLD_HEIGHT, GALAXY_WORLD_WIDTH } from '@shihe/domain';
import type { LayoutResult, StarLayoutInput } from '@shihe/domain';

import { hashUnit } from './hash';

export interface GalaxyLayoutOptions {
  version: string;
  worldWidth?: number;
  worldHeight?: number;
}

const MIN_STAR_GAP = 34;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface RealmCluster {
  realmId: string;
  centerX: number;
  centerY: number;
  radius: number;
  stars: StarLayoutInput[];
}

/**
 * 朝代星系布局（PRD §7.2 / §7.3）：
 * - 以六个文学星域为聚类单元，星域中心锚点来自视觉设计稿；
 * - 星域半径随收录作者数量增长，但设有最小面积与间距；
 * - 星域内部按出生年排序后沿黄金角螺旋分布，同种子结果稳定；
 * - 年代待考者放在星域边缘，不伪造时间位置。
 */
export function buildGalaxyLayout(
  stars: readonly StarLayoutInput[],
  options: GalaxyLayoutOptions,
): LayoutResult {
  const worldWidth = options.worldWidth ?? GALAXY_WORLD_WIDTH;
  const worldHeight = options.worldHeight ?? GALAXY_WORLD_HEIGHT;

  const byRealm = new Map<string, StarLayoutInput[]>();
  for (const star of stars) {
    const realmId = star.realmId ?? fallbackRealmId(star.periodId);
    const list = byRealm.get(realmId) ?? [];
    list.push(star);
    byRealm.set(realmId, list);
  }

  const clusters: RealmCluster[] = [];
  for (const realm of GALAXY_REALMS) {
    const realmStars = byRealm.get(realm.id) ?? [];
    if (realmStars.length === 0) continue;
    const radius = Math.max(
      realm.baseRadius,
      realm.baseRadius * 0.55 + Math.sqrt(realmStars.length) * 22,
    );
    clusters.push({
      realmId: realm.id,
      centerX: realm.anchor.x * worldWidth,
      centerY: realm.anchor.y * worldHeight,
      radius,
      stars: realmStars,
    });
  }

  // 未知星域（理论上不会出现）单独放在右下角，保持可访问。
  const knownRealmIds = new Set(clusters.map((cluster) => cluster.realmId));
  const orphanStars = [...byRealm.entries()]
    .filter(([realmId]) => !knownRealmIds.has(realmId))
    .flatMap(([, list]) => list);
  if (orphanStars.length > 0) {
    clusters.push({
      realmId: 'realm-unknown',
      centerX: worldWidth * 0.5,
      centerY: worldHeight * 0.92,
      radius: 160,
      stars: orphanStars,
    });
  }

  const points: { poetId: string; x: number; y: number }[] = [];

  for (const cluster of clusters) {
    const ordered = [...cluster.stars].sort((a, b) => {
      const aYear = a.eventYear ?? Number.POSITIVE_INFINITY;
      const bYear = b.eventYear ?? Number.POSITIVE_INFINITY;
      if (aYear !== bYear) return aYear - bYear;
      return a.sortIndex - b.sortIndex || a.poetId.localeCompare(b.poetId);
    });

    const placed: { x: number; y: number }[] = [];
    ordered.forEach((star, index) => {
      const point = placeInCluster(star, index, ordered.length, cluster, placed);
      placed.push(point);
      points.push({ poetId: star.poetId, x: point.x, y: point.y });
    });
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = points.length ? Math.min(...xs) - 320 : 0;
  const maxX = points.length ? Math.max(...xs) + 320 : worldWidth;
  const minY = points.length ? Math.min(...ys) - 260 : 0;
  const maxY = points.length ? Math.max(...ys) + 260 : worldHeight;

  return {
    mode: 'galaxy',
    version: options.version,
    bounds: { minX, minY, maxX, maxY },
    points: points.map((point) => ({ ...point, mode: 'galaxy' as const })),
  };
}

function placeInCluster(
  star: StarLayoutInput,
  index: number,
  total: number,
  cluster: RealmCluster,
  placed: readonly { x: number; y: number }[],
): { x: number; y: number } {
  const unknown = star.eventYear == null;
  const usableRadius = cluster.radius * (unknown ? 1.14 : 0.96);

  // 黄金角螺旋保证整体分布均匀；哈希只提供轻微抖动，不改变宏观位置。
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const progress = total > 1 ? index / total : 0;
    const angle = index * GOLDEN_ANGLE + attempt * 0.618 + hashUnit(star.poetId, 'galaxy-a') * 0.8;
    const radiusFactor = Math.sqrt((index + 0.55 + attempt * 0.05) / Math.max(total, 1));
    const jitter = (hashUnit(star.poetId, `galaxy-j${attempt}`) * 2 - 1) * 14;
    const radius = Math.min(usableRadius, usableRadius * (radiusFactor * 0.92) + jitter);
    const x = cluster.centerX + Math.cos(angle) * radius;
    const y = cluster.centerY + Math.sin(angle) * radius * 0.72;
    const collides = placed.some((point) => Math.hypot(point.x - x, point.y - y) < MIN_STAR_GAP);
    if (!collides) return { x, y };
    if (attempt > 0 && progress > 0.98) {
      // 星域末尾的拥挤点逐步落到外圈。
      const outerAngle = angle + attempt * 0.31;
      const outerRadius = usableRadius * (1 + attempt * 0.006);
      const outerX = cluster.centerX + Math.cos(outerAngle) * outerRadius;
      const outerY = cluster.centerY + Math.sin(outerAngle) * outerRadius * 0.72;
      if (!placed.some((point) => Math.hypot(point.x - outerX, point.y - outerY) < MIN_STAR_GAP)) {
        return { x: outerX, y: outerY };
      }
    }
  }

  const angle = index * GOLDEN_ANGLE;
  const radius = usableRadius * (0.94 + hashUnit(star.poetId, 'galaxy-fallback') * 0.12);
  return {
    x: cluster.centerX + Math.cos(angle) * radius,
    y: cluster.centerY + Math.sin(angle) * radius * 0.72,
  };
}

function fallbackRealmId(periodId: string): string {
  const table: Record<string, string> = {
    'pre-qin': 'realm-pre-qin',
    'qin-han': 'realm-wei-jin',
    'wei-jin': 'realm-wei-jin',
    'sui-tang': 'realm-sui-tang',
    'five-dynasties': 'realm-sui-tang',
    'song-liao-jin': 'realm-song',
    yuan: 'realm-yuan-ming',
    ming: 'realm-yuan-ming',
    qing: 'realm-qing-republic',
    republic: 'realm-qing-republic',
  };
  return table[periodId] ?? 'realm-unknown';
}

/** 供测试/文档使用。 */
export const GALAXY_COLLISION = { MIN_STAR_GAP } as const;
