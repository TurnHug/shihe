'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { isGenre, isSkyMode } from '@shihe/domain';
import type { Genre, PoetRelation, SkyManifest, SkyMode } from '@shihe/domain';

import { SkyStage } from '@/components/sky/SkyStage';
import { Timeline } from '@/components/timeline/Timeline';
import { PoetDrawer } from '@/components/poet/PoetDrawer';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { fetchPoetRelations } from '@/lib/api/client';
import { withBasePath } from '@/lib/base-path';
import { useSkyStore } from '@/lib/stores/skyStore';

import { HeroIntro } from './HeroIntro';
import { LeftGuide } from './LeftGuide';
import { RightTeaser } from './RightTeaser';
import { TopNav } from './TopNav';
import styles from './HomeExperience.module.css';

interface HomeExperienceProps {
  manifest: SkyManifest;
  initialMode: SkyMode;
  initialPoetId: string | null;
  initialGenre: Genre | null;
  initialRelations: boolean;
}

function buildUrl(
  mode: SkyMode,
  poetId: string | null,
  genre: Genre | null,
  relationsEnabled: boolean,
): string {
  const params = new URLSearchParams({ mode });
  if (poetId) params.set('poet', poetId);
  if (genre) params.set('genre', genre);
  if (!relationsEnabled) params.set('relations', '0');
  return withBasePath(`/?${params.toString()}`);
}

