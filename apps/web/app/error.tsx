'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[page] 未处理错误', error);
  }, [error]);

  return (
    <main
      id="main-content"
      style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}
    >
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <p style={{ color: 'var(--color-accent-gold)', letterSpacing: '0.3em', fontSize: 12 }}>
          STAR LOST
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 400,
            fontSize: 'clamp(30px, 5vw, 46px)',
            letterSpacing: '0.12em',
            margin: '18px 0 12px',
          }}
        >
          星河暂时失序
        </h1>
        <p style={{ color: 'var(--color-text-muted)', lineHeight: 2 }}>
          页面加载时出现异常。你可以重试，或回到星图与文字名录继续浏览。
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 26 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '11px 22px',
              borderRadius: 999,
              border: '1px solid var(--color-border-strong)',
              color: 'var(--color-accent-gold-bright)',
            }}
          >
            重新尝试
          </button>
          <Link
            href="/"
            style={{
              padding: '11px 22px',
              borderRadius: 999,
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            返回星图
          </Link>
        </div>
      </div>
    </main>
  );
}
