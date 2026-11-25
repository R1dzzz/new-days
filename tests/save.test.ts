import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { SaveManager } from '../src/core/SaveManager';
import { checksum, validateState } from '../src/core/SaveValidation';
import { freshState } from './helpers';
import { addItem } from '../src/systems/Inventory';

let mgr: SaveManager;
beforeEach(() => {
  mgr = new SaveManager(new IDBFactory());
});

describe('validation', () => {
  it('accepts a fresh state', () => {
    expect(validateState(freshState()).ok).toBe(true);
  });
  it('rejects malformed states with useful errors', () => {
    const s: any = freshState();
    s.inventory.slots[0] = { id: 'not_an_item', qty: 1, q: 0 };
    s.player.gold = -5;
    s.time.day = 0;
    const r = validateState(s);
    expect(r.ok).toBe(false);
    expect(r.errors.join('|')).toMatch(/unknown item/);
    expect(r.errors.join('|')).toMatch(/gold/);
    expect(r.errors.join('|')).toMatch(/time/);
  });
  it('rejects non-objects and future versions', () => {
    expect(validateState(null).ok).toBe(false);
    const s: any = freshState();
    s.version = 999;
    expect(validateState(s).ok).toBe(false);
  });
  it('checksum is stable and sensitive to changes', () => {
    expect(checksum('abc')).toBe(checksum('abc'));
    expect(checksum('abc')).not.toBe(checksum('abd'));
  });
});

describe('SaveManager', () => {
  it('round-trips a save including inventory, farm, and stats', async () => {
    const s = freshState();
    addItem(s, 'wood', 12);
    s.player.gold = 777;
    s.farm.plots['3,4'] = { tilled: true, watered: false, fertilized: false, crop: 'turnip', progress: 2, quality: 0 };
    s.stats['harvested'] = 5;
    await mgr.save(1, s);
    const res = await mgr.load(1);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.recoveredFromBackup).toBe(false);
      expect(res.state.player.gold).toBe(777);
      expect(res.state.farm.plots['3,4'].progress).toBe(2);
      expect(res.state.stats['harvested']).toBe(5);
      expect(res.state.inventory.slots.some((x) => x?.id === 'wood' && x.qty === 12)).toBe(true);
    }
  });
  it('reports empty slots', async () => {
    expect(await mgr.load(2)).toMatchObject({ ok: false, reason: 'empty' });
    expect((await mgr.summary(2)).empty).toBe(true);
  });
  it('refuses to save an invalid state and keeps the old save', async () => {
    const good = freshState();
    good.player.gold = 111;
    await mgr.save(1, good);
    const bad: any = freshState();
    bad.inventory.slots = [];
    await expect(mgr.save(1, bad)).rejects.toThrow(/invalid/i);
    const res = await mgr.load(1);
    expect(res.ok && res.state.player.gold).toBe(111);
  });
  it('keeps the previous save as a backup and recovers from corruption', async () => {
    const a = freshState();
    a.player.gold = 100;
    await mgr.save(1, a);
    const b = freshState();
    b.player.gold = 200;
    await mgr.save(1, b);
    // corrupt the primary record directly
    const db: IDBDatabase = await (mgr as any).db();
    const tx = db.transaction('saves', 'readwrite');
    const store = tx.objectStore('saves');
    const rec: any = await new Promise((r) => (store.get('slot:1').onsuccess = (e: any) => r(e.target.result)));
    rec.payload = rec.payload.slice(0, rec.payload.length - 20);
    store.put(rec);
    await new Promise<void>((r) => (tx.oncomplete = () => r()));
    const res = await mgr.load(1);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.recoveredFromBackup).toBe(true);
      expect(res.state.player.gold).toBe(100);
    }
  });
  it('reports corrupt when both primary and backup are broken', async () => {
    await mgr.save(1, freshState());
    const db: IDBDatabase = await (mgr as any).db();
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put({ key: 'slot:1', slot: 1, payload: '{garbage', checksum: 'x', version: 1, savedAt: 1 });
    await new Promise<void>((r) => (tx.oncomplete = () => r()));
    expect(await mgr.load(1)).toMatchObject({ ok: false, reason: 'corrupt' });
    expect((await mgr.summary(1)).corrupt).toBe(true);
  });
  it('lists slots and finds the latest save for Continue', async () => {
    const a = freshState();
    await mgr.save(2, a);
    await new Promise((r) => setTimeout(r, 5));
    const b = freshState();
    b.player.name = 'Later';
    await mgr.save(1, b);
    const latest = await mgr.latest();
    expect(latest?.slot).toBe(1);
    expect((await mgr.listSlots()).length).toBe(4);
  });
  it('export/import round-trips and rejects tampered files', async () => {
    const s = freshState();
    s.player.gold = 4242;
    await mgr.save(1, s);
    const text = await mgr.exportSlot(1);
    await mgr.importToSlot(3, text);
    const res = await mgr.load(3);
    expect(res.ok && res.state.player.gold).toBe(4242);

    const env = JSON.parse(text);
    env.payload = env.payload.replace('4242', '9999999');
    await expect(mgr.importToSlot(2, JSON.stringify(env))).rejects.toThrow(/checksum/i);
    await expect(mgr.importToSlot(2, 'not json')).rejects.toThrow();
    await expect(mgr.importToSlot(2, JSON.stringify({ format: 'other' }))).rejects.toThrow();
    expect((await mgr.summary(2)).empty).toBe(true);
  });
  it('delete removes slot and backup', async () => {
    await mgr.save(1, freshState());
    await mgr.save(1, freshState());
    await mgr.delete(1);
    expect(await mgr.load(1)).toMatchObject({ ok: false, reason: 'empty' });
  });
});
