'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PoetSummary, SearchResultGroups, WorkSummary } from '@shihe/domain';

import { searchApi } from '@/lib/api/client';

import styles from './SearchOverlay.module.css';

interface SearchOverlayProps {
  open: boolean;
  onClose(): void;
  onSelectPoet(poetId: string): void;
}

const SUGGESTIONS = ['李白', '杜甫', '苏轼', '李清照', '静夜思', '明月'];

type FlatResult = { kind: 'poet'; poet: PoetSummary } | { kind: 'work'; work: WorkSummary };

export function SearchOverlay({ open, onClose, onSelectPoet }: SearchOverlayProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultGroups | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(-1);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      searchApi({ q: trimmed, limit: 20 })
        .then((response) => {
          if (cancelled) return;
          setResults(response);
          setLoading(false);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (cancelled) return;
          setError('搜索请求失败，请稍后重试。');
          setLoading(false);
        });
    }, 230);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const flat = useMemo<FlatResult[]>(() => {
    if (!results) return [];
    return [
      ...results.poets.map((poet) => ({ kind: 'poet' as const, poet })),
      ...results.works.map((work) => ({ kind: 'work' as const, work })),
    ];
  }, [results]);

  const choose = useCallback(
    (item: FlatResult) => {
      onClose();
      setQuery('');
      if (item.kind === 'poet') {
        onSelectPoet(item.poet.id);
      } else {
        router.push(`/works/${item.work.id}`);
      }
    },
    [onClose, onSelectPoet, router],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, flat.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && flat[activeIndex]) {
        event.preventDefault();
        choose(flat[activeIndex]);
      }
    }
  };

  if (!open) return null;

  const hasQuery = query.trim().length > 0;

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="全站搜索">
        <div className={styles.head}>
          <h2 className={styles.title}>寻一位诗人，或一首诗。</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="关闭搜索">
            ×
          </button>
        </div>

        <div className={styles.inputWrap}>
          <span className={styles.magnify} aria-hidden="true">
            ⌕
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="试试：李白、静夜思、明月……"
            aria-label="搜索诗人姓名、标题或诗句"
            autoComplete="off"
            spellCheck={false}
            data-testid="search-input"
          />
          {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
        </div>

        {!hasQuery ? (
          <>
            <p className={styles.caption}>热门诗人 · 可直接定位</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={styles.suggestion}
                  onClick={() => setQuery(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <p className={styles.tip}>
              支持诗人姓名、字号别名、作品标题与全文句子片段。检索同时覆盖人工校核星图与全库导入语料，
              带「全库」标记的内容为待校核文本；
              <Link className={styles.libraryLink} href="/library">
                查看数据说明
              </Link>
              。
            </p>
          </>
        ) : null}

        {hasQuery && error ? (
          <div className={styles.state} role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setQuery((value) => `${value} `)}>
              重试
            </button>
          </div>
        ) : null}

        {hasQuery && !error && results && results.total === 0 && !loading ? (
          <div className={styles.state}>
            <p>没有找到与「{results.query}」相关的诗人或作品。</p>
            <p className={styles.stateHint}>可尝试更短的关键词，或换用作者字号、作品标题。</p>
          </div>
        ) : null}

        {hasQuery && results && results.total > 0 ? (
          <div className={styles.results} data-testid="search-results">
            {results.poets.length > 0 ? (
              <section aria-label="诗人结果">
                <p className={styles.caption}>诗人 · {results.poets.length}</p>
                {results.poets.map((poet, index) => {
                  const flatIndex = index;
                  return (
                    <button
                      key={poet.id}
                      type="button"
                      className={`${styles.hit} ${activeIndex === flatIndex ? styles.hitActive : ''}`}
                      onClick={() => choose({ kind: 'poet', poet })}
                    >
                      <span className={styles.hitName}>{poet.name}</span>
                      {poet.dataTier === 'imported' ? (
                        <span className={styles.tierBadge}>全库</span>
                      ) : null}
                      <span className={styles.hitMeta}>
                        {[poet.dynastyLabel, poet.dateDisplay, `${poet.publishedWorkCount} 首`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className={styles.hitArrow} aria-hidden="true">
                        ↗
                      </span>
                    </button>
                  );
                })}
              </section>
            ) : null}

            {results.works.length > 0 ? (
              <section aria-label="作品结果">
                <p className={styles.caption}>作品 · {results.works.length}</p>
                {results.works.map((work, index) => {
                  const flatIndex = results.poets.length + index;
                  return (
                    <button
                      key={work.id}
                      type="button"
                      className={`${styles.hit} ${activeIndex === flatIndex ? styles.hitActive : ''}`}
                      onClick={() => choose({ kind: 'work', work })}
                    >
                      <span className={styles.hitName}>{work.title}</span>
                      {work.dataTier === 'imported' ? (
                        <span className={styles.tierBadge}>全库</span>
                      ) : null}
                      <span className={styles.hitMeta}>
                        {work.poetName} · {genreLabel(work.genre)}
                        {work.featured ? ' · 代表作' : ''}
                      </span>
                      <span className={styles.hitArrow} aria-hidden="true">
                        ↗
                      </span>
                    </button>
                  );
                })}
              </section>
            ) : null}

            <Link
              className={styles.fullSearch}
              href={`/search?q=${encodeURIComponent(query.trim())}`}
              onClick={onClose}
            >
              在搜索结果页查看「{query.trim()}」→
            </Link>
            <p className={styles.scopeNote}>「全库」标记 = 批量导入语料，尚未逐条校核。</p>
          </div>
        ) : null}

        <div className={styles.hintRow}>
          <span>↑ ↓ 选择</span>
          <span>Enter 打开</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}

function genreLabel(genre: string): string {
  if (genre === 'ci') return '词';
  if (genre === 'qu') return '曲';
  return '诗';
}
