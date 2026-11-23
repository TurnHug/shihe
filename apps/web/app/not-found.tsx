import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main
      id="main-content"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <p style={{ color: 'var(--color-accent-gold)', letterSpacing: '0.3em', fontSize: 12 }}>
          LOST IN THE STARS
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 400,
            fontSize: 'clamp(34px, 6vw, 54px)',
            letterSpacing: '0.14em',
            margin: '18px 0 14px',
          }}
        >
          此星未寻见
        </h1>
        <p style={{ color: 'var(--color-text-muted)', lineHeight: 2 }}>
          这条星轨可能已移动，或内容尚未发布。回到星图，继续沿时间长河漫游。
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            marginTop: 28,
            padding: '12px 26px',
            borderRadius: '999px',
            border: '1px solid var(--color-border-strong)',
            color: 'var(--color-accent-gold-bright)',
            letterSpacing: '0.08em',
          }}
        >
          返回星图
        </Link>
      </div>
    </main>
  );
}
