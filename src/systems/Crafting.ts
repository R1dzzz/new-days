import type { GameState } from '../core/GameState';
import { RECIPES, type RecipeDef } from '../data/recipes';
import { addItem, canFit, countItem, removeItem } from './Inventory';
import { bus } from '../core/EventBus';

export function canCraft(state: GameState, r: RecipeDef): boolean {
  return r.inputs.every((i) => countItem(state, i.id) >= i.qty);
}

export type CraftResult = { ok: true } | { ok: false; reason: 'unknown' | 'missing' | 'noSpace' | 'tired' };

export function craft(state: GameState, recipeId: string): CraftResult {
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r) return { ok: false, reason: 'unknown' };
  if (!canCraft(state, r)) return { ok: false, reason: 'missing' };
  if (state.player.energy < r.energy) return { ok: false, reason: 'tired' };
  // Consume first, then check the output fits (inputs freeing slots may make room); roll back if not.
  const snapshot = JSON.stringify(state.inventory.slots);
  for (const i of r.inputs) removeItem(state, i.id, i.qty);
  if (!canFit(state, r.output.id, r.output.qty)) {
    state.inventory.slots = JSON.parse(snapshot);
    bus.emit('inventory:changed');
    return { ok: false, reason: 'noSpace' };
  }
  addItem(state, r.output.id, r.output.qty);
  state.player.energy -= r.energy;
  state.stats['crafted'] = (state.stats['crafted'] ?? 0) + 1;
  bus.emit('player:stats');
  return { ok: true };
}
