import { describe, it, expect } from 'vitest';
import { generateIsland, idx, isTillable, MAP_W, MAP_H, T } from '../src/world/WorldData';
import { findPath } from '../src/world/Pathfinder';
import { rollFish, FISH } from '../src/data/fish';
import { Rng } from '../src/core/Rng';
import { craft, canCraft } from '../src/systems/Crafting';
import { RECIPES } from '../src/data/recipes';
import { freshState } from './helpers';
import { addItem, countItem } from '../src/systems/Inventory';

const island = generateIsland();

describe('island generation', () => {
  it('is deterministic', () => {
    const b = generateIsland();
    expect(Array.from(b.terrain)).toEqual(Array.from(island.terrain));
    expect(b.objects.map((o) => o.id)).toEqual(island.objects.map((o) => o.id));
  });
  it('has the expected scale of content', () => {
    const c = (t: string) => island.objects.filter((o) => o.type === t).length;
    expect(c('tree')).toBeGreaterThan(40);
    expect(c('rock')).toBeGreaterThan(10);
    expect(c('bush')).toBeGreaterThan(5);
    expect(c('shell')).toBeGreaterThan(8);
    expect(c('stone')).toBe(1);
    expect(c('campfire')).toBe(1);
  });
  it('spawn is walkable land', () => {
    const { x, y } = island.spawn;
    expect(island.blocked[idx(x, y)]).toBe(0);
    expect(island.terrain[idx(x, y)]).not.toBe(T.Water);
  });
  it('every NPC spot is reachable from the spawn', () => {
    for (const [name, s] of Object.entries(island.spots)) {
      const p = findPath(island.blocked, island.spawn, s);
      expect(p, `spot ${name} at ${s.x},${s.y}`).not.toBeNull();
    }
  });
  it('every building door has a reachable tile in front of it', () => {
    for (const b of island.buildings) {
      const front = { x: b.doorX, y: b.doorY + 1 };
      expect(island.blocked[idx(front.x, front.y)], `${b.id} front blocked`).toBe(0);
      expect(findPath(island.blocked, island.spawn, front), b.id).not.toBeNull();
    }
  });
  it('the whispering stone and campfire can be reached from an adjacent tile', () => {
    for (const type of ['stone', 'campfire', 'workbench']) {
      const o = island.objects.find((x) => x.type === type)!;
      const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const x = o.tx + dx, y = o.ty + dy;
        return !island.blocked[idx(x, y)] && findPath(island.blocked, island.spawn, { x, y }) !== null;
      });
      expect(ok, type).toBe(true);
    }
  });
  it('pier extends into water and is walkable', () => {
    const piers = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (island.terrain[idx(x, y)] === T.Pier) piers.push([x, y]);
    expect(piers.length).toBeGreaterThan(8);
    for (const [x, y] of piers) expect(island.blocked[idx(x, y)]).toBe(0);
  });
  it('farmland offers plenty of tillable tiles', () => {
    let n = 0;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (isTillable(island, x, y)) n++;
    expect(n).toBeGreaterThanOrEqual(80);
  });
  it('solid objects block movement, shells do not', () => {
    for (const o of island.objects) {
      const b = island.blocked[idx(o.tx, o.ty)];
      expect(b, o.id).toBe(o.type === 'shell' ? 0 : 1);
    }
  });
  it('most shells and bushes are reachable (nothing is walled in)', () => {
    const targets = island.objects.filter((o) => o.type === 'shell' || o.type === 'bush');
    let reachable = 0;
    for (const o of targets) {
      const adj = [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]].some(([dx, dy]) => {
        const x = o.tx + dx, y = o.ty + dy;
        return !island.blocked[idx(x, y)] && findPath(island.blocked, island.spawn, { x, y }) !== null;
      });
      if (adj) reachable++;
    }
    expect(reachable / targets.length).toBeGreaterThan(0.9);
  });
});

describe('pathfinder', () => {
  it('returns null when the goal is walled off or out of bounds', () => {
    const blocked = new Uint8Array(MAP_W * MAP_H);
    for (let y = 0; y < MAP_H; y++) blocked[idx(10, y)] = 1;
    expect(findPath(blocked, { x: 2, y: 2 }, { x: 20, y: 2 })).toBeNull();
    expect(findPath(blocked, { x: 2, y: 2 }, { x: -1, y: 2 })).toBeNull();
  });
  it('finds a shortest path on open ground', () => {
    const blocked = new Uint8Array(MAP_W * MAP_H);
    const p = findPath(blocked, { x: 1, y: 1 }, { x: 4, y: 3 })!;
    expect(p.length).toBe(1 + 3 + 2);
    expect(p[0]).toEqual({ x: 1, y: 1 });
    expect(p[p.length - 1]).toEqual({ x: 4, y: 3 });
  });
});

