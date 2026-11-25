import { DAYS_PER_SEASON, SEASONS, type Season, type WeatherType } from '../config/constants';
import { Rng, hashSeed } from './Rng';

export interface DateInfo {
  /** 1-based day of the season (1..28) */
  dayOfSeason: number;
  seasonIndex: number;
  season: Season;
  year: number;
  /** 0 = Monday ... 6 = Sunday */
  weekday: number;
}

/** `day` is the 1-based total day count since the game began. */
export function dateFromDay(day: number): DateInfo {
  const d0 = Math.max(0, day - 1);
  const daysPerYear = DAYS_PER_SEASON * SEASONS.length;
  const year = Math.floor(d0 / daysPerYear) + 1;
  const inYear = d0 % daysPerYear;
  const seasonIndex = Math.floor(inYear / DAYS_PER_SEASON);
  return {
    dayOfSeason: (inYear % DAYS_PER_SEASON) + 1,
    seasonIndex,
    season: SEASONS[seasonIndex],
    year,
    weekday: d0 % 7
  };
}

export interface Festival {
  id: string;
  seasonIndex: number;
  dayOfSeason: number;
}

export const FESTIVALS: Festival[] = [
  { id: 'blossom_fair', seasonIndex: 0, dayOfSeason: 12 },
  { id: 'tide_lantern', seasonIndex: 1, dayOfSeason: 15 },
  { id: 'harvest_feast', seasonIndex: 2, dayOfSeason: 16 },
  { id: 'starfall_night', seasonIndex: 3, dayOfSeason: 20 }
];

export function festivalOn(day: number): Festival | undefined {
  const d = dateFromDay(day);
  return FESTIVALS.find((f) => f.seasonIndex === d.seasonIndex && f.dayOfSeason === d.dayOfSeason);
}

const WEATHER_TABLE: Record<Season, Array<[WeatherType, number]>> = {
  spring: [['sunny', 45], ['cloudy', 20], ['rain', 25], ['fog', 8], ['storm', 2]],
  summer: [['sunny', 55], ['cloudy', 15], ['rain', 12], ['storm', 13], ['fog', 5]],
  autumn: [['sunny', 30], ['cloudy', 25], ['rain', 25], ['fog', 15], ['storm', 5]],
  winter: [['sunny', 25], ['cloudy', 25], ['snow', 35], ['fog', 10], ['storm', 5]]
};

/** Deterministic weather for a given day, derived from the world seed so reloads agree with saves. */
export function weatherForDay(seed: number, day: number): WeatherType {
  const d = dateFromDay(day);
  // Fixed-sunny first days and festival days keep onboarding and events pleasant.
  if (day <= 2) return 'sunny';
  if (festivalOn(day)) return 'sunny';
  const rng = new Rng(hashSeed('weather', seed, day));
  const table = WEATHER_TABLE[d.season];
  const total = table.reduce((a, [, w]) => a + w, 0);
  let roll = rng.next() * total;
  for (const [w, weight] of table) {
    if (roll < weight) return w;
    roll -= weight;
  }
  return 'sunny';
}

export function formatClock(minutes: number): { h: number; m: number } {
  const total = Math.floor(minutes);
  return { h: Math.floor(total / 60) % 24, m: total % 60 };
}

/** 0 (full night) .. 1 (full day) for lighting. */
export function daylight(minutes: number): number {
  const h = (minutes / 60) % 24;
  if (h >= 8 && h < 17) return 1;
  if (h >= 17 && h < 20) return 1 - (h - 17) / 3 * 0.85; // dusk
  if (h >= 20 || h < 4.5) return 0.15; // night
  if (h >= 4.5 && h < 6) return 0.15 + ((h - 4.5) / 1.5) * 0.4;
  return 0.55 + ((h - 6) / 2) * 0.45; // dawn 6..8
}
