import { INK, PAL, blob, ellipse, fillInk, hash2, line, mkCanvas, rr, shade, softShadow, type Ctx } from './draw';
import { TILE } from '../config/constants';
import { CROPS } from '../data/crops';

const mk = (w: number, h: number) => {
  const c = mkCanvas(w, h);
  return { c, g: c.getContext('2d')! as Ctx };
};

/** Tree: 64x96, trunk base centred at (32, 92). */
export function drawTree(variant: number): HTMLCanvasElement {
  const { c, g } = mk(64, 96);
  softShadow(g, 32, 90, 20, 5, 0.3);
  // trunk
  g.beginPath();
  g.moveTo(26, 92);
  g.quadraticCurveTo(28, 76, 27, 58);
  g.lineTo(37, 58);
  g.quadraticCurveTo(36, 76, 39, 92);
  g.closePath();
  fillInk(g, PAL.wood, 1.6);
  line(g, 31, 90, 31, 62, PAL.woodDark, 1.4);
  line(g, 34, 86, 34, 66, PAL.woodLight, 1.2);
  const greens = [
    [PAL.leaf, PAL.leafDark, PAL.leafLight],
    ['#5c9f4a', '#3d7a3c', '#8bc863'],
    ['#6aa84f', '#456f3a', '#a2cf68']
  ][variant % 3];
  // canopy: layered blobs
  const lumps: Array<[number, number, number, number]> =
    variant % 3 === 1
      ? [[32, 40, 24, 22], [20, 48, 14, 12], [44, 48, 14, 12], [32, 24, 15, 14]]
      : [[32, 38, 25, 24], [18, 46, 15, 13], [46, 46, 15, 13], [32, 22, 17, 15], [22, 30, 12, 11], [43, 30, 12, 11]];
  for (const [x, y, rx, ry] of lumps) {
    blob(g, x, y, rx, ry, x * 3 + y + variant, 0.07);
    fillInk(g, greens[0], 1.8);
  }
  // inner light and leaf strokes
  for (let i = 0; i < 14; i++) {
    const x = 12 + hash2(i, variant, 4) * 40;
    const y = 14 + hash2(i, variant, 5) * 40;
    line(g, x, y, x + 3, y - 2, greens[2], 1.6);
  }
  for (let i = 0; i < 8; i++) {
    const x = 14 + hash2(i, variant, 6) * 36;
    const y = 30 + hash2(i, variant, 7) * 26;
    line(g, x, y, x + 3, y + 1.5, greens[1], 1.6);
  }
  return c;
}

export function drawStump(): HTMLCanvasElement {
  const { c, g } = mk(32, 32);
  softShadow(g, 16, 27, 11, 3.5, 0.28);
  g.beginPath();
  rr(g, 8, 14, 16, 12, 3);
  fillInk(g, PAL.wood, 1.6);
  g.beginPath();
  ellipse(g, 16, 14, 8, 4);
  fillInk(g, PAL.woodLight, 1.6);
  g.strokeStyle = PAL.woodDark;
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(16, 14, 4.5, 2.2, 0, 0, Math.PI * 2);
  g.stroke();
  return c;
}

export function drawRock(variant: number): HTMLCanvasElement {
  const { c, g } = mk(32, 32);
  softShadow(g, 16, 27, 12, 3.5, 0.3);
  g.beginPath();
  if (variant === 0) {
    g.moveTo(4, 26);
    g.lineTo(6, 14);
    g.lineTo(13, 6);
    g.lineTo(22, 8);
    g.lineTo(28, 17);
    g.lineTo(27, 26);
  } else {
    g.moveTo(3, 26);
    g.lineTo(5, 17);
    g.lineTo(11, 11);
    g.lineTo(16, 4);
    g.lineTo(23, 10);
    g.lineTo(29, 19);
    g.lineTo(28, 26);
  }
  g.closePath();
  fillInk(g, PAL.stone, 1.8);
  g.beginPath();
  g.moveTo(8, 18);
  g.lineTo(12, 11);
  g.lineTo(17, 10);
  g.lineTo(14, 17);
  g.closePath();
  g.fillStyle = PAL.stoneLight;
  g.fill();
  line(g, 20, 14, 24, 24, PAL.stoneDark, 1.4);
  line(g, 10, 23, 17, 20, PAL.stoneDark, 1.2);
  return c;
}

