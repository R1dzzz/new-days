import { INVENTORY_SIZE } from '../config/constants';
import type { GameState, ItemStack } from '../core/GameState';
import { bus } from '../core/EventBus';
import { getItem, isItemId } from '../data/items';

type Slots = Array<ItemStack | null>;

/** Add items to a slot array. Returns the quantity that did NOT fit. */
export function addToSlots(slots: Slots, id: string, qty: number, q = 0): number {
  if (!isItemId(id)) throw new Error(`addToSlots: unknown item "${id}"`);
  if (qty <= 0) return 0;
  const max = getItem(id).stack;
  let left = qty;
  // top up existing stacks first (same quality only)
  for (const s of slots) {
    if (!s || s.id !== id || s.q !== q || s.qty >= max) continue;
    const put = Math.min(max - s.qty, left);
    s.qty += put;
    left -= put;
    if (left === 0) return 0;
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i]) continue;
    const put = Math.min(max, left);
    slots[i] = { id, qty: put, q };
    left -= put;
  }
  return left;
}

export function addItem(state: GameState, id: string, qty = 1, q = 0): number {
  const left = addToSlots(state.inventory.slots, id, qty, q);
  if (left < qty) {
    state.stats[`gathered:${id}`] = (state.stats[`gathered:${id}`] ?? 0) + (qty - left);
    bus.emit('inventory:changed');
  }
  return left;
}

export function countItem(state: GameState, id: string): number {
  let n = 0;
  for (const s of state.inventory.slots) if (s && s.id === id) n += s.qty;
  return n;
}

export function hasItem(state: GameState, id: string, qty = 1): boolean {
  return countItem(state, id) >= qty;
}

/** Remove qty of an item (lowest quality first). Returns true on success; no change on failure. */
export function removeItem(state: GameState, id: string, qty = 1): boolean {
  if (countItem(state, id) < qty) return false;
  let left = qty;
  const order = state.inventory.slots
    .map((s, i) => ({ s, i }))
    .filter((e) => e.s && e.s.id === id)
    .sort((a, b) => a.s!.q - b.s!.q);
  for (const { s, i } of order) {
    const take = Math.min(s!.qty, left);
    s!.qty -= take;
    left -= take;
    if (s!.qty === 0) state.inventory.slots[i] = null;
    if (left === 0) break;
  }
  bus.emit('inventory:changed');
  return true;
}

export function removeFromSlot(state: GameState, index: number, qty = 1): ItemStack | null {
  const s = state.inventory.slots[index];
  if (!s) return null;
  const take = Math.min(qty, s.qty);
  s.qty -= take;
  const taken: ItemStack = { id: s.id, qty: take, q: s.q };
  if (s.qty === 0) state.inventory.slots[index] = null;
  bus.emit('inventory:changed');
  return taken;
}

export function canFit(state: GameState, id: string, qty: number, q = 0): boolean {
  const copy: Slots = state.inventory.slots.map((s) => (s ? { ...s } : null));
  return addToSlots(copy, id, qty, q) === 0;
}

/** Swap two slots, merging if they hold the same stackable item. */
export function moveSlot(state: GameState, from: number, to: number): void {
  const slots = state.inventory.slots;
  if (from === to || from < 0 || to < 0 || from >= slots.length || to >= slots.length) return;
  const a = slots[from];
  const b = slots[to];
  if (a && b && a.id === b.id && a.q === b.q) {
    const max = getItem(a.id).stack;
    const put = Math.min(max - b.qty, a.qty);
    b.qty += put;
    a.qty -= put;
    if (a.qty === 0) slots[from] = null;
  } else {
    slots[from] = b;
    slots[to] = a;
  }
  bus.emit('inventory:changed');
}

const CAT_ORDER = ['tool', 'seed', 'crop', 'food', 'resource', 'material', 'gift', 'misc'];

/** Consolidate stacks and sort by category then name. Tools remain in the first slots to protect the hotbar. */
export function sortInventory(state: GameState): void {
  const all: ItemStack[] = [];
  for (const s of state.inventory.slots) if (s) all.push({ ...s });
  const tools = all.filter((s) => getItem(s.id).category === 'tool');
  const rest = all.filter((s) => getItem(s.id).category !== 'tool');
  const merged: ItemStack[] = [];
  const tmp: Slots = new Array(INVENTORY_SIZE).fill(null);
  rest
    .sort((a, b) => {
      const ca = CAT_ORDER.indexOf(getItem(a.id).category);
      const cb = CAT_ORDER.indexOf(getItem(b.id).category);
      return ca - cb || a.id.localeCompare(b.id) || b.q - a.q;
    })
    .forEach((s) => addToSlots(tmp, s.id, s.qty, s.q));
  for (const s of tmp) if (s) merged.push(s);
  const out: Slots = new Array(INVENTORY_SIZE).fill(null);
  [...tools, ...merged].forEach((s, i) => {
    if (i < out.length) out[i] = s;
  });
  state.inventory.slots = out;
  bus.emit('inventory:changed');
}

export function selectedStack(state: GameState): ItemStack | null {
  return state.inventory.slots[state.inventory.selected] ?? null;
}
