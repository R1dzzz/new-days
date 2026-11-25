import type { GameState, PlotState } from '../core/GameState';
import { bus } from '../core/EventBus';
import { Rng, hashSeed } from '../core/Rng';
import { CROPS, isMature, stageFromProgress } from '../data/crops';
import { dateFromDay } from '../core/Calendar';
import type { WeatherType } from '../config/constants';
import { getItem } from '../data/items';

export const plotKey = (tx: number, ty: number) => `${tx},${ty}`;

export type FarmResult =
  | { ok: true }
  | { ok: false; reason: 'notTillable' | 'alreadyTilled' | 'notTilled' | 'occupied' | 'wrongSeason' | 'noCrop' | 'notReady' | 'unknownSeed' | 'alreadyFertilized' | 'alreadyWatered' };

export function getPlot(state: GameState, tx: number, ty: number): PlotState | undefined {
  return state.farm.plots[plotKey(tx, ty)];
}

export function till(state: GameState, tx: number, ty: number, tillable: boolean): FarmResult {
  if (!tillable) return { ok: false, reason: 'notTillable' };
  const k = plotKey(tx, ty);
  if (state.farm.plots[k]?.tilled) return { ok: false, reason: 'alreadyTilled' };
  state.farm.plots[k] = { tilled: true, watered: false, fertilized: false, progress: 0, quality: 0 };
  bus.emit('farm:changed');
  return { ok: true };
}

export function water(state: GameState, tx: number, ty: number): FarmResult {
  const p = getPlot(state, tx, ty);
  if (!p || !p.tilled) return { ok: false, reason: 'notTilled' };
  if (p.watered) return { ok: false, reason: 'alreadyWatered' };
  p.watered = true;
  bus.emit('farm:changed');
  return { ok: true };
}

export function plant(state: GameState, tx: number, ty: number, seedId: string): FarmResult {
  const p = getPlot(state, tx, ty);
  if (!p || !p.tilled) return { ok: false, reason: 'notTilled' };
  if (p.crop) return { ok: false, reason: 'occupied' };
  const cropId = getItem(seedId).plants;
  const crop = cropId ? CROPS[cropId] : undefined;
  if (!crop) return { ok: false, reason: 'unknownSeed' };
  const season = dateFromDay(state.time.day).season;
  if (!crop.seasons.includes(season)) return { ok: false, reason: 'wrongSeason' };
  p.crop = crop.id;
  p.progress = 0;
  state.stats['planted'] = (state.stats['planted'] ?? 0) + 1;
  bus.emit('farm:changed');
  return { ok: true };
}

export function fertilize(state: GameState, tx: number, ty: number): FarmResult {
  const p = getPlot(state, tx, ty);
  if (!p || !p.tilled) return { ok: false, reason: 'notTilled' };
  if (p.fertilized) return { ok: false, reason: 'alreadyFertilized' };
  p.fertilized = true;
  bus.emit('farm:changed');
  return { ok: true };
}

export function cropStage(plot: PlotState): number {
  if (!plot.crop) return -1;
  return stageFromProgress(CROPS[plot.crop], plot.progress);
}

export function isHarvestable(plot: PlotState): boolean {
  return !!plot.crop && isMature(CROPS[plot.crop], plot.progress);
}

/** Roll quality at harvest time. Gold requires level + fertilizer luck. */
export function rollQuality(plot: PlotState, farmingLevel: number, rng: Rng): number {
  const fert = plot.fertilized ? 0.15 : 0;
  const base = 0.02 + farmingLevel * 0.025 + fert;
  const r = rng.next();
  if (r < base * 0.35) return 2;
  if (r < base) return 1;
  return 0;
}

export interface HarvestResult {
  item: string;
  qty: number;
  quality: number;
}

export function harvest(state: GameState, tx: number, ty: number): { ok: true; result: HarvestResult } | { ok: false; reason: 'noCrop' | 'notReady' } {
  const p = getPlot(state, tx, ty);
  if (!p || !p.crop) return { ok: false, reason: 'noCrop' };
  if (!isHarvestable(p)) return { ok: false, reason: 'notReady' };
  const rng = new Rng(hashSeed('harvest', state.meta.seed, state.time.day, tx, ty));
  const quality = rollQuality(p, state.player.skills.farming.level, rng);
  const crop = CROPS[p.crop];
  const result: HarvestResult = { item: crop.harvest, qty: 1, quality };
  // Fertilized soil sometimes yields a bonus crop.
  if (p.fertilized && rng.chance(0.25)) result.qty = 2;
  p.crop = undefined;
  p.progress = 0;
  p.fertilized = false;
  state.stats['harvested'] = (state.stats['harvested'] ?? 0) + result.qty;
  bus.emit('farm:changed');
  return { ok: true, result };
}

export function removeCrop(state: GameState, tx: number, ty: number): void {
  const p = getPlot(state, tx, ty);
  if (!p) return;
  p.crop = undefined;
  p.progress = 0;
  bus.emit('farm:changed');
}

/**
 * Overnight farm update. Called once when a new day begins.
 * - Crops advance only if watered (rain/storm waters automatically).
 * - Crops out of season wither.
 * - Watering resets daily; tilled soil without crops reverts after a few unattended days (not modelled yet).
 */
export function dailyFarmUpdate(state: GameState, weatherOfJustFinishedDay: WeatherType): { grown: number; withered: number } {
  const season = dateFromDay(state.time.day).season;
  const rainy = weatherOfJustFinishedDay === 'rain' || weatherOfJustFinishedDay === 'storm';
  let grown = 0;
  let withered = 0;
  for (const p of Object.values(state.farm.plots)) {
    if (p.crop) {
      const crop = CROPS[p.crop];
      if (!crop.seasons.includes(season)) {
        p.crop = undefined;
        p.progress = 0;
        withered++;
      } else if (p.watered || rainy) {
        p.progress += p.fertilized ? 1.25 : 1;
        grown++;
      }
    }
    p.watered = false;
  }
  bus.emit('farm:changed');
  return { grown, withered };
}

/** Rain starts the day with everything watered. */
export function applyRainWatering(state: GameState, weather: WeatherType): void {
  if (weather !== 'rain' && weather !== 'storm') return;
  for (const p of Object.values(state.farm.plots)) if (p.tilled) p.watered = true;
}
