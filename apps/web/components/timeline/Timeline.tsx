'use client';

import { RIVER_BANDS } from '@shihe/domain';
import type { GalaxyRealm, Genre, Period, SkyMode } from '@shihe/domain';
import { formatPeriodRange } from '@shihe/domain';

import styles from './Timeline.module.css';

interface TimelineProps {
  mode: SkyMode;
  periods: Period[];
  /** 历史星河世界边界：用于把时间轴节点对齐到天空中的朝代星群。 */
  riverBounds?: { minX: number; maxX: number };
  realms: GalaxyRealm[];
  activePeriodId: string | null;
  onSelectPeriod(periodId: string): void;
  onReset?(): void;
  genre: Genre | null;
  onGenreChange(genre: Genre | null): void;
}

interface TimelineItem {
  id: string;
  name: string;
  range: string;
  hint: string;
  /** 移动端使用的短名称。 */
  shortName?: string;
  /** 0–1 横向位置；仅历史星河使用。 */
  position?: number;
}

export function Timeline({
  mode,
  periods,
  riverBounds,
  realms,
  activePeriodId,
  onSelectPeriod,
  onReset,
  genre,
  onGenreChange,
}: TimelineProps) {
  const riverStart = riverBounds?.minX ?? 0;
  const riverWidth = Math.max((riverBounds?.maxX ?? 1) - riverStart, 1);
  const items: TimelineItem[] =
    mode === 'river'
      ? periods.map((period) => {
          const band = RIVER_BANDS.find((item) => item.periodId === period.id);
          const center = band ? band.x + band.width / 2 : riverStart + riverWidth / 2;
          return {
            id: period.id,
            name: period.name,
            shortName: period.shortName,
            range: formatPeriodRange(period),
            hint: period.description,
            position: Math.max(0.01, Math.min(0.99, (center - riverStart) / riverWidth)),
          };
        })
      : realms.map((realm) => ({
          id: realm.id,
          name: realm.name,
          range: realm.subtitle,
          hint: realm.subtitle,
        }));

  const firstName = items[0]?.name ?? '';
  const lastName = items.at(-1)?.name ?? '';

  return (
    <nav className={styles.wrap} aria-label={mode === 'river' ? '历史时间轴' : '朝代星域导航'}>
      <div className={styles.header}>
        <p className={styles.name}>
          {mode === 'river' ? '千年长河 · 朝代星群' : '诸代星域 · 朝代导览'}
        </p>
        <p className={styles.desc}>
          {mode === 'river' ? '十个朝代星群沿时间展开 · 点击聚焦' : '切换模式，探索不同星群与人物'}
        </p>
        <div className={styles.genreFilter} role="group" aria-label="按体裁筛选星辰">
          <span className={styles.genreLabel}>体裁</span>
          {(
            [
              { id: null, label: '全部' },
              { id: 'shi', label: '诗' },
              { id: 'ci', label: '词' },
              { id: 'qu', label: '曲' },
            ] as const
          ).map((option) => (
            <button
              key={option.id ?? 'all'}
              type="button"
              className={`${styles.genreChip} ${genre === option.id ? styles.genreChipActive : ''}`}
              onClick={() => onGenreChange(option.id)}
              aria-pressed={genre === option.id}
              data-testid={`genre-${option.id ?? 'all'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {onReset ? (
          <button type="button" className={styles.reset} onClick={onReset}>
            回到全景
          </button>
        ) : null}
      </div>

      <div className={styles.track} data-mode={mode}>
        <div className={styles.line} aria-hidden="true" />
        {items.map((item, index) => {
          const active = item.id === activePeriodId;
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.item} ${active ? styles.itemActive : ''}`}
              onClick={() => onSelectPeriod(item.id)}
              aria-pressed={active}
              title={item.hint}
              data-testid={`timeline-${item.id}`}
              style={
                mode === 'river' && item.position != null
                  ? { left: `${item.position * 100}%` }
                  : undefined
              }
            >
              <span className={styles.pin} aria-hidden="true" />
              <span className={`${styles.label} ${styles.labelFull}`}>{item.name}</span>
              {item.shortName ? (
                <span className={`${styles.label} ${styles.labelShort}`}>{item.shortName}</span>
              ) : null}
              {index === 0 || index === items.length - 1 ? (
                <span className={styles.srOnly}>
                  （{item.range}
                  {index === 0 ? ` 至 ${lastName}` : ` 自 ${firstName}`}）
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
