import type { Season } from '../config/constants';

export interface CropDef {
  id: string;
  seasons: Season[];
  /** Number of watered days needed per growth stage; last stage = ready to harvest. */
  stageDays: number[];
  harvest: string;
  /** Rows used in the generated sprite sheet (palette). */
  colors: { leaf: string; fruit: string };
}

export const CROPS: Record<string, CropDef> = {
  turnip: { id: 'turnip', seasons: ['spring', 'autumn'], stageDays: [1, 1, 1, 1], harvest: 'turnip', colors: { leaf: '#5fae4f', fruit: '#e9e2f2' } },
  tomato: { id: 'tomato', seasons: ['summer'], stageDays: [1, 2, 2, 1], harvest: 'tomato', colors: { leaf: '#4e9d45', fruit: '#e24b3a' } },
  pumpkin: { id: 'pumpkin', seasons: ['autumn'], stageDays: [2, 2, 2, 2], harvest: 'pumpkin', colors: { leaf: '#6a9a3a', fruit: '#e88a1f' } },
  frostleaf: { id: 'frostleaf', seasons: ['winter'], stageDays: [1, 2, 1, 1], harvest: 'frostleaf', colors: { leaf: '#7fd0d8', fruit: '#b9f1ff' } }
};

export function totalGrowDays(c: CropDef): number {
  return c.stageDays.reduce((a, b) => a + b, 0);
}

/** Stage index (0..stageDays.length) from accumulated watered days. Last index = mature. */
export function stageFromProgress(c: CropDef, progress: number): number {
  let remaining = progress;
  for (let i = 0; i < c.stageDays.length; i++) {
    if (remaining < c.stageDays[i]) return i;
    remaining -= c.stageDays[i];
  }
  return c.stageDays.length;
}

export function isMature(c: CropDef, progress: number): boolean {
  return progress >= totalGrowDays(c);
}
