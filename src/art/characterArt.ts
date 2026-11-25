import { HAIR_COLORS, INK, OUTFIT_COLORS, SKIN_TONES, ellipse, fillInk, mkCanvas, rr, shade, softShadow, type Ctx } from './draw';

export const CHAR_W = 32;
export const CHAR_H = 48;
/** Columns per row: 0 idle, 1 step A, 2 idle, 3 step B, 4 swing A, 5 swing B */
export const CHAR_COLS = 6;
/** Rows: 0 down, 1 left, 2 right, 3 up */
export const CHAR_ROWS = 4;

export interface Look {
  skin: number;
  hairStyle: number;
  hairColor: number;
  outfitStyle: number;
  outfitColor: number;
}

export const HAIR_STYLE_COUNT = 4;
export const OUTFIT_STYLE_COUNT = 3;
export const SKIN_COUNT = SKIN_TONES.length;
export const HAIR_COLOR_COUNT = HAIR_COLORS.length;
export const OUTFIT_COLOR_COUNT = OUTFIT_COLORS.length;

type Dir = 0 | 1 | 2 | 3;

function drawLegs(g: Ctx, ox: number, oy: number, frame: number): void {
  const stepA = frame === 1;
  const stepB = frame === 3;
  const lY = oy + 33 + (stepA ? -2 : 0);
  const rY = oy + 33 + (stepB ? -2 : 0);
  for (const [x, y] of [[ox + 10, lY], [ox + 17, rY]] as const) {
    g.beginPath();
    rr(g, x, y, 5.5, 10 - (y - (oy + 33)), 2);
    fillInk(g, '#4a3a33', 1.3);
  }
  // boots
  for (const [x, y] of [[ox + 9.5, lY + 7], [ox + 16.5, rY + 7]] as const) {
    g.beginPath();
    rr(g, x, y, 6.5, 4, 1.8);
    fillInk(g, '#2f2420', 1.2);
  }
}

