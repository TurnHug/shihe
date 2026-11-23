import styles from './RightTeaser.module.css';

interface RightTeaserProps {
  visible: boolean;
  periodName?: string;
}

export function RightTeaser({ visible, periodName }: RightTeaserProps) {
  if (!visible) return null;
  return (
    <aside className={styles.teaser} aria-hidden="true">
      <p className={styles.overline}>一念千年 · 诗意不息</p>
      <p className={styles.main}>
        {periodName ? `${periodName} · 星火长明` : '群星有名，诗篇有声。'}
      </p>
      <p className={styles.sub}>
        {periodName ? '点击星辰，探索这一历史时期的诗意' : '轻触星辰，阅读属于他的文字'}
      </p>
    </aside>
  );
}