export function drawBush(berries: boolean): HTMLCanvasElement {
  const { c, g } = mk(32, 32);
  softShadow(g, 16, 27, 12, 3.5, 0.28);
  for (const [x, y, rx, ry] of [[10, 19, 9, 8], [22, 19, 9, 8], [16, 14, 11, 10]] as const) {
    blob(g, x, y, rx, ry, x + y, 0.07);
    fillInk(g, PAL.leaf, 1.6);
  }
  for (let i = 0; i < 6; i++) line(g, 8 + i * 3, 14 + (i % 2) * 5, 10 + i * 3, 12 + (i % 2) * 5, PAL.leafLight, 1.4);
  if (berries) {
    for (const [x, y] of [[9, 20], [16, 11], [22, 18], [14, 22], [24, 23]] as const) {
      g.beginPath();
      g.arc(x, y, 2.4, 0, Math.PI * 2);
      fillInk(g, '#c7385a', 1.2);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(x - 1, y - 1.2, 1, 1);
    }
  }
  return c;
}

export function drawShell(variant: number): HTMLCanvasElement {
  const { c, g } = mk(32, 32);
  softShadow(g, 16, 22, 6, 2, 0.2);
  g.save();
  g.translate(16, 17);
  g.rotate(variant ? 0.5 : -0.3);
  g.beginPath();
  g.moveTo(-7, 4);
  g.quadraticCurveTo(-8, -7, 0, -8);
  g.quadraticCurveTo(8, -7, 7, 4);
  g.quadraticCurveTo(0, 7, -7, 4);
  fillInk(g, variant ? '#f1c9c0' : '#f3e2c4', 1.5);
  for (let i = -2; i <= 2; i++) line(g, i * 2.4, 4, i * 1.6, -6, 'rgba(160,110,90,0.7)', 1);
  g.restore();
  // sparkle so they read on sand
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(22, 8, 1.6, 1.6);
  return c;
}

/** Three flame frames side by side: 96x32. */
export function drawCampfire(): HTMLCanvasElement {
  const { c, g } = mk(96, 40);
  for (let f = 0; f < 3; f++) {
    const ox = f * 32;
    softShadow(g, ox + 16, 33, 12, 3.5, 0.3);
    for (const a of [-0.5, 0.5]) {
      g.save();
      g.translate(ox + 16, 30);
      g.rotate(a);
      g.beginPath();
      rr(g, -10, -3, 20, 6, 3);
      fillInk(g, PAL.woodDark, 1.4);
      g.restore();
    }
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(ox + 5 + i * 4.4, 31 + (i % 2), 2.6, 0, Math.PI * 2);
      fillInk(g, PAL.stone, 1.1);
    }
    const h = 14 + f * 2 - (f === 2 ? 3 : 0);
    g.beginPath();
    g.moveTo(ox + 9, 28);
    g.quadraticCurveTo(ox + 10 + f, 14, ox + 16, 28 - h);
    g.quadraticCurveTo(ox + 22 - f, 14, ox + 23, 28);
    g.closePath();
    fillInk(g, '#f08a2b', 1.4);
    g.beginPath();
    g.moveTo(ox + 12, 28);
    g.quadraticCurveTo(ox + 14, 20, ox + 16, 28 - h * 0.65);
    g.quadraticCurveTo(ox + 18, 20, ox + 20, 28);
    g.closePath();
    g.fillStyle = '#ffd35a';
    g.fill();
  }
  return c;
}

