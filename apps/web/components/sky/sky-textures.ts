import { Texture } from 'pixi.js';

import { mulberry32 } from '@shihe/sky-layout';

/**
 * 程序化生成星图纹理，避免额外美术资源与网络请求。
 * 全部使用 Canvas 2D 一次性生成，再交给 PixiJS GPU 批量绘制。
 */

function createCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 2D，无法生成星图纹理。');
  return { canvas, ctx };
}

let coreTexture: Texture | null = null;
let glowTexture: Texture | null = null;
let nebulaTextures: Texture[] | null = null;
let starfieldTextures: Texture[] | null = null;

/** 核心星光：紧凑的高亮核心 + 柔和边缘。 */
export function getStarCoreTexture(): Texture {
  if (coreTexture) return coreTexture;
  const size = 64;
  const { canvas, ctx } = createCanvas(size);
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.08, 'rgba(255,252,240,1)');
  gradient.addColorStop(0.16, 'rgba(255,240,205,0.95)');
  gradient.addColorStop(0.32, 'rgba(246,214,155,0.55)');
  gradient.addColorStop(0.6, 'rgba(228,185,120,0.12)');
  gradient.addColorStop(1, 'rgba(220,180,120,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  coreTexture = Texture.from(canvas);
  return coreTexture;
}

/** 光晕：更大范围的柔和金光，配合 additive 混合。 */
export function getStarGlowTexture(): Texture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const { canvas, ctx } = createCanvas(size);
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, size / 2);
  gradient.addColorStop(0, 'rgba(255,239,205,0.66)');
  gradient.addColorStop(0.14, 'rgba(252,219,158,0.4)');
  gradient.addColorStop(0.34, 'rgba(240,192,118,0.16)');
  gradient.addColorStop(0.62, 'rgba(226,172,98,0.05)');
  gradient.addColorStop(1, 'rgba(210,160,90,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTexture = Texture.from(canvas);
  return glowTexture;
}

/** 带星芒的星点，用于少量亮星点缀。 */
function createSparkleTexture(): Texture {
  const size = 96;
  const { canvas, ctx } = createCanvas(size);
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.05, 'rgba(255,250,235,0.95)');
  gradient.addColorStop(0.2, 'rgba(250,228,180,0.35)');
  gradient.addColorStop(0.55, 'rgba(230,190,130,0.06)');
  gradient.addColorStop(1, 'rgba(220,180,120,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,240,210,0.4)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(center - size * 0.42, center);
  ctx.lineTo(center + size * 0.42, center);
  ctx.moveTo(center, center - size * 0.4);
  ctx.lineTo(center, center + size * 0.4);
  ctx.stroke();
  return Texture.from(canvas);
}

/**
 * 生成 4 张星云纹理（不同随机种子），用 additive 与色调渲染星域光雾。
 */
export function getNebulaTextures(): Texture[] {
  if (nebulaTextures) return nebulaTextures;
  nebulaTextures = [0, 1, 2, 3].map((seed) => {
    const size = 320;
    const { canvas, ctx } = createCanvas(size);
    const random = mulberry32(9001 + seed * 77);
    ctx.clearRect(0, 0, size, size);
    for (let index = 0; index < 46; index += 1) {
      const x = size * (0.18 + random() * 0.64);
      const y = size * (0.2 + random() * 0.6);
      const radius = size * (0.04 + random() * 0.18);
      const alpha = 0.018 + random() * 0.045;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // 细碎尘点
    for (let index = 0; index < 220; index += 1) {
      const x = random() * size;
      const y = random() * size;
      const alpha = 0.05 + random() * 0.2;
      ctx.fillStyle = `rgba(255,246,226,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, random() * 0.9 + 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = Texture.from(canvas);
    texture.source.addressMode = 'clamp-to-edge';
    return texture;
  });
  return nebulaTextures;
}

/**
 * 背景装饰星野纹理（可平铺）。分远近两层以形成视差。
 */
export function getStarfieldTexture(layer: 'far' | 'near'): Texture {
  if (!starfieldTextures) {
    starfieldTextures = [makeStarfield('far'), makeStarfield('near')];
  }
  return layer === 'far' ? starfieldTextures[0]! : starfieldTextures[1]!;
}

function makeStarfield(layer: 'far' | 'near'): Texture {
  const size = 512;
  const { canvas, ctx } = createCanvas(size);
  const random = mulberry32(layer === 'far' ? 20260101 : 20260102);
  const count = layer === 'far' ? 420 : 150;
  for (let index = 0; index < count; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = layer === 'far' ? 0.25 + random() * 0.85 : 0.4 + random() * 1.15;
    const alpha = layer === 'far' ? 0.18 + random() * 0.45 : 0.2 + random() * 0.6;
    const warm = random() > 0.45;
    ctx.fillStyle = warm ? `rgba(240,222,186,${alpha})` : `rgba(185,205,230,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (layer === 'near' && random() > 0.82) {
      ctx.strokeStyle = `rgba(245,231,201,${alpha * 0.6})`;
      ctx.lineWidth = 0.6;
      const arm = radius * 4.2;
      ctx.beginPath();
      ctx.moveTo(x - arm, y);
      ctx.lineTo(x + arm, y);
      ctx.moveTo(x, y - arm);
      ctx.lineTo(x, y + arm);
      ctx.stroke();
    }
  }
  const texture = Texture.from(canvas);
  texture.source.addressMode = 'repeat';
  return texture;
}

/** 供测试或动态装饰星使用。 */
export function createSparkleForTest(): Texture {
  return createSparkleTexture();
}
