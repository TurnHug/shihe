'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Genre, WorkSummary } from '@shihe/domain';

import { fetchPoetWorks } from '@/lib/api/client';

import styles from './PoetWorksCatalog.module.css';

interface PoetWorksCatalogProps {
  poetId: string;
  poetName: string;
  initialWorks: WorkSummary[];
  initialTotal: number;
  initialCursor: string | null;
  genres: Genre[];
}

const GENRE_OPTIONS: { id: Genre | null; label: string }[] = [
  { id: null, label: '全部' },
  { id: 'shi', label: '诗' },
  { id: 'ci', label: '词' },
  { id: 'qu', label: '曲' },
];

export function PoetWorksCatalog({
  poetId,
  poetName,
  initialWorks,
  initialTotal,
  initialCursor,
  genres,
}: PoetWorksCatalogProps) {
  const [works, setWorks] = useState<WorkSummary[]>(initialWorks);
  const [total, setTotal] = useState(initialTotal);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [genre, setGenre] = useState<Genre | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const firstRender = useRef(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadFirstPage = useCallback(
    async (nextGenre: Genre | null, nextQuery: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchPoetWorks(poetId, {
          limit: 30,
          genre: nextGenre ?? undefined,
          q: nextQuery || undefined,
        });
        setWorks(response.data);
        setTotal(response.meta.total);
        setCursor(response.meta.nextCursor);
        setPage(1);
      } catch {
        setError('作品目录加载失败，请稍后再试。');
      } finally {
        setLoading(false);
      }
    },
    [poetId],
  );

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void loadFirstPage(genre, debouncedQuery);
  }, [genre, debouncedQuery, loadFirstPage]);

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPoetWorks(poetId, {
        limit: 30,
        cursor,
        genre: genre ?? undefined,
        q: debouncedQuery || undefined,
      });
      setWorks((current) => [...current, ...response.data]);
      setCursor(response.meta.nextCursor);
      setPage((current) => current + 1);
    } catch {
      setError('更多作品加载失败，请稍后再试。');
    } finally {
      setLoading(false);
    }
  };

  const availableGenres = GENRE_OPTIONS.filter(
    (option) => option.id === null || genres.includes(option.id),
  );

  return (
    <div className={styles.catalog}>
      <div className={styles.toolbar}>
        <div className={styles.genres} role="group" aria-label="按体裁筛选">
          {availableGenres.map((option) => (
            <button
              key={option.id ?? 'all'}
              type="button"
              className={`${styles.genre} ${genre === option.id ? styles.genreActive : ''}`}
              onClick={() => setGenre(option.id)}
              aria-pressed={genre === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <span className={styles.searchIcon} aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`在${poetName}作品中检索标题或诗句`}
            aria-label={`检索${poetName}的作品`}
          />
        </label>
      </div>

      <p className={styles.count} role="status">
        {loading ? '检索中…' : `已显示 ${works.length} / 共 ${total} 首可阅读作品 · 第 ${page} 页`}
        {debouncedQuery ? ` · 关键词「${debouncedQuery}」` : ''}
      </p>

      {error ? (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadFirstPage(genre, debouncedQuery)}>
            重试
          </button>
        </div>
      ) : null}

      {!loading && works.length === 0 && !error ? (
        <div className={styles.empty}>
          <p>没有找到匹配的作品。</p>
          <p>可尝试更短的关键词，或切换体裁筛选。</p>
        </div>
      ) : null}

      <ul className={styles.list}>
        {works.map((work) => (
          <li key={work.id}>
            <Link className={styles.row} href={`/works/${work.id}`}>
              <span className={styles.rowMain}>
                <span className={styles.title}>
                  <span className={styles.titleText}>{work.title}</span>
                  {work.featured ? <span className={styles.featured}>代表作</span> : null}
                </span>
                <span className={styles.excerpt}>{work.excerpt}</span>
              </span>
              <span className={styles.rowMeta}>
                {work.genre === 'ci' ? '词' : work.genre === 'qu' ? '曲' : '诗'}
              </span>
              <span className={styles.arrow} aria-hidden="true">
                ↗
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {cursor ? (
        <button
          type="button"
          className={styles.more}
          onClick={() => void loadMore()}
          disabled={loading}
        >
          {loading ? '加载中…' : '加载更多作品'}
        </button>
      ) : null}
    </div>
  );
}
