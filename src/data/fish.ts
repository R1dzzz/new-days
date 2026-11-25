import type { Season, WeatherType } from '../config/constants';
import type { Rng } from '../core/Rng';

export interface FishDef {
  id: string;
  weight: number;
  seasons?: Season[];
  /** Hours (0-26) window, inclusive start / exclusive end. */
  hours?: [number, number];
  weathers?: WeatherType[];
  /** Minimum fishing level. */
  minLevel?: number;
  /** Extra weight multiplier while it is raining/storming. */
  rainBonus?: number;
}

export const FISH: FishDef[] = [
  { id: 'minnow', weight: 60 },
  { id: 'silver_bass', weight: 28, hours: [6, 13], rainBonus: 1.8 },
  { id: 'glow_eel', weight: 6, hours: [19, 26], seasons: ['summer', 'autumn'], minLevel: 2 }
];

export interface FishContext {
  season: Season;
  weather: WeatherType;
  hour: number;
  level: number;
}

/** Pick a fish given conditions. Returns null when nothing bites (about 10% of casts). */
export function rollFish(rng: Rng, ctx: FishContext): string | null {
  if (rng.chance(0.1)) return null;
  const pool: Array<[string, number]> = [];
  for (const f of FISH) {
    if (f.seasons && !f.seasons.includes(ctx.season)) continue;
    if (f.hours && (ctx.hour < f.hours[0] || ctx.hour >= f.hours[1])) continue;
    if (f.weathers && !f.weathers.includes(ctx.weather)) continue;
    if (f.minLevel && ctx.level < f.minLevel) continue;
    let w = f.weight;
    if (f.rainBonus && (ctx.weather === 'rain' || ctx.weather === 'storm')) w *= f.rainBonus;
    // Higher fishing level favours the rarer catches slightly.
    if (f.weight < 30) w *= 1 + ctx.level * 0.08;
    pool.push([f.id, w]);
  }
  if (!pool.length) return null;
  const total = pool.reduce((a, [, w]) => a + w, 0);
  let roll = rng.next() * total;
  for (const [id, w] of pool) {
    if (roll < w) return id;
    roll -= w;
  }
  return pool[0][0];
}

export function fishQuality(rng: Rng, level: number): number {
  const r = rng.next();
  const base = 0.03 + level * 0.025;
  if (r < base * 0.3) return 2;
  if (r < base) return 1;
  return 0;
}
