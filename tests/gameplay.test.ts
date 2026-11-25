import { describe, it, expect } from 'vitest';
import { freshState } from './helpers';
import { startQuest, checkQuests, bumpStat, objectiveProgress } from '../src/systems/Quests';
import { addFriendship, giveGift, markTalked, pendingEvent } from '../src/systems/Relationships';
import { sellFromSlot, buyItem, shopStock } from '../src/systems/Economy';
import { addItem, countItem } from '../src/systems/Inventory';
import { addXp, xpForNext } from '../src/systems/Skills';
import { eatSlot, tickNeeds, spendEnergy } from '../src/systems/Needs';
import { discover } from '../src/systems/Discovery';
import { sanitizeSettings } from '../src/core/Settings';
import { giftReaction, NPCS, friendshipTier } from '../src/data/npcs';

describe('quests', () => {
  it('counts only progress made after the quest starts', () => {
    const s = freshState();
    s.stats['gathered:wood'] = 50;
    startQuest(s, 'ch1_washed_ashore');
    expect(objectiveProgress(s, 'ch1_washed_ashore')[0].current).toBe(0);
    bumpStat(s, 'gathered:wood', 5);
    expect(objectiveProgress(s, 'ch1_washed_ashore')[0].current).toBe(5);
  });
  it('completes, pays rewards once, and chains to the next quest', () => {
    const s = freshState();
    startQuest(s, 'ch1_washed_ashore');
    const gold = s.player.gold;
    bumpStat(s, 'gathered:wood', 5);
    bumpStat(s, 'gathered:stone', 3);
    expect(s.quests.completed).not.toContain('ch1_washed_ashore');
    bumpStat(s, 'planted', 3);
    expect(s.quests.completed).toContain('ch1_washed_ashore');
    expect(s.player.gold).toBe(gold + 60);
    expect(s.quests.active['ch1_meet_neighbors']).toBeTruthy();
    checkQuests(s);
    expect(s.player.gold).toBe(gold + 60);
  });
  it('cannot restart a completed or active quest, and unknown quests fail safely', () => {
    const s = freshState();
    expect(startQuest(s, 'ch1_washed_ashore')).toBe(true);
    expect(startQuest(s, 'ch1_washed_ashore')).toBe(false);
    expect(startQuest(s, 'nope')).toBe(false);
  });
  it('discovery-based quest completes when the lore entry is found', () => {
    const s = freshState();
    startQuest(s, 'ch1_lantern_mystery');
    discover(s, 'lore.lighthouse');
    checkQuests(s);
    expect(s.quests.completed).toContain('ch1_lantern_mystery');
    expect(discover(s, 'lore.lighthouse')).toBe(false);
  });
});

describe('relationships', () => {
  it('first talk of the day gives friendship once per day', () => {
    const s = freshState();
    expect(markTalked(s, 'mira')).toBe(true);
    expect(markTalked(s, 'mira')).toBe(false);
    expect(s.npcs['mira'].points).toBe(10);
    s.time.day = 2;
    expect(markTalked(s, 'mira')).toBe(true);
    expect(s.npcs['mira'].points).toBe(20);
  });
  it('gifts follow preferences and are limited to one per day', () => {
    const s = freshState();
    addItem(s, 'seashell', 2);
    addItem(s, 'stone', 1);
    const shellSlot = s.inventory.slots.findIndex((x) => x?.id === 'seashell');
    expect(giveGift(s, 'mira', shellSlot)).toBe('love');
    expect(s.npcs['mira'].points).toBe(80);
    expect(giveGift(s, 'mira', shellSlot)).toBe('already');
    expect(countItem(s, 'seashell')).toBe(1);
    s.time.day = 2;
    const stoneSlot = s.inventory.slots.findIndex((x) => x?.id === 'stone');
    expect(giveGift(s, 'mira', stoneSlot)).toBe('hate');
    expect(s.npcs['mira'].points).toBe(40);
  });
  it('friendship is clamped and events unlock at thresholds', () => {
    const s = freshState();
    addFriendship(s, 'mira', 99999);
    expect(s.npcs['mira'].points).toBe(1000);
    addFriendship(s, 'mira', -99999);
    expect(s.npcs['mira'].points).toBe(0);
    expect(pendingEvent(s, 'mira')).toBe('mira_first_meeting');
    s.npcs['mira'].seenEvents.push('mira_first_meeting');
    expect(pendingEvent(s, 'mira')).toBeUndefined();
    s.npcs['mira'].points = 260;
    expect(pendingEvent(s, 'mira')).toBe('mira_lighthouse_secret');
    expect(friendshipTier(260)).toBe(1);
  });
  it('gift reaction tables are consistent', () => {
    expect(giftReaction(NPCS.bram, 'pumpkin')).toBe('love');
    expect(giftReaction(NPCS.bram, 'seashell')).toBe('hate');
    expect(giftReaction(NPCS.bram, 'wood')).toBe('neutral');
  });
});

