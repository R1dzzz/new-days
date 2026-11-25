import type { ColorMode } from './Settings';

type M3 = [[number, number, number], [number, number, number], [number, number, number]];

/** Machado-style simulation matrices for dichromacy. */
const SIM: Record<Exclude<ColorMode, 'none'>, M3> = {
  protanopia: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  tritanopia: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]]
};

/** Error-redistribution matrices (daltonization, after Fidaner et al.). */
const SHIFT: Record<Exclude<ColorMode, 'none'>, M3> = {
  protanopia: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]],
  deuteranopia: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]],
  tritanopia: [[1, 0, 0.7], [0, 1, 0.7], [0, 0, 0]]
};

const mul = (a: M3, b: M3): M3 => {
  const r: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r as M3;
};

/**
 * Daltonization: out = I + Shift * (I - Sim). The result is one linear 3x3 matrix, which an SVG
 * feColorMatrix applies to the whole canvas. It shifts hard-to-see colour differences into channels
 * the player can distinguish; the game also never relies on colour alone (icons, text, shapes).
 */
export function daltonMatrix(mode: Exclude<ColorMode, 'none'>): M3 {
  const sim = SIM[mode];
  const err: M3 = [
    [1 - sim[0][0], -sim[0][1], -sim[0][2]],
    [-sim[1][0], 1 - sim[1][1], -sim[1][2]],
    [-sim[2][0], -sim[2][1], 1 - sim[2][2]]
  ];
  const corr = mul(SHIFT[mode], err);
  return [
    [1 + corr[0][0], corr[0][1], corr[0][2]],
    [corr[1][0], 1 + corr[1][1], corr[1][2]],
    [corr[2][0], corr[2][1], 1 + corr[2][2]]
  ];
}

export function matrixToSvgValues(m: M3): string {
  return [...m[0], 0, 0, ...m[1], 0, 0, ...m[2], 0, 0, 0, 0, 0, 1, 0].map((n) => n.toFixed(4)).join(' ');
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Apply (or clear) the colour filter on the game canvas via CSS. */
export function applyColorMode(mode: ColorMode): void {
  const host = document.getElementById('game');
  if (!host) return;
  let svg = document.getElementById('cb-filters') as unknown as SVGSVGElement | null;
  if (!svg) {
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('id', 'cb-filters');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = '<defs><filter id="cb-filter" color-interpolation-filters="sRGB"><feColorMatrix id="cb-matrix" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter></defs>';
    document.body.appendChild(svg);
  }
  if (mode === 'none') {
    host.style.filter = '';
    return;
  }
  svg.querySelector('#cb-matrix')!.setAttribute('values', matrixToSvgValues(daltonMatrix(mode)));
  host.style.filter = 'url(#cb-filter)';
}
