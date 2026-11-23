'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { PoetDetail, PoetRelation, WorkSummary } from '@shihe/domain';

import { fetchPoet, fetchPoetWorks } from '@/lib/api/client';

import styles from './PoetDrawer.module.css';

interface PoetDrawerProps {
  poetId: string | null;
  open: boolean;
  onClose(): void;
  relations: PoetRelation[];
  relationsEnabled: boolean;
  relationsState: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  onSelectPoet(poetId: string): void;
}

interface DrawerData {
  poet: PoetDetail;
  works: WorkSummary[];
  totalWorks: number;
}

export function PoetDrawer({
  poetId,
  open,
  onClose,
  relations,
  relationsEnabled,
  relationsState,
  onSelectPoet,
}: PoetDrawerProps) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    if (!open || !poetId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExpanded(false);
    Promise.all([fetchPoet(poetId), fetchPoetWorks(poetId, { limit: 8 })])
      .then(([poet, works]) => {
        if (cancelled) return;
        setData({ poet, works: works.data, totalWorks: works.meta.total });
        setLoading(false);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        console.error('[drawer] 诗人加载失败', fetchError);
        setError('诗人资料加载失败，请稍后再试。');
        setLoading(false);
        setRequestId((value) => value + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [open, poetId, requestId]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const poet = data?.poet ?? null;
  const works = data?.works ?? [];

  return (
    <aside
      className={`${styles.drawer} ${expanded ? styles.expanded : ''}`}
      role="dialog"
      aria-modal="false"
      aria-label={poet ? `诗人 ${poet.name} 详情` : '诗人详情'}
      data-testid="poet-drawer"
    >
      <div className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.overline}>
            {poet?.dataTier === 'imported' ? 'CORPUS ARCHIVE' : 'A STAR IN THE HISTORY'}
          </p>
          {poet ? (
            <h2 className={styles.name}>{poet.name}</h2>
          ) : (
            <div className={styles.nameSkeleton} aria-hidden="true" />
          )}
          {poet ? (
            <p className={styles.dates}>
              {poet.dynastyLabel} · {poet.dateDisplay}
              {poet.datePrecision !== 'exact' ? (
                <span className={styles.approx}>年代约略</span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className={styles.headActions}>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="关闭诗人详情"
          >
            ×
          </button>
        </div>
      </div>

      {loading && !poet ? (
        <div className={styles.loading} role="status">
          正在定位这颗星辰…
        </div>
      ) : null}

      {error ? (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRequestId((value) => value + 1)}>
            重试
          </button>
        </div>
      ) : null}

      {poet ? (
        <>
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
              <dd>{poet.genres.length > 0 ? poet.genres.map(genreLabel).join(' · ') : '待整理'}</dd>
            </div>
            <div>
              <dt>年代可信度</dt>
              <dd>{precisionLabel(poet.datePrecision)}</dd>
            </div>
          </dl>

          <p className={styles.bio}>{poet.bioShort}</p>

          {poet.aliases.length > 0 ? (
            <p className={styles.aliases}>
              字号别名：
              {poet.aliases.map((alias) => alias.alias).join(' · ')}
            </p>
          ) : null}

          <div className={styles.worksHead}>
            <b>作品目录</b>
            <span>{data?.totalWorks != null ? `${data.totalWorks} 首` : ''}</span>
          </div>

          <ul className={styles.worksList}>
            {works.map((work) => (
              <li key={work.id}>
                <Link className={styles.workRow} href={`/works/${work.id}`}>
                  <span className={styles.workTitle}>{work.title}</span>
                  <span className={styles.workMeta}>
                    {genreLabel(work.genre)}
                    {work.featured ? ' · 代表作' : ''}
                  </span>
                  <span className={styles.arrow} aria-hidden="true">
                    ↗
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {poet.publishedWorkCount > works.length ? (
            <Link className={styles.allWorks} href={`/poets/${poet.id}`}>
              查看全部 {poet.publishedWorkCount} 首作品 →
            </Link>
          ) : null}

          {relationsEnabled ? (
            <section className={styles.relations} aria-label="人物关系">
              <div className={styles.relationsHead}>
                <b>人物关系</b>
                <span>
                  {relationsState === 'ready'
                    ? `${relations.length} 条`
                    : relationsState === 'loading'
                      ? '加载中…'
                      : '—'}
                </span>
              </div>
              {relationsState === 'loading' ? (
                <p className={styles.relationsEmpty}>正在加载有史料依据的关系…</p>
              ) : null}
              {relationsState === 'empty' ? (
                <p className={styles.relationsEmpty}>
                  该诗人的关系资料尚在审核整理中，暂不展示未经证实的关系。
                </p>
              ) : null}
              {relationsState === 'error' ? (
                <p className={styles.relationsEmpty}>关系数据加载失败，请稍后再试。</p>
              ) : null}
              {relations.length > 0 ? (
                <ul className={styles.relationList}>
                  {relations.map((relation) => {
                    const counterpartId =
                      relation.poetAId === poet.id ? relation.poetBId : relation.poetAId;
                    const counterpartName =
                      relation.poetAId === poet.id ? relation.poetBName : relation.poetAName;
                    return (
                      <li key={relation.id} className={styles.relationItem}>
                        <button
                          type="button"
                          className={styles.relationTarget}
                          onClick={() => onSelectPoet(counterpartId)}
                        >
                          <span className={styles.relationName}>{counterpartName}</span>
                          <span className={styles.relationType}>
                            {relationTypeLabel(relation.relationType)}
                            {relation.direction !== 'undirected' ? ' · 有方向' : ''}
                            {relation.confidence === 'high' ? ' · 史料确证' : ' · 文学史归类'}
                          </span>
                          <span className={styles.relationArrow} aria-hidden="true">
                            ↗
                          </span>
                        </button>
                        <p className={styles.relationEvidence}>{relation.evidence}</p>
                        <p className={styles.relationSource}>
                          来源：{relation.source.title} · {relation.source.id}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <p className={styles.relationFootnote}>
                连线均须以史料来源核实；此处仅展示已审核的 {relations.length} 条关系。
              </p>
            </section>
          ) : (
            <p className={styles.relationHint}>
              开启关系模式可查看有史料依据的人物关系。
            </p>
          )}

          <p className={styles.foot}>
            本页作品数量仅统计已发布且可打开全文的收录作品，不代表作者传世作品总数。
          </p>

          <button
            type="button"
            className={styles.expandToggle}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? '收起详情' : '展开详情'}
          </button>
        </>
      ) : null}
    </aside>
  );
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
