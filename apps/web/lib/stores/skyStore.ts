'use client';

import { create } from 'zustand';

import type { Genre, SkyManifest, SkyMode } from '@shihe/domain';

export interface CameraState {
  /** 相机中心的世界坐标。 */
  x: number;
  y: number;
  zoom: number;
}

export type FocusTarget =
  | { kind: 'fit' }
  | { kind: 'year'; year: number; zoom?: number }
  | { kind: 'period'; periodId: string }
  | { kind: 'realm'; realmId: string }
  | { kind: 'poet'; poetId: string; zoom?: number };

export interface FocusRequest {
  id: number;
  mode: SkyMode;
  target: FocusTarget;
  /** 是否使用平滑动画（减少动效时直接跳转）。 */
  animate: boolean;
}

export interface SkyFilters {
  periodId: string | null;
  genre: Genre | null;
}

interface SkyState {
  mode: SkyMode;
  selectedPoetId: string | null;
  drawerOpen: boolean;
  searchOpen: boolean;
  directoryOpen: boolean;
  relationsEnabled: boolean;
  activePeriodId: string | null;
  filters: SkyFilters;
  camera: Record<SkyMode, CameraState | null>;
  focusRequest: FocusRequest | null;
  manifest: SkyManifest | null;
  initialized: boolean;

  initialize(input: {
    mode: SkyMode;
    selectedPoetId: string | null;
    manifest: SkyManifest;
    relationsEnabled: boolean;
  }): void;
  setMode(mode: SkyMode): void;
  selectPoet(poetId: string | null): void;
  openDrawer(poetId: string): void;
  closeDrawer(): void;
  setSearchOpen(open: boolean): void;
  setDirectoryOpen(open: boolean): void;
  toggleRelations(): void;
  setFilters(filters: Partial<SkyFilters>): void;
  setActivePeriod(periodId: string | null): void;
  setCamera(mode: SkyMode, camera: CameraState): void;
  requestFocus(mode: SkyMode, target: FocusTarget, animate?: boolean): void;
  clearFocusRequest(): void;
  resetFilters(): void;
}

let focusSequence = 0;

export const useSkyStore = create<SkyState>((set, get) => ({
  mode: 'river',
  selectedPoetId: null,
  drawerOpen: false,
  searchOpen: false,
  directoryOpen: false,
  relationsEnabled: true,
  activePeriodId: null,
  filters: { periodId: null, genre: null },
  camera: { river: null, galaxy: null },
  focusRequest: null,
  manifest: null,
  initialized: false,

  initialize({ mode, selectedPoetId, manifest, relationsEnabled }) {
    const state = get();
    if (state.initialized && state.manifest?.layoutVersion === manifest.layoutVersion) {
      set({
        mode,
        selectedPoetId,
        drawerOpen: selectedPoetId !== null,
        relationsEnabled,
        manifest,
      });
      return;
    }
    set({
      mode,
      selectedPoetId,
      drawerOpen: selectedPoetId !== null,
      relationsEnabled,
      activePeriodId: null,
      filters: { periodId: null, genre: null },
      camera: { river: null, galaxy: null },
      manifest,
      initialized: true,
      focusRequest: null,
    });
  },

  setMode(mode) {
    const state = get();
    if (state.mode === mode) return;
    set({
      mode,
      activePeriodId: null,
      focusRequest: {
        id: ++focusSequence,
        mode,
        target:
          state.selectedPoetId != null
            ? { kind: 'poet', poetId: state.selectedPoetId, zoom: 1.45 }
            : { kind: 'fit' },
        animate: true,
      },
    });
  },

  selectPoet(poetId) {
    set({ selectedPoetId: poetId, drawerOpen: poetId !== null });
  },

  openDrawer(poetId) {
    set({ selectedPoetId: poetId, drawerOpen: true });
  },

  closeDrawer() {
    set({ drawerOpen: false });
  },

  setSearchOpen(open) {
    set({ searchOpen: open });
  },

  setDirectoryOpen(open) {
    set({ directoryOpen: open });
  },

  toggleRelations() {
    const state = get();
    if (state.relationsEnabled) {
      set({ relationsEnabled: false });
      return;
    }
    if (!state.selectedPoetId) {
      set({ relationsEnabled: true });
      return;
    }
    set({ relationsEnabled: true });
  },

  setFilters(filters) {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },

  setActivePeriod(periodId) {
    set({ activePeriodId: periodId });
  },

  setCamera(mode, camera) {
    set((state) => ({ camera: { ...state.camera, [mode]: camera } }));
  },

  requestFocus(mode, target, animate = true) {
    set({
      focusRequest: { id: ++focusSequence, mode, target, animate },
    });
  },

  clearFocusRequest() {
    set({ focusRequest: null });
  },

  resetFilters() {
    set({ filters: { periodId: null, genre: null } });
  },
}));

export function getCameraForMode(mode: SkyMode): CameraState | null {
  return useSkyStore.getState().camera[mode];
}