export function drawStandingStone(): HTMLCanvasElement {
  const { c, g } = mk(48, 80);
  softShadow(g, 24, 74, 17, 4.5, 0.3);
  g.beginPath();
  g.moveTo(10, 74);
  g.lineTo(12, 22);
  g.quadraticCurveTo(24, 2, 36, 22);
  g.lineTo(38, 74);
  g.closePath();
  fillInk(g, '#8d8f98', 1.9);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(14, 22, 5, 48);
  // moss
  for (let i = 0; i < 8; i++) {
    blob(g, 12 + hash2(i, 1, 2) * 24, 52 + hash2(i, 2, 2) * 20, 5, 3.2, i, 0.15);
    g.fillStyle = 'rgba(86,140,72,0.85)';
    g.fill();
  }
  // spiral carving
  g.strokeStyle = '#4a4e5e';
  g.lineWidth = 2;
  g.beginPath();
  for (let a = 0; a < 15; a += 0.3) {
    const r = 1 + a * 0.9;
    const x = 24 + Math.cos(a) * r;
    const y = 36 + Math.sin(a) * r * 1.1;
    if (a === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = 'rgba(120,230,220,0.9)';
  g.beginPath();
  g.arc(24, 36, 2, 0, Math.PI * 2);
  g.fill();
  return c;
}

export function drawWorkbench(): HTMLCanvasElement {
  const { c, g } = mk(48, 40);
  softShadow(g, 24, 35, 19, 4, 0.28);
  for (const x of [8, 36]) {
    g.beginPath();
    rr(g, x, 18, 5, 17, 1.5);
    fillInk(g, PAL.woodDark, 1.4);
  }
  g.beginPath();
  rr(g, 3, 10, 42, 11, 3);
  fillInk(g, PAL.wood, 1.6);
  line(g, 6, 14, 42, 14, PAL.woodLight, 1.3);
  // saw + hammer
  g.beginPath();
  g.moveTo(10, 9);
  g.lineTo(26, 9);
  g.lineTo(26, 5);
  g.closePath();
  fillInk(g, '#c4c4cc', 1.2);
  g.beginPath();
  rr(g, 31, 3, 5, 8, 1);
  fillInk(g, PAL.stone, 1.2);
  line(g, 35, 8, 41, 4, PAL.woodDark, 2);
  return c;
}

/* ------------------------------------------------------------------ buildings */

function roof(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  g.beginPath();
  g.moveTo(x - 6, y + h);
  g.lineTo(x + w * 0.12, y);
  g.lineTo(x + w * 0.88, y);
  g.lineTo(x + w + 6, y + h);
  g.closePath();
  fillInk(g, color, 2);
  for (let i = 1; i < 6; i++) line(g, x - 6 + (w + 12) * (i / 6) * 0.95, y + h, x + w * 0.12 + (w * 0.76) * (i / 6), y, shade(color, -30), 1.3);
  line(g, x - 4, y + h - 3, x + w + 4, y + h - 3, shade(color, 25), 1.5);
}

function window_(g: Ctx, x: number, y: number, w = 14, h = 14): void {
  g.beginPath();
  rr(g, x, y, w, h, 2);
  fillInk(g, '#ffe9a8', 1.6);
  line(g, x + w / 2, y, x + w / 2, y + h, INK, 1.2);
  line(g, x, y + h / 2, x + w, y + h / 2, INK, 1.2);
}

function door(g: Ctx, x: number, y: number, w = 20, h = 28): void {
  g.beginPath();
  rr(g, x, y, w, h, 3);
  fillInk(g, PAL.woodDark, 1.8);
  g.beginPath();
  g.arc(x + w - 5, y + h * 0.55, 1.6, 0, Math.PI * 2);
  g.fillStyle = '#f2c14e';
  g.fill();
}

/** Cabin footprint 4x3 tiles → canvas 128 x 128 (extra 32px of roof above). Origin bottom-left. */
export function drawCabin(): HTMLCanvasElement {
  const { c, g } = mk(4 * TILE, 4 * TILE);
  softShadow(g, 64, 122, 58, 6, 0.26);
  g.beginPath();
  rr(g, 8, 52, 112, 70, 4);
  fillInk(g, PAL.plaster, 2);
  for (let i = 0; i < 6; i++) line(g, 8, 62 + i * 10, 120, 62 + i * 10, 'rgba(160,125,80,0.35)', 1.2);
  // timber frame
  for (const x of [8, 62, 118]) line(g, x, 52, x, 122, PAL.woodDark, 4);
  line(g, 8, 80, 120, 80, PAL.woodDark, 3);
  roof(g, 8, 6, 112, 50, PAL.roofRed);
  window_(g, 18, 86);
  window_(g, 104, 86);
  door(g, 68, 90, 24, 32);
  // chimney
  g.beginPath();
  rr(g, 90, -2, 12, 24, 2);
  fillInk(g, PAL.stoneDark, 1.6);
  return c;
}

/** Shop footprint 5x3 → 160x128. */
export function drawShop(): HTMLCanvasElement {
  const { c, g } = mk(5 * TILE, 4 * TILE);
  softShadow(g, 80, 122, 72, 6, 0.26);
  g.beginPath();
  rr(g, 8, 50, 144, 72, 4);
  fillInk(g, '#e7d4a6', 2);
  for (const x of [8, 80, 152]) line(g, x, 50, x, 122, PAL.woodDark, 4);
  roof(g, 6, 4, 148, 50, PAL.roofBlue);
  // striped awning
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.moveTo(14 + i * 16, 70);
    g.lineTo(30 + i * 16, 70);
    g.lineTo(28 + i * 16, 82);
    g.lineTo(12 + i * 16, 82);
    g.closePath();
    fillInk(g, i % 2 ? '#f4ead0' : '#c9533f', 1.2);
  }
  window_(g, 20, 90, 18, 16);
  window_(g, 122, 90, 18, 16);
  door(g, 68, 88, 24, 34);
  // sign
  g.beginPath();
  rr(g, 56, 52, 48, 14, 3);
  fillInk(g, PAL.woodLight, 1.6);
  g.fillStyle = INK;
  g.font = 'bold 10px sans-serif';
  g.textAlign = 'center';
  g.fillText('GENERAL', 80, 62);
  return c;
}

/** Lighthouse footprint 2x3 → 64 x 224 (tall). */
export function drawLighthouse(): HTMLCanvasElement {
  const { c, g } = mk(2 * TILE, 7 * TILE);
  softShadow(g, 32, 218, 28, 5, 0.28);
  // tower, tapering
  g.beginPath();
  g.moveTo(8, 214);
  g.lineTo(16, 56);
  g.lineTo(48, 56);
  g.lineTo(56, 214);
  g.closePath();
  fillInk(g, '#f1ead8', 2);
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(10 + i * 0.1 - (i % 2 ? 0 : 0), 190 - i * 44);
    g.lineTo(54, 190 - i * 44);
    g.lineTo(53 - 0.8, 190 - i * 44 - 22);
    g.lineTo(11 + 0.8, 190 - i * 44 - 22);
    g.closePath();
    g.fillStyle = i % 2 === 0 ? '#c9533f' : 'rgba(0,0,0,0)';
    g.fill();
  }
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(8, 214);
  g.lineTo(16, 56);
  g.lineTo(48, 56);
  g.lineTo(56, 214);
  g.closePath();
  g.stroke();
  door(g, 10, 186, 20, 28);
  window_(g, 30, 130, 12, 14);
  // gallery
  g.beginPath();
  rr(g, 10, 46, 44, 12, 3);
  fillInk(g, PAL.stoneDark, 1.8);
  // lamp room
  g.beginPath();
  rr(g, 18, 22, 28, 26, 4);
  fillInk(g, '#ffe7a0', 1.8);
  line(g, 32, 22, 32, 48, INK, 1.4);
  // roof cap
  g.beginPath();
  g.moveTo(14, 24);
  g.lineTo(32, 4);
  g.lineTo(50, 24);
  g.closePath();
  fillInk(g, PAL.roofRed, 2);
  return c;
}

