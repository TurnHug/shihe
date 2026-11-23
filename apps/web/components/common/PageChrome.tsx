import Link from 'next/link';

import styles from './PageChrome.module.css';

interface PageHeaderProps {
  /** 当前页面的轻量标识，用于高亮导航。 */
  current?: 'poets' | 'search' | 'about' | 'sky' | null;
  showBackToSky?: boolean;
}

export function PageHeader({ current = 'sky', showBackToSky = true }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="诗河 · 千年星图 首页">
        <span className={styles.brandMark} aria-hidden="true">
          诗
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>诗河 · 千年星图</span>
          <span className={styles.brandTag}>THE CONSTELLATION OF CHINESE POETRY</span>
        </span>
      </Link>
      <nav className={styles.nav} aria-label="站内导航">
        <Link
          className={`${styles.navLink} ${current === 'sky' ? styles.navLinkActive : ''}`}
          href="/"
        >
          星图
        </Link>
        <Link
          className={`${styles.navLink} ${current === 'poets' ? styles.navLinkActive : ''}`}
          href="/poets"
        >
          诗人名录
        </Link>
        <Link
          className={`${styles.navLink} ${current === 'search' ? styles.navLinkActive : ''}`}
          href="/search"
        >
          搜索
        </Link>
        <Link
          className={`${styles.navLink} ${current === 'about' ? styles.navLinkActive : ''}`}
          href="/about"
        >
          关于
        </Link>
        {showBackToSky ? (
          <Link className={styles.skyLink} href="/">
            返回星图
          </Link>
        ) : null}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerBrand}>
        <span className={styles.footerMark} aria-hidden="true">
          诗
        </span>
        <div>
          <p className={styles.footerName}>诗河 · 千年星图</p>
          <p className={styles.footerText}>持续整理的中国古典诗词数字资料库</p>
        </div>
      </div>
      <p className={styles.footerNote}>
        本网站为持续整理的数字诗词资料库，不代表全部传世作品；原文以公开古籍与授权数据整理，欢迎纠错。
      </p>
      <div className={styles.footerLinks}>
        <Link href="/about">数据声明</Link>
        <Link href="/poets">诗人名录</Link>
        <Link href="/search">全站搜索</Link>
      </div>
    </footer>
  );
}

export function StaticBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.backdropGlow} />
      <div className={styles.backdropStars} />
    </div>
  );
}
