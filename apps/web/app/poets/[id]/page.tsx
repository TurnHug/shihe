import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SITE_NAME } from '@shihe/domain';
import { getPoetDetail, getPoetRelations, listPoetWorks } from '@shihe/db/server';
import type { PoetRelation } from '@shihe/domain';

import { PageHeader, SiteFooter, StaticBackdrop } from '@/components/common/PageChrome';
import { PoetWorksCatalog } from '@/components/poet/PoetWorksCatalog';
import { formatDateWithDynasty } from '@/lib/format';

import styles from './page.module.css';

export const dynamic = 'force-dynamic';

interface PoetPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PoetPageProps): Promise<Metadata> {
  const { id } = await params;
  const poet = await getPoetDetail(id);
  if (!poet) {
    return { title: '诗人未找到' };
  }
  const title = `${poet.name}（${poet.dynastyLabel} · ${poet.dateDisplay}）`;
  const description = `${poet.name}：${poet.bioShort} 已收录 ${poet.publishedWorkCount} 首作品。`;
  return {
    title,
    description,
    alternates: { canonical: `/poets/${poet.id}` },
    robots:
      poet.dataTier === 'imported' ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title: `${title}｜${SITE_NAME}`, description },
  };
}

export default async function PoetPage({ params }: PoetPageProps) {
  const { id } = await params;
  const [poet, works, relations] = await Promise.all([
    getPoetDetail(id),
    listPoetWorks(id, { limit: 30 }),
    getPoetRelations(id),
  ]);
  if (!poet) notFound();

  const skyHref = `/?mode=river&poet=${encodeURIComponent(poet.id)}`;

  return (
    <>
      <StaticBackdrop />
      <PageHeader current="poets" />
      <main id="main-content" className={styles.page}>
        <nav className={styles.breadcrumb} aria-label="面包屑">
          <Link href="/poets">诗人名录</Link>
          <span aria-hidden="true">/</span>
          <span>{poet.dynastyLabel}</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{poet.name}</span>
        </nav>

        {poet.dataTier === 'imported' ? (
          <div className={styles.corpusNotice} role="note">
            <strong>批量导入作者 · 待校核</strong>
            <span>
              本作者由开放语料自动归并，生平、年代与作品归属尚未逐条复核，
              因此不进入交互星图；站内按朝代提供档案访问。
            </span>
            <Link href="/library">数据说明</Link>
          </div>
        ) : null}

        <div className={styles.layout}>
          <aside className={styles.profile} aria-label={`${poet.name} 资料`}>
            <p className={styles.overline}>
              {poet.dataTier === 'imported' ? 'CORPUS ARCHIVE' : 'A STAR IN THE HISTORY'}
            </p>
            <h1 className={styles.name}>{poet.name}</h1>
            <p className={styles.dates}>
              {formatDateWithDynasty(poet.dynastyLabel, poet.dateDisplay)}
              {poet.datePrecision !== 'exact' ? (
                <span className={styles.approx}>年代约略</span>
              ) : null}
            </p>

            <div className={styles.portrait} aria-hidden="true">
              <span className={styles.initial}>{poet.initial}</span>
              <span className={styles.portraitLabel}>星火不息 · 文脉千年</span>
            </div>

            <dl className={styles.meta}>
              <div>
                <dt>历史归属</dt>
                <dd>{poet.periodName || poet.dynastyLabel}</dd>
              </div>
              <div>
                <dt>已收录作品</dt>
                <dd>{poet.publishedWorkCount} 首</dd>
              </div>
              <div>
                <dt>体裁</dt>
                <dd>
                  {poet.genres.length > 0 ? poet.genres.map(genreLabel).join(' · ') : '待整理'}
                </dd>
              </div>
              <div>
                <dt>年代可信度</dt>
                <dd>{precisionLabel(poet.datePrecision)}</dd>
              </div>
            </dl>

            <p className={styles.bio}>{poet.bioShort}</p>

            {poet.aliases.length > 0 ? (
              <p className={styles.aliases}>
                {poet.aliases
                  .map((alias) => `${aliasLabel(alias.aliasType)} ${alias.alias}`)
                  .join(' · ')}
              </p>
            ) : null}

            {poet.periods.length > 1 ? (
              <p className={styles.memberships}>
                相关时期：
                {poet.periods
                  .map(
                    (period) => `${period.periodName}（${membershipLabel(period.membershipType)}）`,
                  )
                  .join('、')}
              </p>
            ) : null}

            {poet.skyVisible ? (
              <Link className={styles.skyLink} href={skyHref}>
                在历史星河中定位这颗星辰 →
              </Link>
            ) : (
              <Link className={styles.skyLink} href="/library">
                该作者来自批量语料，查看全库说明 →
              </Link>
            )}
          </aside>

          <section className={styles.catalog} aria-label={`${poet.name} 作品目录与人物关系`}>
            <div className={styles.catalogRelations}>
              {' '}
              <section className={styles.relationsSection} aria-labelledby="poet-relations">
                <header className={styles.relationsHeader}>
                  <p className={styles.catalogOverline}>RELATIONS</p>
                  <h2 id="poet-relations" className={styles.relationsTitle}>
                    人物关系
                  </h2>
                </header>

                {relations.length === 0 ? (
                  <p className={styles.relationsEmpty}>
                    该诗人的关系资料尚在审核整理中。我们不会为了视觉效果展示未经证实的人物关系。
                  </p>
                ) : (
                  <ul className={styles.relationGrid}>
                    {relations.map((relation) => (
                      <li key={relation.id} className={styles.relationCard}>
                        <div className={styles.relationCardHead}>
                          <Link
                            className={styles.relationCounterpart}
                            href={`/poets/${counterpartId(relation, poet.id)}`}
                          >
                            {counterpartName(relation, poet.id)}
                          </Link>
                          <span className={styles.relationChip}>
                            {relationTypeLabel(relation.relationType)}
                          </span>
                          <span className={styles.relationConfidence}>
                            {relation.confidence === 'high' ? '史料确证' : '文学史归类'}
                          </span>
                        </div>
                        <p className={styles.relationEvidence}>{relation.evidence}</p>
                        <p className={styles.relationSource}>来源：{relation.source.title}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <header className={styles.catalogHead}>
              <div>
                <p className={styles.catalogOverline}>WORKS</p>
                <h2 className={styles.catalogTitle}>作品目录</h2>
              </div>
              <p className={styles.catalogMeta}>
                共 {poet.publishedWorkCount} 首已发布作品
              </p>
            </header>

            <PoetWorksCatalog
              poetId={poet.id}
              poetName={poet.name}
              initialWorks={works.data}
              initialTotal={works.meta.total}
              initialCursor={works.meta.nextCursor}
              genres={poet.genres}
            />
          </section>
        </div>

        <SiteFooter />
      </main>
    </>
  );
}

function genreLabel(genre: string): string {
  if (genre === 'ci') return '词';
  if (genre === 'qu') return '曲';
  return '诗';
}

function precisionLabel(precision: string): string {
  switch (precision) {
    case 'exact':
      return '确切';
    case 'approx':
      return '约略';
    case 'period':
      return '仅知时期';
    default:
      return '年代待考';
  }
}

function counterpartId(relation: PoetRelation, poetId: string): string {
  return relation.poetAId === poetId ? relation.poetBId : relation.poetAId;
}

function counterpartName(relation: PoetRelation, poetId: string): string {
  return relation.poetAId === poetId ? relation.poetBName : relation.poetAName;
}

function relationTypeLabel(type: PoetRelation['relationType']): string {
  switch (type) {
    case 'friendship':
      return '交游';
    case 'teacher_student':
      return '师承';
    case 'literary_influence':
      return '文学影响';
    case 'association':
      return '文学社群/并称';
    case 'kinship':
      return '亲属';
    default:
      return '关系';
  }
}

function membershipLabel(type: string): string {
  if (type === 'secondary') return '次要关联';
  if (type === 'transition') return '跨时代';
  return '主要归属';
}

function aliasLabel(type: string): string {
  switch (type) {
    case 'courtesy':
      return '字';
    case 'art_name':
      return '号';
    case 'variant':
      return '异体';
    default:
      return '别名';
  }
}
