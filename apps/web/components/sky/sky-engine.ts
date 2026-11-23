'use client';

import {
  Application,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Sprite,
  TilingSprite,
  type Ticker,
} from 'pixi.js';

import {
  GALAXY_REALMS,
  GALAXY_WORLD_HEIGHT,
  GALAXY_WORLD_WIDTH,
  PERIOD_BY_ID,
  PERIOD_TO_REALM,
  RIVER_BANDS,
  STAR_BRIGHTNESS,
  STAR_CORE_COLOR,
  STAR_GLOW_COLOR,
  clamp,
  formatPeriodRange,
  riverBandForPeriod,
  riverBandForYear,
} from '@shihe/domain';
import type {
  FocusTarget,
  CameraState as StoreCameraState,
  FocusRequest,
} from '@/lib/stores/skyStore';
import type { Genre, PoetRelation, SkyManifest, SkyMode, StarPoint } from '@shihe/domain';
import { hashUnit } from '@shihe/sky-layout';

import {
  getNebulaTextures,
  getStarCoreTexture,
  getStarGlowTexture,
  getStarfieldTexture,
} from './sky-textures';

export interface SkyLabelLayout {
  poetId: string;
  name: string;
  /** 屏幕坐标（标签基线位于星星上方）。 */
  x: number;
  y: number;
  dateDisplay: string;
  active: boolean;
  dimmed: boolean;
  related: boolean;
  tier: StarPoint['impactTier'];
}

export interface SkyRelationTarget {
  poetId: string;
  relationType: PoetRelation['relationType'];
}

export interface SkyRealmLabel {
  realmId: string;
  name: string;
  subtitle: string;
  x: number;
  y: number;
  /** realm = 星系星域名；period = 星河朝代星群名。 */
  kind?: 'realm' | 'period';
}

export interface SkyEngineOptions {
  host: HTMLElement;
  reducedMotion: boolean;
  onSelect(poetId: string | null): void;
  onHover(star: StarPoint | null, screen: { x: number; y: number } | null): void;
  onLabels(labels: SkyLabelLayout[]): void;
  onRealmLabels(labels: SkyRealmLabel[]): void;
  onCamera(camera: StoreCameraState): void;
  onReady(): void;
  onError(message: string): void;
}

interface CameraAnimation {
  from: StoreCameraState;
  to: StoreCameraState;
  startedAt: number;
  duration: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startCamera: StoreCameraState;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
  moved: boolean;
}

const PERIOD_GLOW: Record<string, number> = {
  'pre-qin': 0x75b7d3,
  'qin-han': 0x6c9abf,
  'wei-jin': 0x9895ca,
  'sui-tang': 0xe8bc7b,
  'five-dynasties': 0x9cb3ce,
  'song-liao-jin': 0x98bbd4,
  yuan: 0xb298ca,
  ming: 0x8da4c6,
  qing: 0xaebfe0,
  republic: 0xbcc6d5,
};

const REALM_GLOW: Record<string, number> = {
  'realm-pre-qin': 0x75b7d3,
  'realm-wei-jin': 0x9895ca,
  'realm-sui-tang': 0xe8bc7b,
  'realm-song': 0x98bbd4,
  'realm-yuan-ming': 0xb298ca,
  'realm-qing-republic': 0xaebfe0,
};

const CORE_TEXTURE_VISIBLE_RADIUS = 6.4;
const GLOW_TEXTURE_VISIBLE_RADIUS = 64;
const MIN_ZOOM_FACTOR = 0.78;
const MAX_ZOOM_FACTOR = 11;

export class SkyEngine {
  private options: SkyEngineOptions;
  private app: Application | null = null;
  private root: Container | null = null;
  private world: Container | null = null;
  private nebulaLayer: Container | null = null;
  private constellationLayer: Container | null = null;
  private starLayer: Container | null = null;
  private relationLayer: Container | null = null;
  private selectionLayer: Container | null = null;
  private starfieldFar: TilingSprite | null = null;
  private starfieldNear: TilingSprite | null = null;
  private coreParticles: ParticleContainer | null = null;
  private glowParticles: ParticleContainer | null = null;
  private coreByPoet = new Map<string, Particle>();
  private glowByPoet = new Map<string, Particle>();
  private selectionRing: Graphics | null = null;
  private selectionGlow: Sprite | null = null;
  private hoverRing: Graphics | null = null;

  private manifest: SkyManifest | null = null;
  private mode: SkyMode = 'river';
  private stars: StarPoint[] = [];
  private starById = new Map<string, StarPoint>();
  private selectedPoetId: string | null = null;
  private hoverPoetId: string | null = null;
  private activeGenre: Genre | null = null;
  private relations: SkyRelationTarget[] = [];
  private destroyed = false;
  private ready = false;

  private camera: StoreCameraState = { x: 0, y: 0, zoom: 1 };
  private cameraAnimation: CameraAnimation | null = null;
  private lastCameraEmit = 0;

