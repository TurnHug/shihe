'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { SkyMode } from '@shihe/domain';

import styles from './TopNav.module.css';

interface TopNavProps {
  mode: SkyMode;
  onModeChange(mode: SkyMode): void;
  onOpenSearch(): void;
  onResetView(): void;
  relationsEnabled: boolean;
  onToggleRelations(): void;
}

export function TopNav({
  mode,
  onModeChange,
  onOpenSearch,
  onResetView,
  relationsEnabled,
  onToggleRelations,
}: TopNavProps) {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.brand} aria-label="诗河 · 千年星图 首页">
        <span className={styles.brandMark} aria-hidden="true">
          诗
        </span>
        <span className={styles.brandLines}>
          <span className={styles.brandName}>诗河 · 千年星图</span>
          <span className={styles.brandTag}>THE CONSTELLATION OF CHINESE POETRY</span>
        </span>
      </Link>

      <div className={styles.modeTabs} role="tablist" aria-label="星图模式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'river'}
          className={`${styles.modeTab} ${mode === 'river' ? styles.modeTabActive : ''}`}
          onClick={() => onModeChange('river')}
        >
          历史星河
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'galaxy'}
          className={`${styles.modeTab} ${mode === 'galaxy' ? styles.modeTabActive : ''}`}
          onClick={() => onModeChange('galaxy')}
        >
          朝代星系
        </button>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.searchButton}
          onClick={onOpenSearch}
          aria-label="搜索诗人或诗词（快捷键 Command K）"
        >
          <span className={styles.magnify} aria-hidden="true">
            ⌕
          </span>
          <span className={styles.searchPlaceholder}>搜索诗人 / 诗词</span>
          <kbd className={styles.kbd}>{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
        </button>

        <button
          type="button"
          className={`${styles.actionButton} ${styles.relationsButton} ${relationsEnabled ? styles.actionButtonActive : ''}`}
          onClick={onToggleRelations}
          aria-pressed={relationsEnabled}
          title="仅展示有史料来源、已审核的人物关系"
        >
          关系模式
        </button>

        <Link className={`${styles.actionButton} ${styles.indexButton}`} href="/poets">
          诗人名录
        </Link>

        <button
          type="button"
          className={`${styles.actionButton} ${styles.roundButton}`}
          onClick={onResetView}
          aria-label="返回星图全景"
          title="返回星图全景"
        >
          ⌂
        </button>
      </div>
    </header>
  );
}
