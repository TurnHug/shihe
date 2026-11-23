import { SKY_LEGEND } from '@shihe/domain';

import styles from './LeftGuide.module.css';

export function LeftGuide() {
  return (
    <aside className={styles.guide} aria-label="星辰指南">
      <p className={styles.heading}>星辰指南</p>
      <div className={styles.item}>
        <i className={`${styles.dot} ${styles.dotLarge}`} aria-hidden="true" />
        <span>{SKY_LEGEND.size}</span>
      </div>
    </aside>
  );
}