export function HomeExperience({
  manifest,
  initialMode,
  initialPoetId,
  initialGenre,
  initialRelations,
}: HomeExperienceProps) {
  const mode = useSkyStore((state) => state.mode);
  const selectedPoetId = useSkyStore((state) => state.selectedPoetId);
  const drawerOpen = useSkyStore((state) => state.drawerOpen);
  const searchOpen = useSkyStore((state) => state.searchOpen);
  const activePeriodId = useSkyStore((state) => state.activePeriodId);
  const genre = useSkyStore((state) => state.filters.genre);
  const relationsEnabled = useSkyStore((state) =>
    state.initialized ? state.relationsEnabled : initialRelations,
  );
  const focusRequest = useSkyStore((state) => state.focusRequest);
  const initialized = useSkyStore((state) => state.initialized);
  const [relations, setRelations] = useState<PoetRelation[]>([]);
  const [relationsState, setRelationsState] = useState<
    'idle' | 'loading' | 'ready' | 'empty' | 'error'
  >('idle');
  const mounted = useRef(false);

  useEffect(() => {
    useSkyStore.getState().initialize({
      mode: initialMode,
      selectedPoetId: initialPoetId,
      manifest,
      relationsEnabled: initialRelations,
    });
    useSkyStore.getState().setFilters({ genre: initialGenre });
    if (initialPoetId) {
      useSkyStore.getState().requestFocus(initialMode, {
        kind: 'poet',
        poetId: initialPoetId,
        zoom: 2.2,
      });
    }
    mounted.current = true;
  }, [initialMode, initialPoetId, initialGenre, initialRelations, manifest]);

  // 选中作者后按需加载已审核的关系。
  useEffect(() => {
    if (!relationsEnabled || !selectedPoetId) {
      setRelations([]);
      setRelationsState('idle');
      return;
    }
    let cancelled = false;
    setRelationsState('loading');
    fetchPoetRelations(selectedPoetId)
      .then((response) => {
        if (cancelled) return;
        setRelations(response.relations);
        setRelationsState(response.relations.length > 0 ? 'ready' : 'empty');
      })
      .catch(() => {
        if (cancelled) return;
        setRelations([]);
        setRelationsState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [relationsEnabled, selectedPoetId]);

  const openPoet = useCallback(
    (poetId: string | null) => {
      const currentGenre = useSkyStore.getState().filters.genre;
      const currentRelations = useSkyStore.getState().relationsEnabled;
      if (poetId) {
        useSkyStore.getState().selectPoet(poetId);
        useSkyStore.getState().requestFocus(mode, { kind: 'poet', poetId, zoom: 2.2 });
        window.history.pushState(
          { poet: poetId },
          '',
          buildUrl(mode, poetId, currentGenre, currentRelations),
        );
      } else {
        useSkyStore.getState().closeDrawer();
        window.history.pushState({}, '', buildUrl(mode, null, currentGenre, currentRelations));
      }
    },
    [mode],
  );

  const closeDrawer = useCallback(() => {
    useSkyStore.getState().closeDrawer();
    window.history.replaceState(
      {},
      '',
      buildUrl(
        useSkyStore.getState().mode,
        null,
        useSkyStore.getState().filters.genre,
        useSkyStore.getState().relationsEnabled,
      ),
    );
  }, []);

  const changeMode = useCallback((nextMode: SkyMode) => {
    if (nextMode === useSkyStore.getState().mode) return;
    useSkyStore.getState().setMode(nextMode);
    useSkyStore.getState().requestFocus(
      nextMode,
      useSkyStore.getState().selectedPoetId
        ? {
            kind: 'poet',
            poetId: useSkyStore.getState().selectedPoetId as string,
            zoom: 1.8,
          }
        : { kind: 'fit' },
    );
    window.history.replaceState(
      {},
      '',
      buildUrl(
        nextMode,
        useSkyStore.getState().selectedPoetId,
        useSkyStore.getState().filters.genre,
        useSkyStore.getState().relationsEnabled,
      ),
    );
  }, []);

  const openSearch = useCallback(() => {
    useSkyStore.getState().setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    useSkyStore.getState().setSearchOpen(false);
  }, []);

  const handlePeriodSelect = useCallback((periodId: string) => {
    const store = useSkyStore.getState();
    store.setActivePeriod(periodId);
    if (store.mode === 'galaxy') {
      store.requestFocus('galaxy', { kind: 'realm', realmId: periodId });
    } else {
      store.requestFocus('river', { kind: 'period', periodId });
    }
  }, []);

  const resetView = useCallback(() => {
    const store = useSkyStore.getState();
    store.closeDrawer();
    useSkyStore.setState({ selectedPoetId: null });
    store.setActivePeriod(null);
    store.requestFocus(store.mode, { kind: 'fit' });
    window.history.replaceState(
      {},
      '',
      buildUrl(store.mode, null, store.filters.genre, store.relationsEnabled),
    );
  }, []);

  const changeGenre = useCallback((nextGenre: Genre | null) => {
    const store = useSkyStore.getState();
    store.setFilters({ genre: nextGenre });
    window.history.replaceState(
      {},
      '',
      buildUrl(store.mode, store.selectedPoetId, nextGenre, store.relationsEnabled),
    );
  }, []);

  const handleCamera = useCallback((camera: { x: number; y: number; zoom: number }) => {
    useSkyStore.getState().setCamera(useSkyStore.getState().mode, camera);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
      if (event.key === 'Escape') {
        useSkyStore.getState().setSearchOpen(false);
        useSkyStore.getState().closeDrawer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openSearch]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      const poet = params.get('poet');
      const rawGenre = params.get('genre');
      const relationsParam = params.get('relations');
      const store = useSkyStore.getState();
      store.setFilters({ genre: isGenre(rawGenre) ? rawGenre : null });
      useSkyStore.setState({ relationsEnabled: relationsParam !== '0' });
      const nextMode = isSkyMode(modeParam) ? modeParam : store.mode;
      if (nextMode !== store.mode) store.setMode(nextMode);
      if (poet) {
        store.selectPoet(poet);
        store.requestFocus(nextMode, { kind: 'poet', poetId: poet, zoom: 2.2 });
      } else {
        store.closeDrawer();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const toggleRelations = useCallback(() => {
    const store = useSkyStore.getState();
    const next = !store.relationsEnabled;
    useSkyStore.setState({ relationsEnabled: next });
    if (!next) setRelations([]);
    window.history.replaceState(
      {},
      '',
      buildUrl(store.mode, store.selectedPoetId, store.filters.genre, next),
    );
  }, []);

  const selectRelatedPoet = useCallback(
    (poetId: string) => {
      openPoet(poetId);
    },
    [openPoet],
  );

  const heroVisible = mode === 'river' && !drawerOpen && !searchOpen && activePeriodId == null;
  const activeTimelineId = activePeriodId ?? (mode === 'river' ? 'sui-tang' : 'realm-sui-tang');

  return (
    <main id="main-content" className={styles.app}>
      {initialized ? (
        <SkyStage
          manifest={manifest}
          mode={mode}
          selectedPoetId={selectedPoetId}
          genreFilter={genre}
          relationsEnabled={relationsEnabled}
          relations={relations}
          focusRequest={focusRequest}
          onSelectPoet={openPoet}
          onCamera={handleCamera}
        />
      ) : (
        <div className={styles.skyPlaceholder} aria-hidden="true" />
      )}

      <TopNav
        mode={mode}
        onModeChange={changeMode}
        onOpenSearch={openSearch}
        onResetView={resetView}
        relationsEnabled={relationsEnabled}
        onToggleRelations={toggleRelations}
      />

      <HeroIntro visible={heroVisible} />

      <LeftGuide />

      <RightTeaser
        visible={mode === 'river' && !drawerOpen && !searchOpen && activePeriodId == null}
      />

      <Timeline
        mode={mode}
        periods={manifest.periods}
        riverBounds={manifest.modes.river}
        realms={manifest.realms}
        activePeriodId={activeTimelineId}
        onSelectPeriod={handlePeriodSelect}
        onReset={resetView}
        genre={genre}
        onGenreChange={changeGenre}
      />

      <PoetDrawer
        poetId={selectedPoetId}
        open={drawerOpen}
        onClose={closeDrawer}
        relations={relations}
        relationsEnabled={relationsEnabled}
        relationsState={relationsState}
        onSelectPoet={selectRelatedPoet}
      />

      {relationsEnabled ? (
        <div
          className={styles.relationNote}
          role="status"
          data-testid="relation-note"
          data-state={relationsState}
        >
          {!selectedPoetId
            ? '先选择一颗星辰，再查看有史料依据的人物关系。'
            : relationsState === 'loading'
              ? '正在加载关系数据…'
              : relationsState === 'ready'
                ? `交游关系示意 · ${relations.length} 条 · 连线均以史料来源核实，可在诗详情中查看依据`
                : relationsState === 'empty'
                  ? '该诗人的关系资料尚在审核整理中，暂不展示未经证实的关系。'
                  : relationsState === 'error'
                    ? '关系数据加载失败，请稍后再试。'
                    : '关系模式已开启。'}
        </div>
      ) : null}

      <SearchOverlay open={searchOpen} onClose={closeSearch} onSelectPoet={openPoet} />
    </main>
  );
}
