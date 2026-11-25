import { INK, PAL, blob, ellipse, fillInk, line, mkCanvas, rr, shade, type Ctx } from './draw';
import { ITEMS } from '../data/items';
import { CROPS } from '../data/crops';

type Painter = (g: Ctx) => void;

const handle = (g: Ctx, x1: number, y1: number, x2: number, y2: number) => {
  line(g, x1, y1, x2, y2, INK, 5);
  line(g, x1, y1, x2, y2, PAL.wood, 3);
};

const seedPacket = (color: string): Painter => (g) => {
  g.beginPath();
  rr(g, 8, 6, 16, 21, 3);
  fillInk(g, '#efe2c3', 1.8);
  g.fillStyle = color;
  g.fillRect(9, 11, 14, 8);
  g.beginPath();
  g.arc(16, 15, 3, 0, Math.PI * 2);
  g.fillStyle = shade(color, 45);
  g.fill();
  line(g, 10, 8.5, 22, 8.5, INK, 1.2);
};

const fish = (body: string, glow = false): Painter => (g) => {
  if (glow) {
    g.fillStyle = 'rgba(120,255,230,0.3)';
    g.beginPath();
    g.arc(16, 16, 13, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.moveTo(5, 16);
  g.quadraticCurveTo(13, 6, 23, 13);
  g.lineTo(28, 8);
  g.lineTo(28, 24);
  g.lineTo(23, 19);
  g.quadraticCurveTo(13, 26, 5, 16);
  fillInk(g, body, 1.8);
  g.fillStyle = INK;
  g.beginPath();
  g.arc(10, 14, 1.5, 0, Math.PI * 2);
  g.fill();
  line(g, 15, 12, 17, 20, shade(body, -40), 1.3);
};

const PAINT: Record<string, Painter> = {
  hoe: (g) => {
    handle(g, 7, 27, 22, 8);
    g.beginPath();
    g.moveTo(18, 5);
    g.lineTo(28, 8);
    g.lineTo(24, 14);
    g.lineTo(20, 10);
    g.closePath();
    fillInk(g, PAL.stone, 1.6);
  },
  can: (g) => {
    g.beginPath();
    rr(g, 7, 12, 15, 14, 3);
    fillInk(g, '#5f9ac0', 1.8);
    g.beginPath();
    g.moveTo(21, 15);
    g.lineTo(29, 8);
    g.lineTo(30, 11);
    g.lineTo(22, 20);
    g.closePath();
    fillInk(g, '#4f86ac', 1.5);
    g.beginPath();
    g.arc(14, 11, 6, Math.PI, 0);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.stroke();
    line(g, 9, 16, 19, 16, 'rgba(255,255,255,0.4)', 1.5);
  },
  axe: (g) => {
    handle(g, 7, 28, 20, 8);
    g.beginPath();
    g.moveTo(14, 6);
    g.quadraticCurveTo(26, 4, 28, 14);
    g.lineTo(21, 15);
    g.quadraticCurveTo(18, 10, 14, 6);
    fillInk(g, PAL.stoneLight, 1.7);
  },
  pick: (g) => {
    handle(g, 8, 28, 20, 10);
    g.beginPath();
    g.moveTo(5, 12);
    g.quadraticCurveTo(18, 0, 29, 12);
    g.lineTo(26, 14);
    g.quadraticCurveTo(18, 7, 8, 15);
    g.closePath();
    fillInk(g, PAL.stoneLight, 1.7);
  },
  rod: (g) => {
    line(g, 6, 28, 26, 5, INK, 4.5);
    line(g, 6, 28, 26, 5, PAL.woodLight, 2.6);
    g.strokeStyle = INK;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(26, 5);
    g.quadraticCurveTo(30, 16, 24, 24);
    g.stroke();
    g.beginPath();
    g.arc(24, 25, 2.2, 0, Math.PI * 2);
    fillInk(g, '#d9473f', 1.2);
  },
  seed_turnip: seedPacket('#b79ad6'),
  seed_tomato: seedPacket('#e24b3a'),
  seed_pumpkin: seedPacket('#e88a1f'),
  seed_frostleaf: seedPacket('#7fd0d8'),
  turnip: (g) => {
    g.beginPath();
    g.arc(16, 19, 8.5, 0, Math.PI * 2);
    fillInk(g, '#efe9f6', 1.8);
    g.fillStyle = '#b79ad6';
    g.beginPath();
    g.arc(16, 15, 7.5, Math.PI * 1.05, Math.PI * 1.95);
    g.fill();
    for (const a of [-0.5, 0, 0.5]) line(g, 16, 11, 16 + a * 12, 3, PAL.leaf, 3);
  },
  tomato: (g) => {
    g.beginPath();
    g.arc(16, 18, 9, 0, Math.PI * 2);
    fillInk(g, '#e24b3a', 1.8);
    g.fillStyle = '#4f9a45';
    g.beginPath();
    g.moveTo(16, 10);
    g.lineTo(11, 7);
    g.lineTo(14, 11);
    g.lineTo(10, 12);
    g.lineTo(16, 12);
    g.lineTo(22, 12);
    g.lineTo(18, 11);
    g.lineTo(21, 7);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(11, 15, 3, 3);
  },
  pumpkin: (g) => {
    g.beginPath();
    ellipse(g, 16, 19, 11, 8.5);
    fillInk(g, '#e88a1f', 1.8);
    for (const k of [-5, 0, 5]) line(g, 16 + k, 11.5, 16 + k * 1.4, 27, shade('#e88a1f', -45), 1.3);
    line(g, 16, 11, 18, 5, '#4a7a35', 3);
  },
  frostleaf: (g) => {
    g.beginPath();
    g.moveTo(16, 4);
    g.quadraticCurveTo(28, 14, 16, 28);
    g.quadraticCurveTo(4, 14, 16, 4);
    fillInk(g, '#9fe3ea', 1.8);
    line(g, 16, 7, 16, 26, '#e9fbff', 1.6);
    g.fillStyle = '#fff';
    g.fillRect(20, 10, 2, 2);
  },
  wood: (g) => {
    g.save();
    g.translate(16, 17);
    g.rotate(-0.5);
    g.beginPath();
    rr(g, -12, -5, 24, 10, 3);
    fillInk(g, PAL.wood, 1.8);
    g.beginPath();
    ellipse(g, 11, 0, 3, 5);
    fillInk(g, PAL.woodLight, 1.3);
    line(g, -9, -2, 7, -2, PAL.woodDark, 1);
    g.restore();
  },
  stone: (g) => {
    g.beginPath();
    g.moveTo(5, 24);
    g.lineTo(7, 13);
    g.lineTo(15, 7);
    g.lineTo(25, 11);
    g.lineTo(28, 24);
    g.closePath();
    fillInk(g, PAL.stone, 1.8);
    line(g, 10, 14, 15, 10, PAL.stoneLight, 2);
  },
  fiber: (g) => {
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = i % 2 ? '#a9bf5a' : '#7fa044';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(8 + i * 3.5, 26);
      g.quadraticCurveTo(10 + i * 3, 14, 6 + i * 5, 6);
      g.stroke();
    }
    line(g, 6, 20, 26, 20, '#8a6a3a', 2);
  },
  copper_ore: (g) => {
    PAINT.stone(g);
    for (const [x, y] of [[13, 17], [19, 14], [21, 20]] as const) {
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      fillInk(g, '#d9803f', 1);
    }
  },
  crystal_shard: (g) => {
    g.fillStyle = 'rgba(130,210,255,0.35)';
    g.beginPath();
    g.arc(16, 17, 13, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(16, 3);
    g.lineTo(23, 14);
    g.lineTo(19, 29);
    g.lineTo(11, 29);
    g.lineTo(8, 14);
    g.closePath();
    fillInk(g, '#7fd0ff', 1.8);
    line(g, 16, 4, 14, 28, 'rgba(255,255,255,0.7)', 1.4);
  },
  seashell: (g) => {
    g.beginPath();
    g.moveTo(6, 22);
    g.quadraticCurveTo(5, 6, 16, 5);
    g.quadraticCurveTo(27, 6, 26, 22);
    g.quadraticCurveTo(16, 28, 6, 22);
    fillInk(g, '#f3d9c9', 1.8);
    for (let i = -3; i <= 3; i++) line(g, 16 + i * 3.4, 23, 16 + i * 2.2, 8, 'rgba(180,110,90,0.7)', 1.2);
  },
  wild_berry: (g) => {
    for (const [x, y] of [[11, 18], [21, 18], [16, 11], [16, 22]] as const) {
      g.beginPath();
      g.arc(x, y, 5.5, 0, Math.PI * 2);
      fillInk(g, '#c7385a', 1.6);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(x - 2, y - 2, 1.8, 1.8);
    }
  },
  moon_flower: (g) => {
    g.fillStyle = 'rgba(200,220,255,0.35)';
    g.beginPath();
    g.arc(16, 15, 12, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 6; i++) {
      g.save();
      g.translate(16, 15);
      g.rotate((i * Math.PI) / 3);
      g.beginPath();
      g.ellipse(0, -7, 3.6, 7, 0, 0, Math.PI * 2);
      fillInk(g, '#eaf0ff', 1.3);
      g.restore();
    }
    g.beginPath();
    g.arc(16, 15, 3.4, 0, Math.PI * 2);
    fillInk(g, '#ffe27a', 1.3);
    line(g, 16, 22, 16, 30, PAL.leaf, 2.4);
  },
  fertilizer: (g) => {
    g.beginPath();
    rr(g, 7, 8, 18, 20, 3);
    fillInk(g, '#a98b5a', 1.8);
    g.fillStyle = '#6fa04a';
    g.fillRect(8, 14, 16, 8);
    line(g, 9, 11, 23, 11, INK, 1.4);
    g.fillStyle = '#e8f2c8';
    g.beginPath();
    g.arc(16, 18, 2.8, 0, Math.PI * 2);
    g.fill();
  },
  minnow: fish('#9ec2d8'),
  silver_bass: fish('#c9d3da'),
  glow_eel: fish('#5ee0c8', true),
  bread: (g) => {
    g.beginPath();
    g.ellipse(16, 18, 12, 8, 0, 0, Math.PI * 2);
    fillInk(g, '#d9a35a', 1.8);
    for (const x of [-5, 0, 5]) line(g, 16 + x - 2, 13, 16 + x + 2, 19, '#a9742f', 1.6);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(8, 14, 5, 2);
  },
  turnip_stew: (g) => {
    g.beginPath();
    g.moveTo(5, 14);
    g.lineTo(27, 14);
    g.quadraticCurveTo(26, 28, 16, 28);
    g.quadraticCurveTo(6, 28, 5, 14);
    fillInk(g, '#8a5a3a', 1.8);
    g.beginPath();
    g.ellipse(16, 14, 11, 3.6, 0, 0, Math.PI * 2);
    fillInk(g, '#e9c46a', 1.4);
    for (const [x, y] of [[12, 14], [18, 13], [21, 15]] as const) {
      g.beginPath();
      g.arc(x, y, 1.9, 0, Math.PI * 2);
      g.fillStyle = '#efe9f6';
      g.fill();
    }
    for (const x of [11, 16, 21]) line(g, x, 9, x - 1, 3, 'rgba(255,255,255,0.7)', 1.4);
  }
};

function fallback(g: Ctx): void {
  blob(g, 16, 16, 9, 9, 3);
  fillInk(g, '#aaa', 1.5);
  g.fillStyle = INK;
  g.font = 'bold 14px sans-serif';
  g.textAlign = 'center';
  g.fillText('?', 16, 21);
}

export function drawIcon(id: string): HTMLCanvasElement {
  const c = mkCanvas(32, 32);
  const g = c.getContext('2d')!;
  (PAINT[id] ?? fallback)(g);
  return c;
}

/** Item ids that have no dedicated painter (should be empty — enforced by a test). */
export function itemsWithoutIcon(): string[] {
  return Object.keys(ITEMS).filter((id) => !PAINT[id]);
}

export const _cropIds = Object.keys(CROPS);
