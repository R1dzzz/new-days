import { describe, it, expect } from 'vitest';
import { freshState } from './helpers';
import { till, water, plant, harvest, dailyFarmUpdate, fertilize, getPlot, applyRainWatering } from '../src/systems/Farming';
import { startNewDay } from '../src/core/TimeSystem';

describe('farming', () => {
  it('requires tilling before watering or planting', () => {
    const s = freshState();
    expect(water(s, 1, 1)).toMatchObject({ ok: false, reason: 'notTilled' });
    expect(plant(s, 1, 1, 'seed_turnip')).toMatchObject({ ok: false, reason: 'notTilled' });
    expect(till(s, 1, 1, false)).toMatchObject({ ok: false, reason: 'notTillable' });
    expect(till(s, 1, 1, true).ok).toBe(true);
    expect(till(s, 1, 1, true)).toMatchObject({ ok: false, reason: 'alreadyTilled' });
  });
  it('rejects out-of-season seeds', () => {
    const s = freshState();
    till(s, 1, 1, true);
    expect(plant(s, 1, 1, 'seed_tomato')).toMatchObject({ ok: false, reason: 'wrongSeason' });
    expect(plant(s, 1, 1, 'seed_turnip').ok).toBe(true);
    expect(plant(s, 1, 1, 'seed_turnip')).toMatchObject({ ok: false, reason: 'occupied' });
  });
  it('turnip is harvestable after 4 watered days and not before', () => {
    const s = freshState();
    till(s, 2, 2, true);
    plant(s, 2, 2, 'seed_turnip');
    for (let i = 0; i < 3; i++) {
      water(s, 2, 2);
      dailyFarmUpdate(s, 'sunny');
    }
    expect(harvest(s, 2, 2)).toMatchObject({ ok: false, reason: 'notReady' });
    water(s, 2, 2);
    dailyFarmUpdate(s, 'sunny');
    const h = harvest(s, 2, 2);
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.result.item).toBe('turnip');
    expect(getPlot(s, 2, 2)!.crop).toBeUndefined();
  });
  it('unwatered crops do not grow; rain waters them', () => {
    const s = freshState();
    till(s, 3, 3, true);
    plant(s, 3, 3, 'seed_turnip');
    dailyFarmUpdate(s, 'sunny');
    expect(getPlot(s, 3, 3)!.progress).toBe(0);
    dailyFarmUpdate(s, 'rain');
    expect(getPlot(s, 3, 3)!.progress).toBe(1);
  });
  it('rain pre-waters tilled plots at the start of the day', () => {
    const s = freshState();
    till(s, 4, 4, true);
    applyRainWatering(s, 'rain');
    expect(getPlot(s, 4, 4)!.watered).toBe(true);
  });
  it('crops wither when the season changes', () => {
    const s = freshState();
    till(s, 5, 5, true);
    plant(s, 5, 5, 'seed_turnip');
    s.time.day = 29; // summer
    const r = dailyFarmUpdate(s, 'sunny');
    expect(r.withered).toBe(1);
    expect(getPlot(s, 5, 5)!.crop).toBeUndefined();
  });
  it('fertilizer speeds growth and can only be applied once', () => {
    const s = freshState();
    till(s, 6, 6, true);
    expect(fertilize(s, 6, 6).ok).toBe(true);
    expect(fertilize(s, 6, 6)).toMatchObject({ ok: false, reason: 'alreadyFertilized' });
    plant(s, 6, 6, 'seed_turnip');
    water(s, 6, 6);
    dailyFarmUpdate(s, 'sunny');
    expect(getPlot(s, 6, 6)!.progress).toBe(1.25);
  });
  it('startNewDay advances the calendar, resets the clock and restores energy', () => {
    const s = freshState();
    s.player.energy = 5;
    s.time.minutes = 1300;
    startNewDay(s, 'normal', false);
    expect(s.time.day).toBe(2);
    expect(s.time.minutes).toBe(360);
    expect(s.player.energy).toBeGreaterThan(90);
    expect(s.stats['slept']).toBe(1);
  });
});
