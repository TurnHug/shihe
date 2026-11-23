import type { Metadata } from 'next';
import Link from 'next/link';

import { GENRES, SITE_NAME, formatPeriodRange, isGenre } from '@shihe/domain';
import type { Genre, PoetSummary } from '@shihe/domain';
import { listPeriods, listPoets, getPublicStats } from '@shihe/db/server';

import { PageHeader, SiteFooter, StaticBackdrop } from '@/components/common/PageChrome';

import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '诗人名录',
  description:
    '按朝代、体裁与姓名浏览诗河已收录的中国古典诗人。文字名录不依赖 WebGL，可直接进入诗人详情与作品原文。',
  alternates: { canonical: '/poets' },
};

interface DirectoryProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function fetchAllPoets(params: {
  periodId?: string;
  genre?: Genre;
  q?: string;
}): Promise<PoetSummary[]> {
  const all: PoetSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 3; page += 1) {
    const result = await listPoets({ ...params, limit: 100, cursor });
    all.push(...result.data);
    if (!result.meta.nextCursor) break;
    cursor = result.meta.nextCursor;
  }
  return all;
}

export default async function PoetsDirectoryPage({ searchParams }: DirectoryProps) {
  const params = await searchParams;
  const periodId = typeof params.periodId === 'string' ? params.periodId : undefined;
  const rawGenre = typeof params.genre === 'string' ? params.genre : undefined;
  const genre = rawGenre && isGenre(rawGenre) ? rawGenre : undefined;
  const q = typeof params.q === 'string' ? params.q.trim() : undefined;

  const [periods, poets, stats] = await Promise.all([
    listPeriods(),
    fetchAllPoets({ periodId, genre, q }),
    getPublicStats(),
  ]);

  const periodById = new Map(periods.map((period) => [period.id, period]));
  const groups = new Map<string, PoetSummary[]>();
  for (const poet of poets) {
    const key = poet.periodId || 'unknown';
    const list = groups.get(key) ?? [];
    list.push(poet);
    groups.set(key, list);
  }

  const activePeriod = periodId ? periodById.get(periodId) : undefined;
  const filterActive = Boolean(periodId || genre || q);

  return (
    <>
      <StaticBackdrop />
      <PageHeader current="poets" />
      <main id="main-content" className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.overline}>THE POETS · 文字名录</p>
            <h1 className={styles.title}>星河有名，人间有诗。</h1>
            <p className={styles.subtitle}>
              按朝代与体裁浏览已收录的诗人。名录不依赖 WebGL，在低性能设备或关闭动画的环境中同样可以
              直接进入诗人详情与原文阅读。
            </p>
          </div>
          <div className={styles.heroStats}>
            <p>
              <strong>{stats.publishedPoets}</strong>
              <span>位作者</span>
            </p>
            <p>
              <strong>{stats.publishedWorks.toLocaleString('zh-CN')}</strong>
              <span>首作品</span>
            </p>
            <p>
              <strong>{periods.length}</strong>
              <span>个历史时期</span>
            </p>
          </div>
        </section>

        <form className={styles.searchForm} action="/poets" method="get" role="search">
          {periodId ? <input type="hidden" name="periodId" value={periodId} /> : null}
          {genre ? <input type="hidden" name="genre" value={genre} /> : null}
          <span className={styles.searchIcon} aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="搜索诗人姓名或字号，如：李白、东坡、易安"
            aria-label="搜索诗人"
          />
          <button type="submit">检索</button>
        </form>

        <div className={styles.filters}>
          <div className={styles.filterRow} aria-label="按历史时期筛选">
            <span className={styles.filterLabel}>时期</span>
            <Link
              className={`${styles.chip} ${!periodId ? styles.chipActive : ''}`}
              href={genre ? `/poets?genre=${genre}` : '/poets'}
            >
              全部
            </Link>
            {periods.map((period) => (
              <Link
                key={period.id}
                className={`${styles.chip} ${periodId === period.id ? styles.chipActive : ''}`}
                href={`/poets?periodId=${period.id}${genre ? `&genre=${genre}` : ''}`}
                title={formatPeriodRange(period)}
              >
                {period.name}
              </Link>
            ))}
          </div>
          <div className={styles.filterRow} aria-label="按体裁筛选">
            <span className={styles.filterLabel}>体裁</span>
            <Link
              className={`${styles.chip} ${!genre ? styles.chipActive : ''}`}
              href={periodId ? `/poets?periodId=${periodId}` : '/poets'}
            >
              全部
            </Link>
            {GENRES.map((item) => (
              <Link
                key={item.id}
                className={`${styles.chip} ${genre === item.id ? styles.chipActive : ''}`}
                href={`/poets?genre=${item.id}${periodId ? `&periodId=${periodId}` : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.resultBar}>
          <p>
            {q ? <>关键词「{q}」 · </> : null}
            {activePeriod ? `${activePeriod.name} · ` : ''}
            {genre ? `${genre === 'ci' ? '词' : genre === 'qu' ? '曲' : '诗'} · ` : ''}共{' '}
            {poets.length} 位诗人
          </p>
          {filterActive ? (
            <Link className={styles.clear} href="/poets">
              清除筛选
            </Link>
          ) : null}
        </div>

        {poets.length === 0 ? (
          <div className={styles.empty}>
            <p>没有找到符合条件的诗人。</p>
            <p>可以尝试更换关键词，或清除时期、体裁筛选。</p>
            <Link href="/poets">返回全部名录</Link>
          </div>
        ) : (
          <div className={styles.groups}>
            {[...groups.entries()].map(([groupId, list]) => {
              const period = periodById.get(groupId);
              return (
                <section
                  key={groupId}
                  className={styles.group}
                  aria-labelledby={`group-${groupId}`}
                >
                  <header className={styles.groupHead}>
                    <h2 id={`group-${groupId}`}>{period?.name ?? '年代待考'}</h2>
                    <p>
                      {period ? formatPeriodRange(period) : '生卒与活动年代均待考'}
                      <span> · {list.length} 位</span>
                    </p>
                  </header>
                  <ul className={styles.grid}>
                    {list.map((poet) => (
                      <li key={poet.id}>
                        <Link className={styles.card} href={`/poets/${poet.id}`}>
                          <span className={styles.cardInitial} aria-hidden="true">
                            {poet.initial}
                          </span>
                          <span className={styles.cardBody}>
                            <span className={styles.cardName}>{poet.name}</span>
                            <span className={styles.cardMeta}>
                              {poet.dynastyLabel} · {poet.dateDisplay}
                            </span>
                            <span className={styles.cardCount}>
                              {poet.publishedWorkCount} 首收录作品
                            </span>
                          </span>
                          <span className={styles.cardArrow} aria-hidden="true">
                            ↗
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <p className={styles.dataNote}>
          名录收录为 Phase 0–2 工程验证样本（{SITE_NAME} 数据版本 {stats.dataVersion}），
          不代表中国历代诗人总量，也不是「全部传世作品」；作品数量仅统计已发布且可打开全文的收录作品。
        </p>

        <SiteFooter />
      </main>
    </>
  );
}
