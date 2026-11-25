import { MAP_H, MAP_W, T, idx, inBounds, type IslandData } from '../world/WorldData';
import { PAL, hash2, line, mkCanvas, shade, type Ctx } from './draw';
import { TILE } from '../config/constants';

/** Seamless 64x64 water tile (two variants: base + highlights). */
export function drawWaterBase(): HTMLCanvasElement {
  const c = mkCanvas(128, 128);
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, PAL.waterMid);
  grd.addColorStop(1, PAL.waterDeep);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  // soft darker patches
  for (let i = 0; i < 26; i++) {
    const x = hash2(i, 1, 3) * 128;
    const y = hash2(i, 2, 3) * 128;
    const r = 10 + hash2(i, 3, 3) * 18;
    for (const ox of [-128, 0, 128])
      for (const oy of [-128, 0, 128]) {
        g.fillStyle = 'rgba(20,70,80,0.12)';
        g.beginPath();
        g.ellipse(x + ox, y + oy, r, r * 0.6, 0, 0, Math.PI * 2);
        g.fill();
      }
  }
  return c;
}

export function drawWaterHighlights(): HTMLCanvasElement {
  const c = mkCanvas(128, 128);
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const x = hash2(i, 5, 9) * 128;
    const y = hash2(i, 6, 9) * 128;
    const w = 8 + hash2(i, 7, 9) * 16;
    for (const ox of [-128, 0, 128])
      for (const oy of [-128, 0, 128]) {
        g.strokeStyle = i % 3 === 0 ? 'rgba(233,245,238,0.55)' : 'rgba(150,215,210,0.4)';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x + ox - w / 2, y + oy);
        g.quadraticCurveTo(x + ox, y + oy - 3, x + ox + w / 2, y + oy);
        g.stroke();
      }
  }
  return c;
}

function grassTile(g: Ctx, x: number, y: number, tx: number, ty: number): void {
  const v = hash2(tx, ty, 1);
  g.fillStyle = v < 0.33 ? PAL.grass : v < 0.66 ? shade(PAL.grass, -5) : shade(PAL.grass, 6);
  g.fillRect(x, y, TILE, TILE);
  // blades
  for (let i = 0; i < 5; i++) {
    const bx = x + 3 + hash2(tx, ty, 10 + i) * (TILE - 6);
    const by = y + 6 + hash2(tx, ty, 20 + i) * (TILE - 8);
    const h = 3 + hash2(tx, ty, 30 + i) * 4;
    line(g, bx, by, bx + (hash2(tx, ty, 40 + i) - 0.5) * 3, by - h, i % 2 ? PAL.grassLight : PAL.grassDark, 1.3);
  }
  // little flowers
  if (hash2(tx, ty, 99) < 0.07) {
    const fx = x + 6 + hash2(tx, ty, 98) * 20;
    const fy = y + 6 + hash2(tx, ty, 97) * 20;
    g.fillStyle = ['#f6f1da', '#f3d65a', '#e98fa9', '#9fc8ee'][Math.floor(hash2(tx, ty, 96) * 4)];
    g.beginPath();
    g.arc(fx, fy, 1.8, 0, Math.PI * 2);
    g.fill();
  }
}

function sandTile(g: Ctx, x: number, y: number, tx: number, ty: number): void {
  const v = hash2(tx, ty, 2);
  g.fillStyle = v < 0.5 ? PAL.sand : shade(PAL.sand, -6);
  g.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? 'rgba(160,130,80,0.35)' : 'rgba(255,248,225,0.5)';
    g.fillRect(x + hash2(tx, ty, 50 + i) * 30, y + hash2(tx, ty, 60 + i) * 30, 1.6, 1.6);
  }
}

