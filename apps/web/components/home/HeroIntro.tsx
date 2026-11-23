'use client';

import styles from './HeroIntro.module.css';

interface HeroIntroProps {
  visible: boolean;
}

export function HeroIntro({ visible }: HeroIntroProps) {
  return (
    <section
      className={`${styles.intro} ${visible ? '' : styles.introHidden}`}
      aria-hidden={!visible}
    >
      <p className={styles.subtitle}>每一颗星辰，都是一个曾经照亮文字的人。</p>
      <h1 className={styles.title}>循星河，见诗心。</h1>
    </section>
  );
}
