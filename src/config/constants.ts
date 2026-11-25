export const GAME_VERSION = '0.1.0';
export const SAVE_VERSION = 1;
export const SAVE_SLOTS = 3;

export const TILE = 32;

/** Day runs from 06:00 (360) to 26:00 (1560 = 02:00 next morning, forced sleep). */
export const DAY_START_MIN = 6 * 60;
export const DAY_END_MIN = 26 * 60;
/** Game minutes that pass per real second at "normal" time speed. */
export const GAME_MIN_PER_SEC = 1.5;

export const DAYS_PER_SEASON = 28;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const INVENTORY_SIZE = 24;
export const HOTBAR_SIZE = 8;

export const WEATHERS = ['sunny', 'cloudy', 'rain', 'storm', 'fog', 'snow'] as const;
export type WeatherType = (typeof WEATHERS)[number];

export const SKILLS = ['farming', 'foraging', 'mining', 'fishing', 'combat'] as const;
export type SkillId = (typeof SKILLS)[number];
export const MAX_SKILL_LEVEL = 10;

export const AUTOSAVE_INTERVAL_MS = 90_000;
export const AUTOSAVE_SLOT_INDEX = 0; // slot 0 is the rolling auto-save; manual slots are 1..SAVE_SLOTS
