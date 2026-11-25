import { INK, PAL, blob, fillInk, hash2, line, mkCanvas, softShadow } from './draw';

export function drawSkyGradient(top: string, mid: string, bottom: string): HTMLCanvasElement {
  const c = mkCanvas(4, 512);
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, top);
  grd.addColorStop(0.6, mid);
  grd.addColorStop(1, bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 512);
  return c;
}

export function drawCloud(seed: number): HTMLCanvasElement {
  const c = mkCanvas(220, 90);
  const g = c.getContext('2d')!;
  const lumps = [[50, 55, 38, 24], [100, 42, 44, 30], [150, 54, 40, 24], [100, 62, 70, 20]];
  for (const [x, y, rx, ry] of lumps) {
    blob(g, x + hash2(seed, x, 1) * 6, y, rx, ry, seed + x, 0.06);
    g.fillStyle = 'rgba(255,250,240,0.92)';
    g.fill();
  }
  g.fillStyle = 'rgba(190,205,225,0.45)';
  g.beginPath();
  g.ellipse(100, 70, 70, 9, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Silhouetted island with palms/pines (and optionally a lighthouse). 640x240, base at y=236. */
export function drawMenuIsland(seed: number, body: string, accent: string, lighthouse: boolean): HTMLCanvasElement {
  const w = 640;
  const h = 260;
  const c = mkCanvas(w, h);
  const g = c.getContext('2d')!;
  // landmass
  g.beginPath();
  g.moveTo(0, h - 6);
  for (let x = 0; x <= w; x += 16) {
    const t = x / w;
    const hill = Math.sin(t * Math.PI) * 70 + Math.sin(t * 9 + seed) * 8 + Math.sin(t * 17 + seed * 2) * 3;
    g.lineTo(x, h - 20 - hill);
  }
  g.lineTo(w, h - 6);
  g.closePath();
  g.fillStyle = body;
  g.fill();
  g.beginPath();
  g.moveTo(0, h - 6);
  g.quadraticCurveTo(w / 2, h - 2, w, h - 6);
  g.lineTo(w, h - 6);
  g.strokeStyle = PAL.sandDark;
  g.lineWidth = 6;
  g.stroke();
  // pines & palms
  for (let i = 0; i < 24; i++) {
    const t = 0.08 + hash2(i, seed, 4) * 0.84;
    const x = t * w;
    const hill = Math.sin(t * Math.PI) * 70 + Math.sin(t * 9 + seed) * 8 + Math.sin(t * 17 + seed * 2) * 3;
    const baseY = h - 22 - hill + 6;
    const hh = 22 + hash2(i, seed, 5) * 26;
    if (i % 3 === 0) {
      line(g, x, baseY, x + 4, baseY - hh, '#5a3f2a', 3);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.7;
        g.strokeStyle = accent;
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x + 4, baseY - hh);
        g.quadraticCurveTo(x + 4 + Math.cos(a) * 12, baseY - hh + Math.sin(a) * 12 - 6, x + 4 + Math.cos(a) * 20, baseY - hh + Math.sin(a) * 20 + 8);
        g.stroke();
      }
    } else {
      g.fillStyle = accent;
      g.beginPath();
      g.moveTo(x - 9, baseY);
      g.lineTo(x, baseY - hh);
      g.lineTo(x + 9, baseY);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(x - 7, baseY - hh * 0.45);
      g.lineTo(x, baseY - hh * 1.1);
      g.lineTo(x + 7, baseY - hh * 0.45);
      g.closePath();
      g.fill();
    }
  }
  if (lighthouse) {
    const x = w * 0.72;
    const hill = Math.sin(0.72 * Math.PI) * 70 + Math.sin(0.72 * 9 + seed) * 8 + Math.sin(0.72 * 17 + seed * 2) * 3;
    const by = h - 20 - hill + 4;
    g.beginPath();
    g.moveTo(x - 9, by);
    g.lineTo(x - 5, by - 62);
    g.lineTo(x + 5, by - 62);
    g.lineTo(x + 9, by);
    g.closePath();
    fillInk(g, '#f1ead8', 1.6);
    g.fillStyle = '#c9533f';
    g.fillRect(x - 7, by - 40, 14, 10);
    g.beginPath();
    g.rect(x - 6, by - 78, 12, 16);
    fillInk(g, '#ffe7a0', 1.6);
    g.beginPath();
    g.moveTo(x - 9, by - 78);
    g.lineTo(x, by - 90);
    g.lineTo(x + 9, by - 78);
    g.closePath();
    fillInk(g, PAL.roofRed, 1.6);
  }
  return c;
}

export function drawBoat(): HTMLCanvasElement {
  const c = mkCanvas(110, 90);
  const g = c.getContext('2d')!;
  softShadow(g, 55, 80, 40, 5, 0.25);
  // hull
  g.beginPath();
  g.moveTo(10, 56);
  g.lineTo(100, 56);
  g.quadraticCurveTo(90, 76, 70, 78);
  g.lineTo(30, 78);
  g.quadraticCurveTo(15, 74, 10, 56);
  fillInk(g, '#a8794a', 2);
  line(g, 14, 62, 96, 62, '#7a5231', 1.6);
  // mast & sails
  line(g, 55, 56, 55, 6, INK, 4);
  line(g, 55, 56, 55, 6, '#7a5231', 2.4);
  g.beginPath();
  g.moveTo(58, 10);
  g.quadraticCurveTo(90, 28, 86, 50);
  g.lineTo(58, 50);
  g.closePath();
  fillInk(g, '#f4ead0', 1.8);
  g.beginPath();
  g.moveTo(52, 14);
  g.quadraticCurveTo(30, 28, 26, 50);
  g.lineTo(52, 50);
  g.closePath();
  fillInk(g, '#ecdcb8', 1.8);
  g.beginPath();
  g.moveTo(55, 6);
  g.lineTo(70, 11);
  g.lineTo(55, 16);
  g.closePath();
  fillInk(g, '#c9533f', 1.4);
  return c;
}

/** Two bird frames side by side: 48x16. */
export function drawBirds(): HTMLCanvasElement {
  const c = mkCanvas(48, 16);
  const g = c.getContext('2d')!;
  g.strokeStyle = '#2b2430';
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(3, 4);
  g.quadraticCurveTo(8, 9, 12, 8);
  g.quadraticCurveTo(16, 9, 21, 4);
  g.stroke();
  g.beginPath();
  g.moveTo(27, 11);
  g.quadraticCurveTo(32, 6, 36, 8);
  g.quadraticCurveTo(40, 6, 45, 11);
  g.stroke();
  return c;
}
