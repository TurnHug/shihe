import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE_NAME } from '@shihe/domain';
import { getPublicStats, searchAll } from '@shihe/db/server';

import { PageHeader, SiteFooter, StaticBackdrop } from '@/components/common/PageChrome';
import { withBasePath } from '@/lib/base-path';

import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '全站搜索',
  description:
    '在诗河 · 千年星图中检索诗人姓名、字号、作品标题与诗词原文片段，结果分为诗人与作品两组。',
  alternates: { canonical: '/search' },
  robots: { index: false, follow: true },
};

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SUGGESTIONS = ['李白', '杜甫', '苏轼', '李清照', '明月', '静夜思', '大江东去'];

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const rawQuery = typeof params.q === 'string' ? params.q.trim() : '';
  const query = rawQuery.slice(0, 48);
  const [results, stats] = await Promise.all([
    query ? searchAll({ q: query, limit: 30 }) : Promise.resolve(null),
    getPublicStats(),
  ]);

  return (
    <>
      <StaticBackdrop />
      <PageHeader current="search" />
      <main id="main-content" className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.overline}>SEARCH · 全站检索</p>
          <h1 className={styles.title}>寻一位诗人，或一首诗。</h1>
          <p className={styles.subtitle}>
            支持诗人姓名、字/号/别名、作品标题与全文句子片段。输入实时检索时使用防抖。
          </p>
        </section>

        <form
          className={styles.searchForm}
          action={withBasePath('/search')}
          method="get"
          role="search"
        >
          <span className={styles.searchIcon} aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="试试：李白、静夜思、明月……"
            aria-label="搜索诗人、作品标题或诗句"
            autoFocus={!query}
          />
          <button type="submit">搜索</button>
        </form>

        <div className={styles.suggestions} aria-label="搜索建议">
          <span>试试</span>
          {SUGGESTIONS.map((suggestion) => (
            <Link key={suggestion} href={`/search?q=${encodeURIComponent(suggestion)}`}>
              {suggestion}
            </Link>
          ))}
        </div>

        {!query ? (
          <div className={styles.hintBlock}>
            <p className={styles.hintTitle}>搜索范围</p>
            <ul>
              <li>诗人：姓名、字号、别名（如「太白」「东坡」「易安」）。</li>
              <li>作品：标题、原文全文片段（中文 n-gram / trigram 索引）。</li>
              <li>所有结果均来自已发布、权利状态清晰的收录内容。</li>
            </ul>
          </div>
        ) : null}

        {query && results ? (
          <>
            <div className={styles.resultBar}>
              <p>
                关键词「{query}」 · 当前展示 {results.total} 条
              </p>
              <p className={styles.resultNote}>
                人工校核内容优先，带「全库」标记为批量导入待校核文本 · 仅展示前 30 条
              </p>
            </div>

            {results.total === 0 ? (
              <div className={styles.empty}>
                <p>没有找到与「{query}」相关的诗人或作品。</p>
                <p>可尝试更短的关键词，或换用作者的字号、作品的常见标题。</p>
              </div>
            ) : (
              <div className={styles.groups}>
                {results.poets.length > 0 ? (
                  <section className={styles.group} aria-label="诗人结果">
                    <header className={styles.groupHead}>
                      <h2>诗人</h2>
                      <span>{results.poets.length} 位</span>
                    </header>
                    <ul className={styles.resultList}>
                      {results.poets.map((poet) => (
                        <li key={poet.id}>
                          <Link className={styles.poetRow} href={`/poets/${poet.id}`}>
                            <span className={styles.poetInitial} aria-hidden="true">
                              {poet.initial}
                            </span>
                            <span className={styles.poetMain}>
                              <span className={styles.poetName}>
                                {poet.name}
                                {poet.dataTier === 'imported' ? (
                                  <em className={styles.tierBadge}>全库</em>
                                ) : null}
                              </span>
                              <span className={styles.poetMeta}>
                                {poet.dynastyLabel} · {poet.dateDisplay} · 收录{' '}
                                {poet.publishedWorkCount} 首
                              </span>
                            </span>
                            <span className={styles.rowArrow} aria-hidden="true">
                              ↗
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {results.works.length > 0 ? (
                  <section className={styles.group} aria-label="作品结果">
                    <header className={styles.groupHead}>
                      <h2>作品</h2>
                      <span>{results.works.length} 首</span>
                    </header>
                    <ul className={styles.resultList}>
                      {results.works.map((work) => (
                        <li key={work.id}>
                          <Link className={styles.workRow} href={`/works/${work.id}`}>
                            <span className={styles.workMain}>
                              <span className={styles.workTitle}>
                                {work.title}
                                {work.featured ? <em>代表作</em> : null}
                                {work.dataTier === 'imported' ? (
                                  <em className={styles.tierBadge}>全库</em>
                                ) : null}
                              </span>
                              <span className={styles.workExcerpt}>{work.excerpt}</span>
                            </span>
                            <span className={styles.workMeta}>
                              {work.poetName} ·{' '}
                              {work.genre === 'ci' ? '词' : work.genre === 'qu' ? '曲' : '诗'}
                            </span>
                            <span className={styles.rowArrow} aria-hidden="true">
                              ↗
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            )}
          </>
        ) : null}

        <p className={styles.dataNote}>
          搜索仅覆盖 {SITE_NAME} 当前已发布的 {stats.publishedPoets} 位诗人、
          {stats.publishedWorks.toLocaleString('zh-CN')} 首作品，不代表全部传世作品。
        </p>

        <SiteFooter />
      </main>
    </>
  );
}