function drawBody(g: Ctx, ox: number, oy: number, look: Look, dir: Dir, frame: number): void {
  const outfit = OUTFIT_COLORS[look.outfitColor % OUTFIT_COLORS.length];
  const skin = SKIN_TONES[look.skin % SKIN_TONES.length];
  const swing = frame >= 4;
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  const by = oy + 19 + bob;

  const arm = (x: number, y: number, up = false) => {
    g.beginPath();
    rr(g, x, y, 4.5, up ? 7 : 11, 2);
    fillInk(g, outfit, 1.3);
    g.beginPath();
    ellipse(g, x + 2.2, y + (up ? 0 : 11.5), 2.4, 2.4);
    fillInk(g, skin, 1.1);
  };

  // arms behind body when facing up
  if (dir === 3) {
    arm(ox + 5, by + 1);
    arm(ox + 22.5, by + 1);
  }
  if (dir === 1 && !swing) arm(ox + 12, by + 1.5);
  if (dir === 2 && !swing) arm(ox + 15, by + 1.5);

  // torso
  g.beginPath();
  rr(g, ox + 8, by, 16, 15, 4);
  fillInk(g, outfit);
  if (look.outfitStyle === 0) {
    // tunic: belt + hem
    g.fillStyle = shade('#6a4a2a', 0);
    g.fillRect(ox + 8.5, by + 9, 15, 2.6);
    g.fillStyle = '#e8c86a';
    g.fillRect(ox + 14.5, by + 9, 3, 2.6);
  } else if (look.outfitStyle === 1) {
    // vest over a pale shirt
    g.fillStyle = '#efe6cf';
    g.fillRect(ox + 13, by + 1, 6, 13);
    g.strokeStyle = INK;
    g.lineWidth = 1;
    g.strokeRect(ox + 13, by + 1, 6, 13);
  } else {
    // long coat with centre seam + buttons
    g.strokeStyle = INK;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(ox + 16, by + 1);
    g.lineTo(ox + 16, by + 14);
    g.stroke();
    g.fillStyle = '#e8c86a';
    for (const k of [4, 8, 12]) {
      g.beginPath();
      g.arc(ox + 18, by + k, 1, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (dir === 3) {
    // back: plain, show a small pack strap
    g.fillStyle = shade('#6a4a2a', 10);
    g.fillRect(ox + 9, by + 2, 3, 12);
    g.fillRect(ox + 20, by + 2, 3, 12);
  }

  // front arms
  if (dir === 0) {
    arm(ox + 3.5, by + 1.5 + (frame === 1 ? 1 : frame === 3 ? -1 : 0), swing);
    arm(ox + 24, by + 1.5 + (frame === 3 ? 1 : frame === 1 ? -1 : 0), swing);
  }
  if (swing) {
    // arm raised/forward during a tool swing
    const sy = frame === 4 ? by - 5 : by + 4;
    if (dir === 1) arm(ox + 6, sy, true);
    else if (dir === 2) arm(ox + 21, sy, true);
  }
}

function drawHead(g: Ctx, ox: number, oy: number, look: Look, dir: Dir, frame: number): void {
  const skin = SKIN_TONES[look.skin % SKIN_TONES.length];
  const hair = HAIR_COLORS[look.hairColor % HAIR_COLORS.length];
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  const cx = ox + 16;
  const cy = oy + 12 + bob;
  const style = look.hairStyle % HAIR_STYLE_COUNT;

  // long hair back layer
  if (style === 1 && dir !== 0) {
    g.beginPath();
    rr(g, cx - 8.5, cy - 4, 17, 20, 7);
    fillInk(g, hair, 1.3);
  }
  if (style === 1 && dir === 0) {
    g.beginPath();
    rr(g, cx - 9, cy - 3, 18, 19, 7);
    fillInk(g, hair, 1.3);
  }
  // bun at back/top
  if (style === 2) {
    g.beginPath();
    ellipse(g, cx, cy - 9.5, 4, 3.6);
    fillInk(g, hair, 1.3);
  }

  // head
  g.beginPath();
  ellipse(g, cx, cy, 8, 8.4);
  fillInk(g, skin);
  // ears
  if (dir === 0 || dir === 3) {
    g.beginPath();
    ellipse(g, cx - 8, cy + 1, 1.8, 2.2);
    fillInk(g, skin, 1);
    g.beginPath();
    ellipse(g, cx + 8, cy + 1, 1.8, 2.2);
    fillInk(g, skin, 1);
  }

  // hair cap
  const cap = () => {
    g.beginPath();
    if (dir === 3) {
      ellipse(g, cx, cy - 0.5, 8.3, 8.6);
    } else {
      g.moveTo(cx - 8.2, cy + 1);
      g.quadraticCurveTo(cx - 8.6, cy - 9.5, cx, cy - 9.2);
      g.quadraticCurveTo(cx + 8.6, cy - 9.5, cx + 8.2, cy + 1);
      if (dir === 0) {
        g.quadraticCurveTo(cx + 5, cy - 4.2, cx, cy - 4);
        g.quadraticCurveTo(cx - 5, cy - 4.2, cx - 8.2, cy + 1);
      } else if (dir === 1) {
        g.lineTo(cx + 1, cy - 3);
        g.quadraticCurveTo(cx - 3, cy - 4, cx - 5, cy + 1);
      } else {
        g.lineTo(cx - 1, cy - 3);
        g.quadraticCurveTo(cx + 3, cy - 4, cx + 5, cy + 1);
      }
    }
    g.closePath();
    fillInk(g, hair, 1.3);
  };
  cap();
  if (style === 3) {
    // spiky fringe
    g.beginPath();
    g.moveTo(cx - 8, cy - 5);
    for (let i = 0; i < 5; i++) {
      g.lineTo(cx - 8 + i * 4 + 2, cy - 13 + (i % 2) * 2);
      g.lineTo(cx - 8 + i * 4 + 4, cy - 6);
    }
    g.closePath();
    fillInk(g, hair, 1.2);
  }

  // face
  if (dir === 0) {
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(cx - 3.2, cy + 1.2, 1.1, 1.7, 0, 0, Math.PI * 2);
    g.ellipse(cx + 3.2, cy + 1.2, 1.1, 1.7, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(160,70,60,0.8)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(cx, cy + 4.5, 1.8, 0.2, Math.PI - 0.2);
    g.stroke();
    g.fillStyle = 'rgba(230,120,110,0.35)';
    g.beginPath();
    g.ellipse(cx - 5.4, cy + 3.4, 1.7, 1.1, 0, 0, Math.PI * 2);
    g.ellipse(cx + 5.4, cy + 3.4, 1.7, 1.1, 0, 0, Math.PI * 2);
    g.fill();
  } else if (dir === 1 || dir === 2) {
    const s = dir === 1 ? -1 : 1;
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(cx + s * 3.6, cy + 1.2, 1.1, 1.7, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = shade(SKIN_TONES[look.skin % SKIN_TONES.length], -40);
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(cx + s * 7.6, cy + 2.4);
    g.lineTo(cx + s * 8.6, cy + 3.4);
    g.stroke();
  }
}

/** Draw one animation frame of a character into ctx at (ox, oy) (top-left of a CHAR_W x CHAR_H cell). */
export function drawCharacterFrame(g: Ctx, ox: number, oy: number, look: Look, dir: Dir, frame: number): void {
  softShadow(g, ox + 16, oy + 44.5, 9.5, 3.2);
  const behind = dir === 3;
  if (!behind) drawLegs(g, ox, oy, frame);
  else drawLegs(g, ox, oy, frame);
  drawBody(g, ox, oy, look, dir, frame);
  drawHead(g, ox, oy, look, dir, frame);
}

/** Whole sheet: CHAR_COLS x CHAR_ROWS cells. */
export function drawCharacterSheet(look: Look): HTMLCanvasElement {
  const c = mkCanvas(CHAR_W * CHAR_COLS, CHAR_H * CHAR_ROWS);
  const g = c.getContext('2d')!;
  for (let row = 0; row < CHAR_ROWS; row++) for (let col = 0; col < CHAR_COLS; col++) drawCharacterFrame(g, col * CHAR_W, row * CHAR_H, look, row as Dir, col);
  return c;
}

export const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 } as const;