  private viewport = { width: 1, height: 1 };
  private worldBounds = { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  private fitZoom = 1;

  private pointers = new Map<number, { x: number; y: number }>();
  private drag: DragState | null = null;
  private pinch: { distance: number; midX: number; midY: number; camera: StoreCameraState } | null =
    null;
  private inertia = { x: 0, y: 0 };

  private pendingFocus: FocusRequest | null = null;
  private labelDirty = true;
  private lastLabelUpdate = 0;
  private resizeObserver: ResizeObserver | null = null;
  private time = 0;
  private listeners: Array<() => void> = [];

  constructor(options: SkyEngineOptions) {
    this.options = options;
  }

  async init(manifest: SkyManifest, mode: SkyMode): Promise<void> {
    if (this.app) return;
    try {
      const app = new Application();
      await app.init({
        width: this.options.host.clientWidth || 1,
        height: this.options.host.clientHeight || 1,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: 'webgl',
        powerPreference: 'high-performance',
        sharedTicker: false,
      });
      if (this.destroyed) {
        app.destroy({ removeView: true }, { children: true });
        return;
      }
      this.app = app;
      app.canvas.setAttribute('aria-hidden', 'true');
      app.canvas.setAttribute('data-testid', 'sky-canvas');
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      app.canvas.style.display = 'block';
      app.canvas.style.touchAction = 'none';
      this.options.host.appendChild(app.canvas);

      this.root = new Container();
      app.stage.addChild(this.root);

      this.starfieldFar = new TilingSprite({
        texture: getStarfieldTexture('far'),
        width: 1,
        height: 1,
      });
      this.starfieldFar.alpha = 0.9;
      this.root.addChild(this.starfieldFar);

      this.starfieldNear = new TilingSprite({
        texture: getStarfieldTexture('near'),
        width: 1,
        height: 1,
      });
      this.starfieldNear.alpha = 0.8;
      this.root.addChild(this.starfieldNear);

      this.world = new Container();
      this.root.addChild(this.world);

      this.nebulaLayer = new Container();
      this.world.addChild(this.nebulaLayer);

      this.constellationLayer = new Container();
      this.world.addChild(this.constellationLayer);

      this.starLayer = new Container();
      this.world.addChild(this.starLayer);

      this.relationLayer = new Container();
      this.world.addChild(this.relationLayer);

      this.selectionLayer = new Container();
      this.world.addChild(this.selectionLayer);
      this.buildSelectionMarks();

      app.ticker.add(this.tick);
      this.bindEvents();

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.options.host);

      this.viewport = {
        width: Math.max(1, this.options.host.clientWidth),
        height: Math.max(1, this.options.host.clientHeight),
      };
      this.manifest = manifest;
      this.setMode(manifest, mode);
      this.resize();
      this.ready = true;
      this.options.onReady();
    } catch (error) {
      console.error('[sky] 初始化失败', error);
      this.options.onError(
        '当前设备未能启动 WebGL 星图。你仍可以通过「诗人名录」和搜索阅读全部内容。',
      );
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  setMode(manifest: SkyManifest, mode: SkyMode): void {
    this.manifest = manifest;
    this.mode = mode;
    const world = manifest.modes[mode];
    this.worldBounds = {
      minX: world.minX,
      minY: world.minY,
      maxX: world.maxX,
      maxY: world.maxY,
    };
    this.recomputeFitZoom();
    this.buildNebula();
    this.clearStars();
    const saved = this.lastCameraByMode[mode];
    if (saved) {
      this.camera = { ...saved };
    } else {
      this.camera = this.fitCamera();
    }
    this.applyCamera();
    this.cameraAnimation = null;
    this.emitCamera(true);
    this.scheduleLabels();
  }

  private lastCameraByMode: Partial<Record<SkyMode, StoreCameraState>> = {};

  setStars(stars: StarPoint[]): void {
    this.stars = stars;
    this.starById = new Map(stars.map((star) => [star.poetId, star]));
    this.buildStars();
    this.applySelectionVisuals();
    this.scheduleLabels();
    if (this.pendingFocus) {
      const request = this.pendingFocus;
      this.pendingFocus = null;
      this.focus(request);
    }
  }

  setSelected(poetId: string | null): void {
    this.selectedPoetId = poetId;
    this.applySelectionVisuals();
    this.drawRelationLines();
    this.scheduleLabels();
  }

  /** 关系模式：传入当前选中作者的可信关系目标；空数组即关闭/清除连线。 */
  setRelations(relations: SkyRelationTarget[]): void {
    this.relations = relations;
    this.drawRelationLines();
  }

  setGenreFilter(genre: Genre | null): void {
    this.activeGenre = genre;
    this.applySelectionVisuals();
    this.scheduleLabels();
  }

  focus(request: FocusRequest): void {
    if (request.mode !== this.mode) return;
    const target = this.resolveFocus(request.target);
    if (!target) {
      // 星辰数据尚未加载完成：记住请求，待 setStars 后重试。
      this.pendingFocus = request;
      return;
    }
    this.pendingFocus = null;
    if (this.options.reducedMotion || !request.animate) {
      this.camera = target;
      this.cameraAnimation = null;
      this.applyCamera();
      this.emitCamera(true);
      this.scheduleLabels();
      return;
    }
    this.cameraAnimation = {
      from: { ...this.camera },
      to: target,
      startedAt: performance.now(),
      duration: 760,
    };
  }

  resize(): void {
    if (!this.app || !this.manifest) return;
    const width = Math.max(1, this.options.host.clientWidth);
    const height = Math.max(1, this.options.host.clientHeight);
    this.app.renderer.resize(width, height);
    this.viewport = { width, height };
    if (this.starfieldFar) {
      this.starfieldFar.width = width;
      this.starfieldFar.height = height;
    }
    if (this.starfieldNear) {
      this.starfieldNear.width = width;
      this.starfieldNear.height = height;
    }
    this.recomputeFitZoom();
    this.camera = this.clampCamera(this.camera);
    this.applyCamera();
    this.scheduleLabels();
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    for (const dispose of this.listeners) dispose();
    this.listeners = [];
    const app = this.app;
    this.app = null;
    this.ready = false;
    if (app) {
      try {
        app.destroy({ removeView: true }, { children: true });
      } catch (error) {
        console.warn('[sky] 销毁时出现问题', error);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 场景构建                                                           */
  /* ------------------------------------------------------------------ */

  private buildNebula(): void {
    if (!this.nebulaLayer || !this.manifest) return;
    this.nebulaLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    const textures = getNebulaTextures();

    if (this.mode === 'river') {
      for (const band of RIVER_BANDS) {
        const period = PERIOD_BY_ID.get(band.periodId);
        if (!period) continue;
        const color = PERIOD_GLOW[period.id] ?? 0x8fa9c8;
        const centerX = band.x + band.width / 2;
        const centerY = band.y;
        for (let index = 0; index < 2; index += 1) {
          const texture = textures[(period.sortOrder + index) % textures.length]!;
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.tint = color;
          sprite.blendMode = 'add';
          sprite.alpha = index === 0 ? 0.44 : 0.3;
          sprite.position.set(
            centerX + (hashUnit(period.id, `nebula-x${index}`) - 0.5) * band.width * 0.22,
            centerY + (hashUnit(period.id, `nebula-y${index}`) - 0.5) * band.height * 0.16,
          );
          const widthWorld = (band.width * (index === 0 ? 1.45 : 1.02)) / texture.width;
          const heightWorld = (band.height * (index === 0 ? 1.05 : 0.8)) / texture.height;
          sprite.scale.set(widthWorld, heightWorld);
          this.nebulaLayer.addChild(sprite);
        }
      }
      return;
    }

    for (const realm of GALAXY_REALMS) {
      const texture = textures[GALAXY_REALMS.indexOf(realm) % textures.length]!;
      const color = REALM_GLOW[realm.id] ?? 0x8fa9c8;
      const centerX = realm.anchor.x * GALAXY_WORLD_WIDTH;
      const centerY = realm.anchor.y * GALAXY_WORLD_HEIGHT;
      for (let index = 0; index < 2; index += 1) {
        const sprite = new Sprite(
          index === 0 ? texture : textures[(GALAXY_REALMS.indexOf(realm) + 2) % textures.length]!,
        );
        sprite.anchor.set(0.5);
        sprite.tint = color;
        sprite.blendMode = 'add';
        sprite.alpha = index === 0 ? 0.62 : 0.4;
        sprite.position.set(
          centerX + (hashUnit(realm.id, `n-x${index}`) - 0.5) * realm.baseRadius * 0.7,
          centerY + (hashUnit(realm.id, `n-y${index}`) - 0.5) * realm.baseRadius * 0.6,
        );
        const radius = realm.baseRadius * (index === 0 ? 3.2 : 2.2);
        sprite.scale.set(radius / texture.width, (radius * 0.72) / texture.height);
        this.nebulaLayer.addChild(sprite);
      }
    }
  }

  private clearStars(): void {
    this.coreParticles?.destroy({ children: true });
    this.glowParticles?.destroy({ children: true });
    this.coreParticles = null;
    this.glowParticles = null;
    this.coreByPoet.clear();
    this.glowByPoet.clear();
    this.starLayer?.removeChildren();
    this.stars = [];
    this.starById.clear();
    this.hoverPoetId = null;
  }

  private buildStars(): void {
    if (!this.starLayer) return;
    this.coreParticles?.destroy({ children: true });
    this.glowParticles?.destroy({ children: true });
    this.coreByPoet.clear();
    this.glowByPoet.clear();

    this.glowParticles = new ParticleContainer({
      dynamicProperties: { position: true, color: true },
    });
    this.coreParticles = new ParticleContainer({
      dynamicProperties: { position: true, color: true },
    });

    const coreTexture = getStarCoreTexture();
    const glowTexture = getStarGlowTexture();

    for (const star of this.stars) {
      const glow = new Particle({
        texture: glowTexture,
        x: star.x,
        y: star.y,
        anchorX: 0.5,
        anchorY: 0.5,
        tint: STAR_GLOW_COLOR[star.impactTier],
        alpha: 0.5,
      });
      this.glowParticles.addParticle(glow);
      this.glowByPoet.set(star.poetId, glow);

      const core = new Particle({
        texture: coreTexture,
        x: star.x,
        y: star.y,
        anchorX: 0.5,
        anchorY: 0.5,
        tint: STAR_CORE_COLOR[star.impactTier],
        alpha: STAR_BRIGHTNESS[star.impactTier],
      });
      this.coreParticles.addParticle(core);
      this.coreByPoet.set(star.poetId, core);
    }

    this.starLayer.addChild(this.glowParticles, this.coreParticles);
    this.applyStarScales();
    this.drawConstellationLines();
    this.drawRelationLines();
    console.info('[sky] particles built', this.coreByPoet.size, this.starLayer.children.length);
  }

  private applyStarScales(): void {
    const zoomFactor = Math.pow(
      Math.max(this.camera.zoom, 1e-6) / Math.max(this.fitZoom, 1e-6),
      0.34,
    );
    const dimensionScale = clamp(zoomFactor, 0.82, 2.3) * (this.viewport.width < 700 ? 1.55 : 1);
    for (const star of this.stars) {
      const core = this.coreByPoet.get(star.poetId);
      const glow = this.glowByPoet.get(star.poetId);
      if (!core || !glow) continue;
      const radius = star.radiusBase * dimensionScale;
      const coreScale = radius / CORE_TEXTURE_VISIBLE_RADIUS;
      core.scaleX = coreScale;
      core.scaleY = coreScale;
      const glowScale = (radius * 3.8) / GLOW_TEXTURE_VISIBLE_RADIUS;
      glow.scaleX = glowScale;
      glow.scaleY = glowScale;
    }
  }

  private applySelectionVisuals(): void {
    for (const star of this.stars) {
      const core = this.coreByPoet.get(star.poetId);
      const glow = this.glowByPoet.get(star.poetId);
      if (!core || !glow) continue;
      const isSelected = this.selectedPoetId === star.poetId;
      const isDimmed = this.selectedPoetId != null && this.selectedPoetId !== star.poetId;
      const brightness = STAR_BRIGHTNESS[star.impactTier];
      core.alpha = isDimmed ? 0.28 : isSelected ? 1 : 0.55 + brightness * 0.45;
      glow.alpha = isDimmed ? 0.12 : isSelected ? 0.95 : 0.2 + brightness * 0.38;
    }
    this.updateSelectionRing();
  }

  private buildSelectionMarks(): void {
    if (!this.selectionLayer) return;
    this.selectionGlow = new Sprite(getStarGlowTexture());
    this.selectionGlow.anchor.set(0.5);
    this.selectionGlow.tint = 0xffe3ae;
    this.selectionGlow.alpha = 0;
    this.selectionLayer.addChild(this.selectionGlow);

    this.selectionRing = new Graphics();
    this.selectionRing.alpha = 0;
    this.selectionLayer.addChild(this.selectionRing);

    this.hoverRing = new Graphics();
    this.hoverRing.alpha = 0;
    this.selectionLayer.addChild(this.hoverRing);
  }

  private updateSelectionRing(): void {
    if (!this.selectionRing || !this.selectionGlow) return;
    const selected = this.selectedPoetId ? this.starById.get(this.selectedPoetId) : null;
    this.selectionRing.clear();
    if (!selected) {
      this.selectionRing.alpha = 0;
      this.selectionGlow.alpha = 0;
      return;
    }
    const dimensionScale = clamp(
      Math.pow(Math.max(this.camera.zoom, 1e-6) / Math.max(this.fitZoom, 1e-6), 0.34),
      0.82,
      2.3,
    );
    const radius = Math.max(selected.radiusBase * dimensionScale * 1.9 + 7, 14);
    this.selectionRing.circle(0, 0, radius).stroke({ width: 1.1, color: 0xf6d7a1, alpha: 0.9 });
    this.selectionRing
      .circle(0, 0, radius + 5)
      .stroke({ width: 0.7, color: 0xf6d7a1, alpha: 0.22 });
    this.selectionRing.position.set(selected.x, selected.y);
    this.selectionRing.alpha = 1;

    const glowScale = (radius * 2.6) / GLOW_TEXTURE_VISIBLE_RADIUS;
    this.selectionGlow.position.set(selected.x, selected.y);
    this.selectionGlow.scale.set(glowScale, glowScale);
    this.selectionGlow.alpha = 0.55;
  }

  private relationColor(type: PoetRelation['relationType']): number {
    switch (type) {
      case 'teacher_student':
        return 0xe8c894;
      case 'association':
        return 0x9db8d6;
      case 'literary_influence':
        return 0xb6a6d9;
      case 'kinship':
        return 0xa9c8d8;
      default:
        return 0xf3d7a2;
    }
  }

  /**
   * 关系连线与星图坐标同步：使用当前模式的世界坐标绘制，
   * 相机缩放时重新按屏幕像素宽度生成虚线，避免线宽随缩放失真。
   */
  /**
   * 历史星河：用极淡的“星群连线”把同一朝代的星辰连成星座，
   * 让用户在全景中仍能看出“这些是同一朝代的诗人”。
   * 连线只连接同朝代内彼此最近的星辰，不使用关系数据。
   */
  private drawConstellationLines(): void {
    const layer = this.constellationLayer;
    if (!layer) return;
    layer.removeChildren().forEach((child) => child.destroy());
    if (this.mode !== 'river' || this.stars.length === 0) return;

    const graphics = new Graphics();
    let lineCount = 0;
    const linked = new Set<string>();

    for (const band of RIVER_BANDS) {
      const stars = this.stars.filter((star) => {
        const starBand = riverBandForPeriod(star.periodId);
        return starBand?.periodId === band.periodId;
      });
      if (stars.length < 2) continue;

      for (const star of stars) {
        const nearest = stars
          .filter((other) => other.poetId !== star.poetId)
          .map((other) => ({
            other,
            distance: Math.hypot(other.x - star.x, other.y - star.y),
          }))
          .filter((item) => item.distance < 380)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 2);

        for (const item of nearest) {
          const pairKey = [star.poetId, item.other.poetId].sort().join('|');
          if (linked.has(pairKey)) continue;
          linked.add(pairKey);
          graphics
            .moveTo(star.x, star.y)
            .lineTo(item.other.x, item.other.y)
            .stroke({
              width: 2.4,
              color: PERIOD_GLOW[band.periodId] ?? 0x8fa9c8,
              alpha: 0.18,
            });
          lineCount += 1;
          if (lineCount >= 180) break;
        }
        if (lineCount >= 180) break;
      }
    }

    if (lineCount > 0) layer.addChild(graphics);
    else graphics.destroy();
  }

  private drawRelationLines(): void {
    const layer = this.relationLayer;
    if (!layer) return;
    layer.removeChildren().forEach((child) => child.destroy());
    if (!this.selectedPoetId || this.relations.length === 0) return;
    const from = this.starById.get(this.selectedPoetId);
    if (!from) return;

    const zoom = Math.max(this.camera.zoom, 1e-6);
    const lineWidth = Math.min(2.8, Math.max(1.1, 1.5 / zoom));
    const samples = 48;

    const lines = new Graphics();
    const endpoints = new Graphics();
    let drawn = 0;

    for (const relation of this.relations) {
      if (relation.poetId === this.selectedPoetId) continue;
      const to = this.starById.get(relation.poetId);
      if (!to) continue;
      drawn += 1;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.5) continue;

      // 为同时代诗人留出可辨识的弧线：曲线外扩至少 50 世界单位。
      const curve =
        Math.max(distance * 0.45, 40) * (hashUnit(relation.poetId, 'rel') > 0.5 ? 1 : -1);
      const midX = (from.x + to.x) / 2 - (dy / distance) * curve;
      const midY = (from.y + to.y) / 2 + (dx / distance) * curve;

      // 虚线：每 6 个采样点画 3 个。
      let penDown = false;
      for (let index = 0; index < samples; index += 1) {
        const t = index / (samples - 1);
        const oneMinusT = 1 - t;
        const x = oneMinusT * oneMinusT * from.x + 2 * oneMinusT * t * midX + t * t * to.x;
        const y = oneMinusT * oneMinusT * from.y + 2 * oneMinusT * t * midY + t * t * to.y;
        if (index === 0) {
          lines.moveTo(x, y);
          penDown = true;
          continue;
        }
        const on = index % 8 < 4;
        if (on && penDown) {
          lines.lineTo(x, y);
        } else if (on) {
          lines.moveTo(x, y);
          penDown = true;
        } else {
          penDown = false;
        }
        if (!on) penDown = false;
      }

      endpoints
        .circle(to.x, to.y, Math.max(3.2, 3.4 / zoom))
        .fill({ color: this.relationColor(relation.relationType), alpha: 0.85 });
      endpoints
        .circle(from.x, from.y, Math.max(3.8, 4 / zoom))
        .fill({ color: this.relationColor(relation.relationType), alpha: 0.55 });
    }

    if (drawn > 0) {
      lines.stroke({ width: lineWidth, color: 0xf3d7a2, alpha: 0.95 });
      layer.addChild(lines, endpoints);
    } else {
      lines.destroy();
      endpoints.destroy();
    }
  }

  private updateHoverRing(): void {
    if (!this.hoverRing) return;
    const hovered = this.hoverPoetId ? this.starById.get(this.hoverPoetId) : null;
    this.hoverRing.clear();
    if (!hovered || hovered.poetId === this.selectedPoetId) {
      this.hoverRing.alpha = 0;
      return;
    }
    const dimensionScale = clamp(
      Math.pow(Math.max(this.camera.zoom, 1e-6) / Math.max(this.fitZoom, 1e-6), 0.34),
      0.82,
      2.3,
    );
    const radius = Math.max(hovered.radiusBase * dimensionScale * 1.7 + 5, 12);
    this.hoverRing.circle(0, 0, radius).stroke({ width: 1, color: 0xf9e2b6, alpha: 0.55 });
    this.hoverRing.position.set(hovered.x, hovered.y);
    this.hoverRing.alpha = 1;
  }

  /* ------------------------------------------------------------------ */
  /* 相机                                                               */
  /* ------------------------------------------------------------------ */

  private recomputeFitZoom(): void {
    const worldWidth = Math.max(this.worldBounds.maxX - this.worldBounds.minX, 1);
    const worldHeight = Math.max(this.worldBounds.maxY - this.worldBounds.minY, 1);
    const padding = this.viewport.width < 700 ? 0.92 : 0.88;
    this.fitZoom =
      Math.min(this.viewport.width / worldWidth, (this.viewport.height * 0.86) / worldHeight) *
      padding;
  }

  private fitCamera(): StoreCameraState {
    return this.clampCamera({
      x: (this.worldBounds.minX + this.worldBounds.maxX) / 2,
      y: (this.worldBounds.minY + this.worldBounds.maxY) / 2,
      zoom: this.fitZoom,
    });
  }

  private clampCamera(camera: StoreCameraState): StoreCameraState {
    const minZoom = this.fitZoom * MIN_ZOOM_FACTOR;
    const maxZoom = this.fitZoom * MAX_ZOOM_FACTOR;
    const zoom = clamp(camera.zoom, minZoom, maxZoom);
    const viewWidth = this.viewport.width / zoom;
    const viewHeight = this.viewport.height / zoom;
    const marginX = viewWidth * 0.25;
    const marginY = viewHeight * 0.25;
    return {
      x: clamp(camera.x, this.worldBounds.minX - marginX, this.worldBounds.maxX + marginX),
      y: clamp(camera.y, this.worldBounds.minY - marginY, this.worldBounds.maxY + marginY),
      zoom,
    };
  }

  private resolveFocus(target: FocusTarget): StoreCameraState | null {
    if (target.kind === 'fit') {
      return this.fitCamera();
    }

    if (target.kind === 'poet') {
      const star = this.starById.get(target.poetId);
      if (!star) return null;
      const zoom = Math.max(this.fitZoom * (target.zoom ?? 2.3), this.fitZoom * 1.6);
      // 移动端抽屉占据下半屏：将星辰移至视口约 1/3 高度处，保证仍能看见它。
      const yOffset = this.viewport.width < 700 ? (this.viewport.height * 0.18) / zoom : 0;
      return this.clampCamera({
        x: star.x,
        y: star.y + yOffset,
        zoom,
      });
    }

    if (target.kind === 'year') {
      if (this.mode === 'river') {
        const band = riverBandForYear(target.year);
        if (!band) return this.fitCamera();
        return this.focusRiverBand(band);
      }
      return this.focusGalaxyRealmForYear(target.year, target.zoom);
    }

    if (target.kind === 'realm') {
      const realm = GALAXY_REALMS.find((item) => item.id === target.realmId);
      if (!realm) return null;
      return this.clampCamera({
        x: realm.anchor.x * GALAXY_WORLD_WIDTH,
        y: realm.anchor.y * GALAXY_WORLD_HEIGHT,
        zoom: Math.max(this.fitZoom * 2.3, this.fitZoom * 1.6),
      });
    }

    if (target.kind === 'period') {
      const period = PERIOD_BY_ID.get(target.periodId);
      if (!period) return null;
      if (this.mode === 'river') {
        const band = riverBandForPeriod(period.id);
        if (!band) return this.fitCamera();
        return this.focusRiverBand(band);
      }
      return this.focusGalaxyRealm(period.id);
    }

    return null;
  }

  private focusRiverBand(
    band: { x: number; y: number; width: number; height: number },
    zoom?: number,
  ): StoreCameraState {
    const widthZoom = (this.viewport.width * 0.9) / (band.width * 1.25);
    const heightZoom = (this.viewport.height * 0.82) / (band.height * 1.02);
    const bandZoom = Math.min(widthZoom, heightZoom);
    return this.clampCamera({
      x: band.x + band.width / 2,
      y: band.y,
      zoom: Math.max(bandZoom, this.fitZoom * (zoom ?? 1.9)),
    });
  }

  private focusGalaxyRealmForYear(year: number, zoom?: number): StoreCameraState | null {
    if (!this.manifest) return null;
    const period = this.manifest.periods.find(
      (item) => year >= item.startYear && year <= item.endYear,
    );
    if (!period) return this.focusGalaxyRealm('sui-tang', zoom);
    return this.focusGalaxyRealm(period.id, zoom);
  }

  private focusGalaxyRealm(periodId: string, zoom?: number): StoreCameraState | null {
    const realmId = PERIOD_TO_REALM.get(periodId);
    const realm = GALAXY_REALMS.find((item) => item.id === realmId);
    if (!realm) return null;
    return this.clampCamera({
      x: realm.anchor.x * GALAXY_WORLD_WIDTH,
      y: realm.anchor.y * GALAXY_WORLD_HEIGHT,
      zoom: Math.max(this.fitZoom * (zoom ?? 2.3), this.fitZoom * 1.6),
    });
  }

  private applyCamera(): void {
    if (!this.world) return;
    this.world.position.set(
      this.viewport.width / 2 - this.camera.x * this.camera.zoom,
      this.viewport.height / 2 - this.camera.y * this.camera.zoom,
    );
    this.world.scale.set(this.camera.zoom);
    this.applyStarScales();
    this.updateSelectionRing();
    this.updateHoverRing();
    this.drawRelationLines();
    this.lastCameraByMode[this.mode] = { ...this.camera };
    this.emitCamera(false);
    this.scheduleLabels();
  }

  private emitCamera(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastCameraEmit < 160) return;
    this.lastCameraEmit = now;
    this.options.onCamera({ ...this.camera });
  }

  /* ------------------------------------------------------------------ */
  /* 帧循环                                                             */
  /* ------------------------------------------------------------------ */

  private tick = (ticker: Ticker): void => {
    if (this.destroyed) return;
    const deltaMs = ticker.deltaMS;
    this.time += deltaMs;

    if (this.cameraAnimation) {
      const progress = clamp(
        (performance.now() - this.cameraAnimation.startedAt) / this.cameraAnimation.duration,
        0,
        1,
      );
      const eased = easeInOutCubic(progress);
      const { from, to } = this.cameraAnimation;
      this.camera = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        zoom: from.zoom + (to.zoom - from.zoom) * eased,
      };
      this.applyCamera();
      if (progress >= 1) {
        this.cameraAnimation = null;
        this.emitCamera(true);
      }
    } else if (Math.abs(this.inertia.x) > 0.02 || Math.abs(this.inertia.y) > 0.02) {
      this.camera = this.clampCamera({
        x: this.camera.x - this.inertia.x * (deltaMs / 16.7),
        y: this.camera.y - this.inertia.y * (deltaMs / 16.7),
        zoom: this.camera.zoom,
      });
      this.inertia.x *= 0.9;
      this.inertia.y *= 0.9;
      this.applyCamera();
    }

    // 装饰星野的缓慢漂移（不影响真实诗人坐标）。
    const drift = this.options.reducedMotion ? 0 : this.time * 0.006;
    if (this.starfieldFar) {
      this.starfieldFar.tilePosition.set(
        -this.camera.x * 0.06 + drift,
        -this.camera.y * 0.06 + drift * 0.35,
      );
    }
    if (this.starfieldNear) {
      this.starfieldNear.tilePosition.set(
        -this.camera.x * 0.14 - drift * 0.6,
        -this.camera.y * 0.14 + drift * 0.2,
      );
    }

    // 选中光环的呼吸效果。
    if (this.selectionRing && this.selectionRing.alpha > 0) {
      const pulse = this.options.reducedMotion ? 1 : 0.82 + Math.sin(this.time * 0.002) * 0.18;
      this.selectionRing.alpha = pulse;
    }

    if (this.labelDirty && performance.now() - this.lastLabelUpdate > 80) {
      this.updateLabels();
    }
  };

  /* ------------------------------------------------------------------ */
  /* 交互                                                               */
  /* ------------------------------------------------------------------ */

  private bindEvents(): void {
    const canvas = this.app?.canvas;
    if (!canvas) return;

    const add = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(type, handler as EventListener, options);
      this.listeners.push(() =>
        target.removeEventListener(type, handler as EventListener, options),
      );
    };

    add(canvas, 'pointerdown', (event) => this.onPointerDown(event));
    add(canvas, 'pointermove', (event) => this.onPointerMove(event));
    add(canvas, 'pointerup', (event) => this.onPointerUp(event));
    add(canvas, 'pointercancel', (event) => this.onPointerUp(event));
    add(canvas, 'pointerleave', () => this.setHover(null));
    const wheelTarget = this.options.host.parentElement ?? canvas;
    add(wheelTarget, 'wheel', (event) => this.onWheel(event as WheelEvent), { passive: false });
    add(canvas, 'dblclick', (event) => this.onDoubleClick(event));
  }

