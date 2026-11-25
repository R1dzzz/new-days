import type { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';
import { getItem, QUALITY_MULT } from '../data/items';
import { removeFromSlot } from './Inventory';

export type Difficulty = 'relaxed' | 'normal' | 'hard';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const DIFFICULTY_MULT: Record<Difficulty, { energyCost: number; hungerRate: number; sleepRestore: number }> = {
  relaxed: { energyCost: 0.6, hungerRate: 0.5, sleepRestore: 1 },
  normal: { energyCost: 1, hungerRate: 1, sleepRestore: 1 },
  hard: { energyCost: 1.3, hungerRate: 1.5, sleepRestore: 0.85 }
};

/** Spend energy. Returns false (and spends nothing) if the player is too exhausted. */
export function spendEnergy(state: GameState, base: number, discount: number, difficulty: Difficulty): boolean {
  const cost = Math.max(1, Math.round(base * (1 - discount) * DIFFICULTY_MULT[difficulty].energyCost));
  if (state.player.energy < cost) return false;
  state.player.energy -= cost;
  bus.emit('player:stats');
  return true;
}

/** Hunger drains slowly over game time. When starving, energy regen stops and health slowly drops (never below 10). */
export function tickNeeds(state: GameState, gameMinutes: number, difficulty: Difficulty): void {
  const p = state.player;
  const rate = DIFFICULTY_MULT[difficulty].hungerRate;
  p.hunger = clamp(p.hunger - gameMinutes * 0.035 * rate, 0, 100);
  if (p.hunger <= 0) {
    p.hp = Math.max(10, p.hp - gameMinutes * 0.02);
  } else if (p.hunger > 40 && p.energy < p.maxEnergy) {
    // slow passive recovery while fed
    p.energy = Math.min(p.maxEnergy, p.energy + gameMinutes * 0.01);
  }
  bus.emit('player:stats');
}

export function eatSlot(state: GameState, slotIndex: number): boolean {
  const s = state.inventory.slots[slotIndex];
  if (!s) return false;
  const def = getItem(s.id);
  if (def.energy === undefined && def.hunger === undefined && def.health === undefined) return false;
  const mult = QUALITY_MULT[s.q] ?? 1;
  const p = state.player;
  p.energy = clamp(p.energy + (def.energy ?? 0) * mult, 0, p.maxEnergy);
  p.hunger = clamp(p.hunger + (def.hunger ?? 0) * mult, 0, 100);
  p.hp = clamp(p.hp + (def.health ?? 0), 0, p.maxHp);
  removeFromSlot(state, slotIndex, 1);
  state.stats['eaten'] = (state.stats['eaten'] ?? 0) + 1;
  bus.emit('player:stats');
  return true;
}

/** Sleeping restores energy/health; hunger is not fully restored so food stays relevant. */
export function sleepRestore(state: GameState, difficulty: Difficulty, passedOut: boolean): void {
  const p = state.player;
  const factor = DIFFICULTY_MULT[difficulty].sleepRestore * (passedOut ? 0.6 : 1);
  p.energy = clamp(p.energy + p.maxEnergy * factor, 0, p.maxEnergy);
  if (p.energy < p.maxEnergy * 0.6) p.energy = p.maxEnergy * 0.6;
  p.hp = clamp(p.hp + p.maxHp * 0.5, 0, p.maxHp);
  p.hunger = clamp(p.hunger - 15, 5, 100);
  bus.emit('player:stats');
}