describe('economy', () => {
  it('selling applies quality multiplier, removes items and tracks stats', () => {
    const s = freshState();
    addItem(s, 'turnip', 2, 2);
    const slot = s.inventory.slots.findIndex((x) => x?.id === 'turnip');
    const gold = s.player.gold;
    const r = sellFromSlot(s, 'bram_general', slot, 2);
    expect(r).toMatchObject({ ok: true, gold: 2 * Math.floor(28 * 1.5) });
    expect(s.player.gold).toBe(gold + 2 * 42);
    expect(s.stats['sold']).toBe(2);
    expect(countItem(s, 'turnip')).toBe(0);
  });
  it('tools cannot be sold', () => {
    const s = freshState();
    expect(sellFromSlot(s, 'bram_general', 0)).toMatchObject({ ok: false, reason: 'unsellable' });
  });
  it('buying checks stock, season, gold and space; purchases do not count as gathering', () => {
    const s = freshState();
    expect(shopStock(s, 'bram_general')).toContain('seed_turnip');
    expect(shopStock(s, 'bram_general')).not.toContain('seed_tomato');
    expect(buyItem(s, 'bram_general', 'seed_tomato')).toMatchObject({ ok: false, reason: 'notStocked' });
    s.player.gold = 5;
    expect(buyItem(s, 'bram_general', 'seed_turnip')).toMatchObject({ ok: false, reason: 'noGold' });
    s.player.gold = 100;
    const before = s.stats['gathered:seed_turnip'] ?? 0;
    expect(buyItem(s, 'bram_general', 'seed_turnip', 2)).toMatchObject({ ok: true });
    expect(s.player.gold).toBe(100 - 24);
    expect(s.stats['gathered:seed_turnip'] ?? 0).toBe(before);
    s.inventory.slots = s.inventory.slots.map(() => ({ id: 'wood', qty: 99, q: 0 }));
    expect(buyItem(s, 'bram_general', 'bread')).toMatchObject({ ok: false, reason: 'noSpace' });
  });
});

describe('skills & needs', () => {
  it('levels up with carry-over xp', () => {
    const s = freshState();
    addXp(s, 'farming', xpForNext(1) + 5);
    expect(s.player.skills.farming.level).toBe(2);
    expect(s.player.skills.farming.xp).toBe(5);
  });
  it('energy spending is refused when exhausted and has no partial effect', () => {
    const s = freshState();
    s.player.energy = 1;
    expect(spendEnergy(s, 5, 0, 'normal')).toBe(false);
    expect(s.player.energy).toBe(1);
    s.player.energy = 50;
    expect(spendEnergy(s, 5, 0, 'normal')).toBe(true);
    expect(s.player.energy).toBe(45);
  });
  it('relaxed difficulty costs less energy than hard', () => {
    const a = freshState(); const b = freshState();
    spendEnergy(a, 10, 0, 'relaxed');
    spendEnergy(b, 10, 0, 'hard');
    expect(a.player.energy).toBeGreaterThan(b.player.energy);
  });
  it('eating restores stats, consumes the item, rejects inedible items', () => {
    const s = freshState();
    s.player.energy = 10; s.player.hunger = 10;
    const slot = s.inventory.slots.findIndex((x) => x?.id === 'bread');
    expect(eatSlot(s, slot)).toBe(true);
    expect(s.player.energy).toBe(40);
    expect(s.player.hunger).toBe(45);
    expect(eatSlot(s, 0)).toBe(false); // hoe
  });
  it('starvation drains health but never kills the player', () => {
    const s = freshState();
    s.player.hunger = 0;
    for (let i = 0; i < 1000; i++) tickNeeds(s, 60, 'hard');
    expect(s.player.hp).toBe(10);
  });
});

describe('settings sanitizing', () => {
  it('replaces garbage with defaults and clamps ranges', () => {
    const r = sanitizeSettings({ language: 'xx', musicVolume: 9, textScale: 'big', keys: { up: [] , down: ['K'] }, quality: 'high' });
    expect(r.language).toBe('en');
    expect(r.musicVolume).toBe(1);
    expect(r.textScale).toBe(1);
    expect(r.keys.up).toEqual(['W', 'UP']);
    expect(r.keys.down).toEqual(['K']);
    expect(r.quality).toBe('high');
  });
  it('handles non-object input', () => {
    expect(sanitizeSettings(null).language).toBe('en');
    expect(sanitizeSettings('x').musicVolume).toBe(0.6);
  });
});