  private pointerPosition(event: PointerEvent): { x: number; y: number } {
    const rect = this.app?.canvas.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  }

  private onPointerDown(event: PointerEvent): void {
    const canvas = this.app?.canvas;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const position = this.pointerPosition(event);
    this.pointers.set(event.pointerId, position);
    this.cameraAnimation = null;
    this.inertia.x = 0;
    this.inertia.y = 0;

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      this.drag = null;
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        camera: { ...this.camera },
      };
      return;
    }

    this.drag = {
      pointerId: event.pointerId,
      startX: position.x,
      startY: position.y,
      startCamera: { ...this.camera },
      lastX: position.x,
      lastY: position.y,
      lastTime: performance.now(),
      velocityX: 0,
      velocityY: 0,
      moved: false,
    };
    canvas.style.cursor = 'grabbing';
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) {
      this.updateHoverFromPointer(event);
      return;
    }
    const position = this.pointerPosition(event);
    this.pointers.set(event.pointerId, position);

    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const distance = Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const base = this.pinch.camera;
      const zoom = clamp(
        (base.zoom * distance) / Math.max(this.pinch.distance, 1),
        this.fitZoom * MIN_ZOOM_FACTOR,
        this.fitZoom * MAX_ZOOM_FACTOR,
      );
      // 以双指中点为锚点缩放。
      const worldBefore = this.screenToWorld(this.pinch.midX, this.pinch.midY, base);
      const nextCamera = this.clampCamera({
        x: worldBefore.x - (midX - this.viewport.width / 2) / zoom,
        y: worldBefore.y - (midY - this.viewport.height / 2) / zoom,
        zoom,
      });
      this.camera = nextCamera;
      this.applyCamera();
      return;
    }

    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    const now = performance.now();
    const dx = position.x - this.drag.lastX;
    const dy = position.y - this.drag.lastY;
    const totalMoved = Math.hypot(position.x - this.drag.startX, position.y - this.drag.startY);
    if (totalMoved > 5) this.drag.moved = true;
    const dt = Math.max(now - this.drag.lastTime, 1);
    if (dt > 0) {
      this.drag.velocityX = (dx / dt) * 16.7;
      this.drag.velocityY = (dy / dt) * 16.7;
    }
    this.drag.lastX = position.x;
    this.drag.lastY = position.y;
    this.drag.lastTime = now;

    this.camera = this.clampCamera({
      x: this.drag.startCamera.x - (position.x - this.drag.startX) / this.camera.zoom,
      y: this.drag.startCamera.y - (position.y - this.drag.startY) / this.camera.zoom,
      zoom: this.drag.startCamera.zoom,
    });
    this.applyCamera();
  }

  private onPointerUp(event: PointerEvent): void {
    const canvas = this.app?.canvas;
    const position = this.pointerPosition(event);
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) {
      this.pinch = null;
    }
    if (canvas) {
      canvas.style.cursor = 'grab';
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }

    if (this.drag && this.drag.pointerId === event.pointerId) {
      const drag = this.drag;
      this.drag = null;
      const duration = performance.now() - drag.lastTime;
      if (!drag.moved && Math.hypot(position.x - drag.startX, position.y - drag.startY) < 8) {
        const picked = this.pickStar(position.x, position.y);
        this.options.onSelect(picked ? picked.poetId : null);
        return;
      }
      if (duration < 120) {
        this.inertia.x = clamp(drag.velocityX, -28, 28);
        this.inertia.y = clamp(drag.velocityY, -28, 28);
      }
    }
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.cameraAnimation = null;
    this.inertia.x = 0;
    this.inertia.y = 0;
    const position = this.pointerPosition(event as unknown as PointerEvent);
    const worldBefore = this.screenToWorld(position.x, position.y);
    const factor = Math.exp(-event.deltaY * 0.0016);
    const zoom = clamp(
      this.camera.zoom * factor,
      this.fitZoom * MIN_ZOOM_FACTOR,
      this.fitZoom * MAX_ZOOM_FACTOR,
    );
    const nextCamera = this.clampCamera({
      x: worldBefore.x - (position.x - this.viewport.width / 2) / zoom,
      y: worldBefore.y - (position.y - this.viewport.height / 2) / zoom,
      zoom,
    });
    this.camera = nextCamera;
    this.applyCamera();
  }

  private onDoubleClick(event: MouseEvent): void {
    const position = this.pointerPosition(event as unknown as PointerEvent);
    const picked = this.pickStar(position.x, position.y);
    if (picked) {
      this.focus({
        id: 0,
        mode: this.mode,
        target: { kind: 'poet', poetId: picked.poetId, zoom: 4 },
        animate: !this.options.reducedMotion,
      });
    }
  }

  private updateHoverFromPointer(event: PointerEvent): void {
    if (this.drag || this.pointers.size > 0) return;
    const position = this.pointerPosition(event);
    const picked = this.pickStar(position.x, position.y, 28);
    this.setHover(picked);
    const canvas = this.app?.canvas;
    if (canvas) canvas.style.cursor = picked ? 'pointer' : 'grab';
  }

  private setHover(star: StarPoint | null): void {
    const nextId = star?.poetId ?? null;
    if (this.hoverPoetId === nextId) return;
    this.hoverPoetId = nextId;
    this.updateHoverRing();
    this.options.onHover(star, star ? this.worldToScreen(star.x, star.y) : null);
  }

  private pickStar(screenX: number, screenY: number, threshold = 24): StarPoint | null {
    let best: StarPoint | null = null;
    let bestDistance = threshold;
    for (const star of this.stars) {
      const screen = this.worldToScreen(star.x, star.y);
      const distance = Math.hypot(screen.x - screenX, screen.y - screenY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = star;
      }
    }
    return best;
  }

  private worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.camera.x) * this.camera.zoom + this.viewport.width / 2,
      y: (y - this.camera.y) * this.camera.zoom + this.viewport.height / 2,
    };
  }

  private screenToWorld(
    x: number,
    y: number,
    camera: StoreCameraState = this.camera,
  ): { x: number; y: number } {
    return {
      x: (x - this.viewport.width / 2) / camera.zoom + camera.x,
      y: (y - this.viewport.height / 2) / camera.zoom + camera.y,
    };
  }

  /* ------------------------------------------------------------------ */
  /* 标签层（HTML）                                                      */
  /* ------------------------------------------------------------------ */

  private scheduleLabels(): void {
    this.labelDirty = true;
  }

  private updateLabels(): void {
    this.labelDirty = false;
    this.lastLabelUpdate = performance.now();
    const width = this.viewport.width;
    const height = this.viewport.height;
    const isMobile = width < 700;
    const zoomRatio = this.camera.zoom / Math.max(this.fitZoom, 1e-6);
    const baseLabels = isMobile ? 6 : zoomRatio > 1.9 ? 32 : zoomRatio > 1.25 ? 20 : 14;
    // 体裁筛选时增加标签名额：筛出的作者通常更少，需要让结果更完整。
    const genreLabels = this.activeGenre ? Math.max(baseLabels, isMobile ? 14 : 40) : baseLabels;
    const maxLabels = this.relations.length > 0 ? Math.max(genreLabels, 18) : genreLabels;
    const margin = 70;

    const relatedIds = new Set(this.relations.map((relation) => relation.poetId));
    const visible = this.stars
      .map((star) => ({ star, screen: this.worldToScreen(star.x, star.y) }))
      .filter(
        (item) =>
          item.screen.x > margin &&
          item.screen.x < width - margin &&
          item.screen.y > 108 &&
          item.screen.y < height - 150,
      )
      .filter(
        (item) =>
          this.activeGenre == null ||
          item.star.genres.includes(this.activeGenre) ||
          item.star.poetId === this.selectedPoetId,
      )
      .sort((a, b) => {
        if (a.star.poetId === this.selectedPoetId) return -1;
        if (b.star.poetId === this.selectedPoetId) return 1;
        const aRelated = relatedIds.has(a.star.poetId) ? 1 : 0;
        const bRelated = relatedIds.has(b.star.poetId) ? 1 : 0;
        if (aRelated !== bRelated) return bRelated - aRelated;
        return b.star.labelPriority - a.star.labelPriority;
      });

    const chosen: SkyLabelLayout[] = [];
    const boxes: { left: number; right: number; top: number; bottom: number }[] = [];

    for (const item of visible) {
      if (chosen.length >= maxLabels) break;
      const labelWidth = Math.max(34, Array.from(item.star.name).length * 15 + 12);
      const box = {
        left: item.screen.x - labelWidth / 2,
        right: item.screen.x + labelWidth / 2,
        top: item.screen.y - 34,
        bottom: item.screen.y - 12,
      };
      const collides = boxes.some(
        (existing) =>
          box.left < existing.right + 8 &&
          box.right > existing.left - 8 &&
          box.top < existing.bottom + 4 &&
          box.bottom > existing.top - 4,
      );
      if (collides) continue;
      boxes.push(box);
      chosen.push({
        poetId: item.star.poetId,
        name: item.star.name,
        x: item.screen.x,
        y: item.screen.y - 14,
        dateDisplay: item.star.dateDisplay,
        active: item.star.poetId === this.selectedPoetId,
        dimmed: this.selectedPoetId != null && item.star.poetId !== this.selectedPoetId,
        related: relatedIds.has(item.star.poetId),
        tier: item.star.impactTier,
      });
    }

    this.options.onLabels(chosen);
    this.options.onRealmLabels(this.buildRealmLabels());
  }

  private buildRealmLabels(): SkyRealmLabel[] {
    if (this.mode === 'river') {
      // 全景只保留星群，不叠加朝代文字；放大/聚焦后再显示朝代名，避免与首屏标题、
      // 诗人标签和时间轴互相遮挡。
      if (this.camera.zoom < this.fitZoom * 1.35) return [];
      const mobileIds = new Set(['pre-qin', 'wei-jin', 'sui-tang', 'song-liao-jin', 'qing']);
      return RIVER_BANDS.filter(
        (band) => this.viewport.width >= 700 || mobileIds.has(band.periodId),
      )
        .map((band) => {
          const period = PERIOD_BY_ID.get(band.periodId);
          if (!period) return null;
          const screen = this.worldToScreen(band.x + band.width / 2, band.y + band.height / 2 + 26);
          // 只标注当前视口内的朝代，避免聚焦某一朝代时把相邻朝代的标签叠加到边缘。
          if (
            screen.x < -30 ||
            screen.x > this.viewport.width + 30 ||
            screen.y < 110 ||
            screen.y > this.viewport.height - 96
          ) {
            return null;
          }
          return {
            realmId: `river-${band.periodId}`,
            name: period.shortName,
            subtitle: formatPeriodRange(period),
            x: screen.x,
            y: screen.y,
            kind: 'period' as const,
          };
        })
        .filter((label): label is NonNullable<typeof label> => label != null);
    }
    if (this.mode !== 'galaxy') return [];
    // 移动窄屏只保留与参考稿一致的四个主星域标签，避免标签互相遮挡。
    const mobileRealmIds = new Set([
      'realm-pre-qin',
      'realm-sui-tang',
      'realm-song',
      'realm-qing-republic',
    ]);
    const realms =
      this.viewport.width < 700
        ? GALAXY_REALMS.filter((realm) => mobileRealmIds.has(realm.id))
        : GALAXY_REALMS;
    return realms
      .map((realm) => {
        const center = this.worldToScreen(
          realm.anchor.x * GALAXY_WORLD_WIDTH,
          realm.anchor.y * GALAXY_WORLD_HEIGHT,
        );
        const offset = Math.max(realm.baseRadius * 0.92 * this.camera.zoom + 34, 56);
        return {
          realmId: realm.id,
          name: realm.name,
          subtitle: realm.subtitle,
          x: center.x,
          y: center.y - offset,
          kind: 'realm' as const,
        };
      })
      .filter(
        (label) =>
          label.x > -100 &&
          label.x < this.viewport.width + 100 &&
          label.y > 90 &&
          label.y < this.viewport.height - 90,
      );
  }

  /** 供页面「回到全景」等操作读取当前相机。 */
  getCamera(): StoreCameraState {
    return { ...this.camera };
  }

  /** 测试用：返回某位诗人的世界坐标。 */
  getStarWorldPosition(poetId: string): { x: number; y: number } | null {
    const star = this.starById.get(poetId);
    return star ? { x: star.x, y: star.y } : null;
  }

  /** 测试用：返回某位诗人的屏幕坐标（不参与生产 UI）。 */
  getStarScreenPosition(poetId: string): { x: number; y: number } | null {
    const star = this.starById.get(poetId);
    if (!star) return null;
    return this.worldToScreen(star.x, star.y);
  }

  /** 调试/测试用状态快照（不参与生产渲染）。 */
  getDebugState() {
    return {
      ready: this.ready,
      stars: this.stars.length,
      activeGenre: this.activeGenre,
      relationTargets: this.relations.map((relation) => relation.poetId),
      relationLayerChildren: this.relationLayer?.children.length ?? -1,
      coreParticles: this.coreByPoet.size,
      labelsScheduled: this.labelDirty,
      camera: { ...this.camera },
      fitZoom: this.fitZoom,
      viewport: { ...this.viewport },
      tickerStarted: this.app?.ticker.started ?? false,
    };
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
