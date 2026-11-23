'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Genre, PoetRelation, SkyManifest, SkyMode, StarPoint } from '@shihe/domain';

import { fetchSkyTile } from '@/lib/api/client';
import type { CameraState, FocusRequest } from '@/lib/stores/skyStore';

import { SkyEngine, type SkyLabelLayout, type SkyRealmLabel } from './sky-engine';
import styles from './SkyStage.module.css';

interface SkyStageProps {
  manifest: SkyManifest;
  mode: SkyMode;
  selectedPoetId: string | null;
  genreFilter: Genre | null;
  relationsEnabled: boolean;
  relations: PoetRelation[];
  focusRequest: FocusRequest | null;
  onSelectPoet(poetId: string | null): void;
  onCamera(camera: CameraState): void;
  onReady?(): void;
}

interface HoverState {
  star: StarPoint;
  x: number;
  y: number;
}

export function SkyStage({
  manifest,
  mode,
  selectedPoetId,
  genreFilter,
  relationsEnabled,
  relations,
  focusRequest,
  onSelectPoet,
  onCamera,
  onReady,
}: SkyStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SkyEngine | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [labels, setLabels] = useState<SkyLabelLayout[]>([]);
  const [realmLabels, setRealmLabels] = useState<SkyRealmLabel[]>([]);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelectPoet);
  onSelectRef.current = onSelectPoet;
  const onCameraRef = useRef(onCamera);
  onCameraRef.current = onCamera;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const engine = new SkyEngine({
      host,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onSelect: (poetId) => onSelectRef.current(poetId),
      onHover: (star, screen) => {
        setHover(star && screen ? { star, ...screen } : null);
      },
      onLabels: setLabels,
      onRealmLabels: setRealmLabels,
      onCamera: (camera) => onCameraRef.current(camera),
      onReady: () => {
        if (process.env.NODE_ENV !== 'production') {
          (window as unknown as Record<string, unknown>).__shiheSky = engine;
        }
        setReady(true);
        onReadyRef.current?.();
      },
      onError: (message) => setError(message),
    });
    engineRef.current = engine;
    void engine.init(manifest, modeRef.current);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // manifest/layout 只在首屏注入一次；切换模式由下面的 effect 处理。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !ready) return;
    engine.setMode(manifest, mode);
  }, [manifest, mode, ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    fetchSkyTile({ mode, z: 0, x: 0, y: 0 })
      .then((tile) => {
        if (cancelled) return;
        engineRef.current?.setStars(tile.stars);
        setLoading(false);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        console.error('[sky] 星辰数据加载失败', fetchError);
        setError('星辰数据加载失败，请检查网络后重试。');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, ready]);

  useEffect(() => {
    engineRef.current?.setSelected(selectedPoetId);
  }, [selectedPoetId, ready]);

  useEffect(() => {
    engineRef.current?.setGenreFilter(genreFilter);
  }, [genreFilter, ready]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!relationsEnabled || !selectedPoetId) {
      engine.setRelations([]);
      return;
    }
    engine.setRelations(
      relations.map((relation) => ({
        poetId: relation.poetAId === selectedPoetId ? relation.poetBId : relation.poetAId,
        relationType: relation.relationType,
      })),
    );
  }, [relationsEnabled, relations, selectedPoetId, ready]);

  useEffect(() => {
    if (!focusRequest) return;
    engineRef.current?.focus(focusRequest);
  }, [focusRequest, ready]);

  const handleLabelSelect = useCallback((poetId: string) => {
    onSelectRef.current(poetId);
  }, []);

  return (
    <div className={styles.stage} data-mode={mode}>
      <div ref={hostRef} className={styles.canvasHost} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.landscape} aria-hidden="true">
        <svg viewBox="0 0 1500 300" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="mountainFill" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#253c5c" />
              <stop offset="1" stopColor="#091529" />
            </linearGradient>
            <linearGradient id="lakeFill" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#182d48" />
              <stop offset="1" stopColor="#071326" />
            </linearGradient>
          </defs>
          <path
            d="M0 165L68 139L102 149L173 92L220 140L272 103L304 128L360 84L408 133L454 107L506 154L577 97L625 135L689 94L752 154L797 116L868 151L941 97L984 139L1046 125L1127 57L1192 116L1258 91L1328 144L1412 106L1500 149V300H0Z"
            fill="url(#mountainFill)"
            opacity="0.56"
          />
          <path
            d="M0 212L100 196L165 214L250 160L330 214L420 182L498 217L584 174L651 219L765 184L852 205L945 181L1030 214L1140 167L1220 210L1320 185L1500 217V300H0Z"
            fill="#0a1b30"
            opacity="0.72"
          />
          <path
            d="M0 254Q210 222 426 250T855 249T1500 248V300H0Z"
            fill="url(#lakeFill)"
            opacity="0.8"
          />
          <path
            d="M0 276Q90 270 190 279T412 273T643 278T937 272T1246 277T1500 273"
            fill="none"
            stroke="#c5b08f"
            opacity="0.09"
            strokeWidth="2"
          />
        </svg>
      </div>

      <div className={styles.realmLayer} aria-hidden="true">
        {realmLabels.map((label) => (
          <div
            key={label.realmId}
            className={`${styles.realmLabel} ${label.kind === 'period' ? styles.periodLabel : ''}`}
            style={{
              transform: `translate3d(${label.x}px, ${label.y}px, 0) translate(-50%, -100%)`,
            }}
          >
            <strong>{label.name}</strong>
            <small>{label.subtitle}</small>
          </div>
        ))}
      </div>

      <div className={styles.labelLayer} aria-live="off">
        {labels.map((label) => (
          <button
            key={label.poetId}
            type="button"
            className={[
              styles.starLabel,
              label.active ? styles.starLabelActive : '',
              label.related ? styles.starLabelRelated : '',
              label.dimmed ? styles.starLabelDimmed : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              transform: `translate3d(${label.x}px, ${label.y}px, 0) translate(-50%, -100%)`,
            }}
            onClick={() => handleLabelSelect(label.poetId)}
            aria-label={`查看诗人 ${label.name}`}
            data-poet-id={label.poetId}
          >
            {label.name}
          </button>
        ))}
      </div>

      {hover ? (
        <div
          className={styles.tooltip}
          style={{ transform: `translate3d(${hover.x}px, ${hover.y}px, 0)` }}
          aria-hidden="true"
        >
          <span className={styles.tooltipName}>{hover.star.name}</span>
          <span className={styles.tooltipMeta}>
            {hover.star.dateDisplay} · 收录 {hover.star.publishedWorkCount} 首
          </span>
        </div>
      ) : null}

      <div className={styles.hint} aria-hidden="true">
        <span>拖动平移</span>
        <i />
        <span>滚轮 / 双指缩放</span>
        <i />
        <span>点击星辰查看诗人</span>
      </div>

      {loading && !error ? (
        <div className={styles.loading} role="status">
          星图载入中…
        </div>
      ) : null}

      {error ? (
        <div className={styles.fallback} role="alert">
          <p className={styles.fallbackTitle}>星图暂不可用</p>
          <p className={styles.fallbackText}>{error}</p>
          <div className={styles.fallbackActions}>
            <Link href="/poets">浏览诗人名录</Link>
            <Link href="/search?q=%E6%98%8E%E6%9C%88">搜索作品</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