/** Mira's hut footprint 3x3 → 96x128. */
export function drawHut(): HTMLCanvasElement {
  const { c, g } = mk(3 * TILE, 4 * TILE);
  softShadow(g, 48, 122, 44, 5, 0.26);
  g.beginPath();
  rr(g, 6, 58, 84, 64, 4);
  fillInk(g, '#d9c297', 2);
  for (let i = 0; i < 5; i++) line(g, 6, 68 + i * 11, 90, 68 + i * 11, 'rgba(120,90,50,0.4)', 1.4);
  roof(g, 4, 14, 88, 48, PAL.roofTeal);
  window_(g, 14, 84, 12, 12);
  door(g, 38, 90, 22, 32);
  // hanging shells
  for (let i = 0; i < 4; i++) {
    line(g, 62 + i * 6, 62, 62 + i * 6, 72 + (i % 2) * 4, '#eee', 1);
    g.beginPath();
    g.arc(62 + i * 6, 76 + (i % 2) * 4, 2.6, 0, Math.PI * 2);
    fillInk(g, '#f3e2c4', 1);
  }
  return c;
}

/* ------------------------------------------------------------------ crops */

/** Atlas: columns = stages 0..4, rows = crops (in CROP_ORDER). Each cell 32x32. */
export const CROP_ORDER = Object.keys(CROPS);

