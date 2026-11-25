import type { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';
import { SHOPS } from '../data/npcs';
import { QUALITY_MULT, getItem } from '../data/items';
import { dateFromDay } from '../core/Calendar';
import { addItem, canFit, removeFromSlot } from './Inventory';

export function sellPriceOf(itemId: string, quality: number, mult = 1): number {
  return Math.floor(getItem(itemId).sell * (QUALITY_MULT[quality] ?? 1) * mult);
}

export type TradeResult = { ok: true; gold: number } | { ok: false; reason: 'unsellable' | 'empty' | 'noGold' | 'noSpace' | 'notStocked' };

/** Sell `qty` from an inventory slot to a shop. */
export function sellFromSlot(state: GameState, shopId: string, slot: number, qty = 1): TradeResult {
  const s = state.inventory.slots[slot];
  if (!s) return { ok: false, reason: 'empty' };
  const shop = SHOPS[shopId];
  const price = sellPriceOf(s.id, s.q, shop?.sellMult ?? 1);
  if (price <= 0 || getItem(s.id).category === 'tool') return { ok: false, reason: 'unsellable' };
  const n = Math.min(qty, s.qty);
  const total = price * n;
  removeFromSlot(state, slot, n);
  state.player.gold += total;
  state.stats['sold'] = (state.stats['sold'] ?? 0) + n;
  state.stats['earned'] = (state.stats['earned'] ?? 0) + total;
  bus.emit('player:stats');
  return { ok: true, gold: total };
}

export function shopStock(state: GameState, shopId: string): string[] {
  const season = dateFromDay(state.time.day).season;
  const shop = SHOPS[shopId];
  if (!shop) return [];
  return shop.stock.filter((e) => !e.seasons || e.seasons.includes(season)).map((e) => e.item);
}

export function buyItem(state: GameState, shopId: string, itemId: string, qty = 1): TradeResult {
  if (!shopStock(state, shopId).includes(itemId)) return { ok: false, reason: 'notStocked' };
  const price = (getItem(itemId).buy ?? 0) * qty;
  if (state.player.gold < price) return { ok: false, reason: 'noGold' };
  if (!canFit(state, itemId, qty)) return { ok: false, reason: 'noSpace' };
  state.player.gold -= price;
  // Don't count purchases as "gathered" stats: undo the stat bump addItem makes.
  addItem(state, itemId, qty);
  state.stats[`gathered:${itemId}`] = Math.max(0, (state.stats[`gathered:${itemId}`] ?? 0) - qty);
  bus.emit('player:stats');
  return { ok: true, gold: -price };
}
