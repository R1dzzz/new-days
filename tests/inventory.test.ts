import { describe, it, expect } from 'vitest';
import { freshState } from './helpers';
import { addItem, countItem, removeItem, moveSlot, sortInventory, canFit, addToSlots } from '../src/systems/Inventory';
import { INVENTORY_SIZE } from '../src/config/constants';

describe('inventory', () => {
  it('stacks items up to the stack limit and spills into new slots', () => {
    const s = freshState();
    expect(addItem(s, 'wood', 150)).toBe(0);
    expect(countItem(s, 'wood')).toBe(150);
    const stacks = s.inventory.slots.filter((x) => x?.id === 'wood');
    expect(stacks.map((x) => x!.qty).sort((a, b) => b - a)).toEqual([99, 51]);
  });
  it('does not merge different qualities', () => {
    const s = freshState();
    addItem(s, 'turnip', 3, 0);
    addItem(s, 'turnip', 2, 2);
    expect(s.inventory.slots.filter((x) => x?.id === 'turnip').length).toBe(2);
  });
  it('returns the overflow when the backpack is full', () => {
    const s = freshState();
    s.inventory.slots = s.inventory.slots.map(() => ({ id: 'wood', qty: 99, q: 0 }));
    expect(addItem(s, 'stone', 5)).toBe(5);
    expect(canFit(s, 'stone', 1)).toBe(false);
  });
  it('removeItem takes lowest quality first and is atomic on failure', () => {
    const s = freshState();
    addItem(s, 'turnip', 2, 2);
    addItem(s, 'turnip', 2, 0);
    expect(removeItem(s, 'turnip', 3)).toBe(true);
    expect(s.inventory.slots.filter((x) => x?.id === 'turnip').map((x) => [x!.q, x!.qty])).toEqual([[2, 1]]);
    expect(removeItem(s, 'turnip', 5)).toBe(false);
    expect(countItem(s, 'turnip')).toBe(1);
  });
  it('moveSlot swaps and merges', () => {
    const s = freshState();
    s.inventory.slots[10] = { id: 'wood', qty: 5, q: 0 };
    s.inventory.slots[11] = { id: 'wood', qty: 7, q: 0 };
    moveSlot(s, 10, 11);
    expect(s.inventory.slots[10]).toBeNull();
    expect(s.inventory.slots[11]!.qty).toBe(12);
    s.inventory.slots[12] = { id: 'stone', qty: 1, q: 0 };
    moveSlot(s, 11, 12);
    expect(s.inventory.slots[11]!.id).toBe('stone');
    expect(s.inventory.slots[12]!.id).toBe('wood');
  });
  it('sort keeps tools first, merges stacks, preserves total counts and slot count', () => {
    const s = freshState();
    s.inventory.slots[15] = { id: 'wood', qty: 10, q: 0 };
    s.inventory.slots[3 + 10] = { id: 'wood', qty: 20, q: 0 };
    const before = countItem(s, 'wood');
    sortInventory(s);
    expect(s.inventory.slots.length).toBe(INVENTORY_SIZE);
    expect(countItem(s, 'wood')).toBe(before);
    expect(s.inventory.slots.filter((x) => x?.id === 'wood').length).toBe(1);
    expect(s.inventory.slots[0]!.id).toMatch(/hoe|can|axe|pick|rod/);
  });
  it('rejects unknown items loudly', () => {
    expect(() => addToSlots([null], 'nope', 1)).toThrow();
  });
});
