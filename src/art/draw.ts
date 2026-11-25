/** Shared 2D-canvas drawing helpers + palette for the hand-inked procedural art style. */
export type Ctx = CanvasRenderingContext2D;

export const INK = '#2b2430';
export const INK_SOFT = 'rgba(43,36,48,0.55)';

export const PAL = {
  waterDeep: '#1d5a63',
  waterMid: '#2a7a82',
  waterLight: '#4fa5a6',
  foam: '#e9f5ee',
  sand: '#e6cf9a',
  sandDark: '#cdb27a',
  sandWet: '#c9ae78',
  grass: '#6faa4a',
  grassDark: '#548a3a',
  grassLight: '#93c460',
  path: '#b98f5a',
  pathDark: '#9a7544',
  wood: '#a8794a',
  woodDark: '#7a5231',
  woodLight: '#c99a62',
  stone: '#9a9aa4',
  stoneDark: '#6e6e7a',
  stoneLight: '#c4c4cc',
  roofRed: '#b5503f',
  roofBlue: '#456f9a',
  roofTeal: '#2f7a78',
  plaster: '#efe2c3',
  leaf: '#4f9a45',
  leafDark: '#37713a',
  leafLight: '#7fc15a',
  soil: '#6b4a32',
  soilDark: '#523824',
  soilWet: '#3f2a1c'
} as const;

export const SKIN_TONES = ['#f6d3b3', '#e8b98f', '#d19a6c', '#a8704a', '#7c4e32', '#5a3826'];
export const HAIR_COLORS = ['#2a1f1a', '#5a3a22', '#8a5a2b', '#c28a3a', '#e6c46a', '#b8452f', '#7a7a86', '#4a6fa8'];
export const OUTFIT_COLORS = ['#3f7a9a', '#b5503f', '#5f9a4a', '#c9923a', '#7a5a9a', '#2f6f6a', '#d8d2c0', '#4a4a58'];

export function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Fast deterministic hash -> [0,1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Fill + ink outline for the current path. */
export function fillInk(ctx: Ctx, fill: string, lw = 1.5): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Slightly irregular blob (hand-drawn circle). */
export function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number, jitter = 0.08, n = 14): void {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 1 + (hash2(i % n, seed, 7) - 0.5) * 2 * jitter;
    const x = cx + Math.cos(a) * rx * j;
    const y = cy + Math.sin(a) * ry * j;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

export function softShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.28): void {
  ctx.save();
  ctx.fillStyle = `rgba(20,24,30,${alpha})`;
  ellipse(ctx, cx, cy, rx, ry);
  ctx.fill();
  ctx.restore();
}

export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, w = 1.5): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.stroke();
}
