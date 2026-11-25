import { describe, it, expect } from 'vitest';
import { dateFromDay, weatherForDay, festivalOn, daylight } from '../src/core/Calendar';

describe('calendar', () => {
  it('day 1 is spring 1 year 1', () => {
    const d = dateFromDay(1);
    expect(d).toMatchObject({ dayOfSeason: 1, season: 'spring', year: 1 });
  });
  it('rolls seasons every 28 days and years every 112', () => {
    expect(dateFromDay(28).season).toBe('spring');
    expect(dateFromDay(29)).toMatchObject({ season: 'summer', dayOfSeason: 1 });
    expect(dateFromDay(113)).toMatchObject({ season: 'spring', year: 2, dayOfSeason: 1 });
  });
  it('weekday cycles through 7', () => {
    expect(dateFromDay(1).weekday).toBe(0);
    expect(dateFromDay(8).weekday).toBe(0);
    expect(dateFromDay(7).weekday).toBe(6);
  });
  it('weather is deterministic per seed+day and sunny on days 1-2', () => {
    expect(weatherForDay(42, 1)).toBe('sunny');
    expect(weatherForDay(42, 2)).toBe('sunny');
    for (let d = 3; d < 60; d++) expect(weatherForDay(42, d)).toBe(weatherForDay(42, d));
  });
  it('winter can snow but summer never does', () => {
    const summer = new Set<string>();
    const winter = new Set<string>();
    for (let d = 29; d < 57; d++) summer.add(weatherForDay(7, d));
    for (let seed = 0; seed < 20; seed++) for (let d = 85; d < 113; d++) winter.add(weatherForDay(seed, d));
    expect(summer.has('snow')).toBe(false);
    expect(winter.has('snow')).toBe(true);
  });
  it('festival days are sunny', () => {
    const fest = festivalOn(12);
    expect(fest?.id).toBe('blossom_fair');
    expect(weatherForDay(99, 12)).toBe('sunny');
  });
  it('daylight is bright at noon and dark at night', () => {
    expect(daylight(12 * 60)).toBe(1);
    expect(daylight(1 * 60)).toBeLessThan(0.3);
  });
});