export function drawCropAtlas(): HTMLCanvasElement {
  const { c, g } = mk(5 * 32, CROP_ORDER.length * 32);
  CROP_ORDER.forEach((id, row) => {
    const { leaf, fruit } = CROPS[id].colors;
    for (let st = 0; st < 5; st++) {
      const ox = st * 32;
      const oy = row * 32;
      const base = oy + 27;
      if (st === 0) {
        g.fillStyle = '#4a3320';
        g.beginPath();
        g.ellipse(ox + 16, base - 1, 4, 2, 0, 0, Math.PI * 2);
        g.fill();
        line(g, ox + 16, base - 2, ox + 16, base - 6, leaf, 2);
      } else {
        const h = 6 + st * 4;
        line(g, ox + 16, base, ox + 16, base - h, shade(leaf, -30), 2.4);
        const leaves = 1 + st;
        for (let i = 0; i < leaves; i++) {
          const side = i % 2 ? 1 : -1;
          const ly = base - 4 - i * (h / (leaves + 0.5));
          g.beginPath();
          g.ellipse(ox + 16 + side * (4 + st), ly, 4 + st * 0.8, 2.4 + st * 0.3, side * -0.5, 0, Math.PI * 2);
          fillInk(g, leaf, 1.2);
        }
      }
      if (st === 4) {
        // mature: show the harvestable
        if (id === 'turnip') {
          g.beginPath();
          g.arc(ox + 16, base - 3, 6, 0, Math.PI * 2);
          fillInk(g, fruit, 1.4);
          g.fillStyle = '#b79ad6';
          g.beginPath();
          g.arc(ox + 16, base - 7, 4.5, Math.PI, 0);
          g.fill();
        } else if (id === 'tomato') {
          for (const [x, y] of [[-6, -10], [6, -14], [-4, -18], [5, -6]] as const) {
            g.beginPath();
            g.arc(ox + 16 + x, base + y, 3.6, 0, Math.PI * 2);
            fillInk(g, fruit, 1.2);
          }
        } else if (id === 'pumpkin') {
          g.beginPath();
          ellipse(g, ox + 16, base - 5, 9, 7);
          fillInk(g, fruit, 1.5);
          for (const k of [-4, 0, 4]) line(g, ox + 16 + k, base - 11, ox + 16 + k * 1.3, base + 1, shade(fruit, -40), 1.2);
          line(g, ox + 16, base - 12, ox + 17, base - 15, '#4a7a35', 2);
        } else {
          for (const [x, y] of [[-5, -8], [5, -12], [0, -17]] as const) {
            g.beginPath();
            g.ellipse(ox + 16 + x, base + y, 3, 6, x * 0.08, 0, Math.PI * 2);
            fillInk(g, fruit, 1.2);
          }
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.fillRect(ox + 21, oy + 8, 1.6, 1.6);
        }
      }
    }
  });
  return c;
}

/* ------------------------------------------------------------------ misc sprites */

export function drawDot(): HTMLCanvasElement {
  const { c, g } = mk(8, 8);
  const grd = g.createRadialGradient(4, 4, 0, 4, 4, 4);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 8);
  return c;
}

export function drawRaindrop(): HTMLCanvasElement {
  const { c, g } = mk(4, 16);
  g.strokeStyle = 'rgba(210,235,255,0.9)';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(2, 1);
  g.lineTo(2, 15);
  g.stroke();
  return c;
}

export function drawLeaf(): HTMLCanvasElement {
  const { c, g } = mk(10, 10);
  g.beginPath();
  g.ellipse(5, 5, 4, 2.2, 0.6, 0, Math.PI * 2);
  g.fillStyle = '#8bc863';
  g.fill();
  return c;
}

export function drawGlow(): HTMLCanvasElement {
  const { c, g } = mk(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,214,130,0.95)');
  grd.addColorStop(0.4, 'rgba(255,190,100,0.45)');
  grd.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export function drawExclaim(): HTMLCanvasElement {
  const { c, g } = mk(24, 32);
  g.beginPath();
  rr(g, 6, 2, 12, 20, 6);
  fillInk(g, '#ffe27a', 2);
  g.fillStyle = INK;
  g.fillRect(10.8, 6, 2.6, 8);
  g.beginPath();
  g.arc(12, 17.5, 1.7, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Small speech-bubble marker used above NPCs with something to say. */
export function drawTalkMark(): HTMLCanvasElement {
  const { c, g } = mk(24, 24);
  g.beginPath();
  rr(g, 2, 2, 20, 14, 6);
  fillInk(g, '#fffaf0', 1.8);
  g.beginPath();
  g.moveTo(8, 15);
  g.lineTo(6, 21);
  g.lineTo(13, 15);
  fillInk(g, '#fffaf0', 1.4);
  g.fillStyle = INK;
  for (const x of [8, 12, 16]) {
    g.beginPath();
    g.arc(x, 9, 1.4, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}