function pathTile(g: Ctx, x: number, y: number, tx: number, ty: number): void {
  g.fillStyle = hash2(tx, ty, 3) < 0.5 ? PAL.path : shade(PAL.path, -7);
  g.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 5; i++) {
    const px = x + 3 + hash2(tx, ty, 70 + i) * 26;
    const py = y + 3 + hash2(tx, ty, 80 + i) * 26;
    g.fillStyle = i % 2 ? PAL.pathDark : 'rgba(255,235,200,0.45)';
    g.beginPath();
    g.ellipse(px, py, 2.2, 1.5, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function pierTile(g: Ctx, x: number, y: number): void {
  g.fillStyle = PAL.wood;
  g.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? PAL.woodLight : PAL.wood;
    g.fillRect(x, y + i * 8, TILE, 7);
    line(g, x, y + i * 8 + 7.5, x + TILE, y + i * 8 + 7.5, PAL.woodDark, 1.2);
  }
  g.fillStyle = PAL.woodDark;
  g.fillRect(x + 1, y, 3, TILE);
  g.fillRect(x + TILE - 4, y, 3, TILE);
}

/** Renders the whole island's ground (land only; water stays transparent) into a single canvas. */
export function drawIslandTerrain(island: IslandData): HTMLCanvasElement {
  const c = mkCanvas(MAP_W * TILE, MAP_H * TILE);
  const g = c.getContext('2d')!;
  const t = island.terrain;

  // Shoreline shadow beneath land edge, drawn first so land sits on top.
  g.fillStyle = 'rgba(15,50,55,0.28)';
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const k = t[idx(x, y)];
      if (k === T.Water) continue;
      g.fillRect(x * TILE - 3, y * TILE - 1, TILE + 6, TILE + 6);
    }

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const k = t[idx(x, y)];
      const px = x * TILE;
      const py = y * TILE;
      if (k === T.Grass) grassTile(g, px, py, x, y);
      else if (k === T.Sand) sandTile(g, px, py, x, y);
      else if (k === T.Path) pathTile(g, px, py, x, y);
      else if (k === T.Pier) pierTile(g, px, py);
    }
  }

  // Wet-sand band + foam along every edge that touches water.
  const isWater = (x: number, y: number) => !inBounds(x, y) || t[idx(x, y)] === T.Water;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const k = t[idx(x, y)];
      if (k === T.Water || k === T.Pier) continue;
      const px = x * TILE;
      const py = y * TILE;
      const sides: Array<[boolean, number, number, number, number]> = [
        [isWater(x, y - 1), px, py, TILE, 0],
        [isWater(x, y + 1), px, py + TILE, TILE, 0],
        [isWater(x - 1, y), px, py, 0, TILE],
        [isWater(x + 1, y), px + TILE, py, 0, TILE]
      ];
      for (const [wet, sx, sy, dx, dy] of sides) {
        if (!wet) continue;
        g.save();
        g.strokeStyle = 'rgba(160,130,80,0.5)';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(sx + (dy ? (sx === px ? 2.5 : -2.5) : 0), sy + (dx ? (sy === py ? 2.5 : -2.5) : 0));
        g.lineTo(sx + dx + (dy ? (sx === px ? 2.5 : -2.5) : 0), sy + dy + (dx ? (sy === py ? 2.5 : -2.5) : 0));
        g.stroke();
        g.strokeStyle = 'rgba(233,245,238,0.9)';
        g.lineWidth = 2;
        g.setLineDash([5 + hash2(x, y, 5) * 4, 3]);
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx + dx, sy + dy);
        g.stroke();
        g.restore();
      }
    }
  }
  return c;
}

/** Tilled soil (dry/wet) and tile cursor. Each 32x32. */
export function drawSoil(wet: boolean): HTMLCanvasElement {
  const c = mkCanvas(TILE, TILE);
  const g = c.getContext('2d')!;
  g.fillStyle = wet ? PAL.soilWet : PAL.soil;
  g.fillRect(1, 1, TILE - 2, TILE - 2);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = wet ? '#2e1e14' : PAL.soilDark;
    g.fillRect(3, 5 + i * 7, TILE - 6, 3);
    g.fillStyle = wet ? 'rgba(120,170,200,0.25)' : 'rgba(255,225,180,0.2)';
    g.fillRect(3, 4 + i * 7, TILE - 6, 1.2);
  }
  g.strokeStyle = wet ? '#2a1a10' : '#46301f';
  g.lineWidth = 1.5;
  g.strokeRect(1.5, 1.5, TILE - 3, TILE - 3);
  return c;
}

export function drawCursor(): HTMLCanvasElement {
  const c = mkCanvas(TILE, TILE);
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(255,248,220,0.95)';
  g.lineWidth = 2.5;
  const L = 8;
  for (const [x, y, sx, sy] of [[3, 3, 1, 1], [TILE - 3, 3, -1, 1], [3, TILE - 3, 1, -1], [TILE - 3, TILE - 3, -1, -1]] as const) {
    g.beginPath();
    g.moveTo(x + sx * L, y);
    g.lineTo(x, y);
    g.lineTo(x, y + sy * L);
    g.stroke();
  }
  return c;
}