describe('fishing table', () => {
  const ctx = (o: Partial<Parameters<typeof rollFish>[1]> = {}) => ({ season: 'spring' as const, weather: 'sunny' as const, hour: 8, level: 1, ...o });
  const sample = (c: ReturnType<typeof ctx>, n = 3000) => {
    const rng = new Rng(5);
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const f = rollFish(rng, c) ?? 'none';
      counts[f] = (counts[f] ?? 0) + 1;
    }
    return counts;
  };
  it('glow eels only appear at night in summer/autumn with enough skill', () => {
    expect(sample(ctx({ hour: 8, season: 'summer', level: 5 }))['glow_eel']).toBeUndefined();
    expect(sample(ctx({ hour: 22, season: 'spring', level: 5 }))['glow_eel']).toBeUndefined();
    expect(sample(ctx({ hour: 22, season: 'summer', level: 1 }))['glow_eel']).toBeUndefined();
    expect(sample(ctx({ hour: 22, season: 'summer', level: 5 }))['glow_eel']).toBeGreaterThan(0);
  });
  it('silver bass is a morning fish that bites more in rain', () => {
    expect(sample(ctx({ hour: 20 }))['silver_bass']).toBeUndefined();
    const dry = sample(ctx({ hour: 8 }))['silver_bass'];
    const wet = sample(ctx({ hour: 8, weather: 'rain' }))['silver_bass'];
    expect(wet).toBeGreaterThan(dry);
  });
  it('sometimes nothing bites, and every fish id is a real item', async () => {
    expect(sample(ctx())['none']).toBeGreaterThan(100);
    const { ITEMS } = await import('../src/data/items');
    for (const f of FISH) expect(ITEMS[f.id]).toBeTruthy();
  });
});

describe('crafting & cooking', () => {
  it('recipes only reference real items', async () => {
    const { ITEMS } = await import('../src/data/items');
    for (const r of RECIPES) {
      expect(ITEMS[r.output.id], r.id).toBeTruthy();
      for (const i of r.inputs) expect(ITEMS[i.id], `${r.id}:${i.id}`).toBeTruthy();
    }
  });
  it('consumes inputs, yields outputs, spends energy', () => {
    const s = freshState();
    addItem(s, 'fiber', 3); addItem(s, 'wood', 1);
    const e = s.player.energy;
    expect(craft(s, 'fertilizer')).toEqual({ ok: true });
    expect(countItem(s, 'fertilizer')).toBe(2);
    expect(countItem(s, 'fiber')).toBe(0);
    expect(s.player.energy).toBe(e - 2);
  });
  it('fails cleanly when ingredients are missing or space is lacking', () => {
    const s = freshState();
    expect(craft(s, 'fertilizer')).toMatchObject({ ok: false, reason: 'missing' });
    expect(craft(s, 'nope')).toMatchObject({ ok: false, reason: 'unknown' });
    expect(canCraft(s, RECIPES[0])).toBe(false);
  });
  it('rolls back inputs if the product cannot fit', () => {
    const s = freshState();
    s.inventory.slots = s.inventory.slots.map(() => ({ id: 'stone', qty: 99, q: 0 }));
    s.inventory.slots[0] = { id: 'turnip', qty: 2, q: 0 };
    s.inventory.slots[1] = { id: 'wild_berry', qty: 1, q: 0 };
    // consuming inputs frees slots 0 and 1, so stew fits
    expect(craft(s, 'turnip_stew')).toEqual({ ok: true });
    // now make it fail: fill again so nothing frees up
    s.inventory.slots = s.inventory.slots.map(() => ({ id: 'stone', qty: 99, q: 0 }));
    s.inventory.slots[0] = { id: 'turnip', qty: 5, q: 0 };
    s.inventory.slots[1] = { id: 'fiber', qty: 5, q: 0 };
    s.inventory.slots[2] = { id: 'turnip_stew', qty: 99, q: 0 };
    const before = JSON.stringify(s.inventory.slots);
    s.inventory.slots[3] = { id: 'wild_berry', qty: 1, q: 0 };
    // bread needs 1 turnip + 1 fiber; stacks remain so bread would need a free slot -> none free
    const snap = JSON.stringify(s.inventory.slots);
    const r = craft(s, 'bread');
    expect(r).toMatchObject({ ok: false, reason: 'noSpace' });
    expect(JSON.stringify(s.inventory.slots)).toBe(snap);
    void before;
  });
});
