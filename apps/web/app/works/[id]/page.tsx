import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GENRE_LABEL, SITE_NAME } from '@shihe/domain';
import { getWorkDetail } from '@shihe/db/server';

import { CopyButton } from '@/components/common/CopyButton';
import { ShareButton } from '@/components/common/ShareButton';

import styles from './page.module.css';

export const dynamic = 'force-dynamic';

interface WorkPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: WorkPageProps): Promise<Metadata> {
  const { id } = await params;
  const work = await getWorkDetail(id);
  if (!work) return { title: '作品未找到' };
  const excerpt = work.paragraphs[0] ?? '';
  return {
    title: `${work.title} · ${work.poetName}`,
    description: `${work.dynastyLabel} · ${work.poetName}《${work.title}》：${excerpt}`,
    alternates: { canonical: `/works/${work.id}` },
    robots:
      work.dataTier === 'imported' ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: `${work.title} · ${work.poetName}｜${SITE_NAME}`,
      description: excerpt,
      type: 'article',
    },
  };
}

export default async function WorkPage({ params }: WorkPageProps) {
  const { id } = await params;
  const work = await getWorkDetail(id);
  if (!work) notFound();

  const copyText = `《${work.title}》\n${work.dynastyLabel} · ${work.poetName}\n\n${work.text}`;
  const poetHref = `/poets/${work.poetId}`;
  const genre = GENRE_LABEL[work.genre];

  return (
    <div className={styles.reader}>
      <div className={styles.arcane} aria-hidden="true" />
      <header className={styles.toolbar}>
        <Link className={styles.back} href={poetHref}>
          <span aria-hidden="true">←</span>
          <span>返回作品目录</span>
        </Link>
        <Link className={styles.brand} href="/">
          诗河 · 千年星图
        </Link>
        <div className={styles.actions}>
          <CopyButton className={styles.action} text={copyText} label="复制原文" />
          <ShareButton className={styles.action} />
          <Link className={styles.action} href={poetHref}>
            关闭阅读
          </Link>
        </div>
      </header>

      {work.dataTier === 'imported' ? (
        <div className={styles.corpusNotice} role="note">
          <strong>批量导入文本 · 待校核</strong>
          <span>
            本作品来自开放语料数据集，尚未逐条完成文本校勘与作者归属复核。
            {work.qualityFlags.length > 0 ? ` 质量标记：${work.qualityFlags.join('、')}。` : ''}
          </span>
          <Link href="/library">查看数据说明</Link>
        </div>
      ) : null}

      <main id="main-content" className={styles.center}>
        <aside className={styles.side} aria-hidden="true">
          <div className={styles.sideIndex}>诗</div>
          <div className={styles.sideText}>
            千年星河中
            <br />
            每一段文字都值得静静阅读
          </div>
          <div className={styles.ornament} />
          <div className={styles.sideTextSmall}>保持原文，不添加译文与赏析</div>
        </aside>

        <div className={styles.mainColumn}>
          <article className={styles.paper} lang="zh-Hans">
            <div className={styles.paperInner}>
              <p className={styles.category}>{genre} · 原文</p>
              <h1 className={styles.title} data-testid="reader-title">
                {work.title}
              </h1>
              <p className={styles.author}>
                <Link href={poetHref}>
                  {work.dynastyLabel} · {work.poetName}
                </Link>
              </p>
              <div className={styles.divider} aria-hidden="true">
                <i />
                <em>❖</em>
                <i />
              </div>

              <div className={styles.poem}>
                {work.paragraphs.map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 8)}`} className={styles.poemLine}>
                    {paragraph}
                  </p>
                ))}
              </div>

              <nav className={styles.paging} aria-label="作品翻页">
                {work.prevWork ? (
                  <Link href={`/works/${work.prevWork.id}`} className={styles.pagingLink}>
                    ← 上一篇
                  </Link>
                ) : (
                  <span className={styles.pagingDisabled}>← 上一篇</span>
                )}
                <Link href={poetHref} className={styles.pagingCenter}>
                  作品目录
                </Link>
                {work.nextWork ? (
                  <Link href={`/works/${work.nextWork.id}`} className={styles.pagingLink}>
                    下一篇 →
                  </Link>
                ) : (
                  <span className={styles.pagingDisabled}>下一篇 →</span>
                )}
              </nav>

              <p className={styles.credit}>诗河 · 以诗为灯，照见千年</p>
            </div>
          </article>

          <details className={styles.sourceInfo}>
            <summary>来源与版本信息</summary>
            <dl>
              <div>
                <dt>来源</dt>
                <dd>{work.source.title}</dd>
              </div>
              {work.source.editor ? (
                <div>
                  <dt>编者</dt>
                  <dd>{work.source.editor}</dd>
                </div>
              ) : null}
              {work.source.edition ? (
                <div>
                  <dt>版本</dt>
                  <dd>{work.source.edition}</dd>
                </div>
              ) : null}
              {work.source.urlOrBib ? (
                <div>
                  <dt>文献链接</dt>
                  <dd>
                    <a href={work.source.urlOrBib} target="_blank" rel="noreferrer noopener">
                      {work.source.urlOrBib}
                    </a>
                  </dd>
                </div>
              ) : null}
              {work.source.verifiedAt ? (
                <div>
                  <dt>最近核验</dt>
                  <dd>{new Date(work.source.verifiedAt).toLocaleDateString('zh-CN')}</dd>
                </div>
              ) : null}
              {work.attributionNote ? (
                <div>
                  <dt>归属说明</dt>
                  <dd>{work.attributionNote}</dd>
                </div>
              ) : null}
              {work.qualityFlags.length > 0 ? (
                <div>
                  <dt>质量标记</dt>
                  <dd>{work.qualityFlags.join('、')}</dd>
                </div>
              ) : null}
            </dl>
          </details>
        </div>

        <aside className={`${styles.side} ${styles.sideRight}`} aria-hidden="true">
          <div className={styles.sideIndex}>河</div>
          <div className={styles.sideText}>
            光阴流转 · 诗意长存
            <br />
            在群星之间遇见古人
          </div>
          <div className={`${styles.ornament} ${styles.ornamentRight}`} />
          <div className={styles.sideTextSmall}>时间是岸，文字是舟</div>
        </aside>
      </main>
    </div>
  );
}
