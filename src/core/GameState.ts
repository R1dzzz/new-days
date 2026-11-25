import { DAY_START_MIN, HOTBAR_SIZE, INVENTORY_SIZE, SAVE_VERSION, SKILLS, type SkillId, type WeatherType } from '../config/constants';

export interface Appearance {
  skin: number;
  hairStyle: number;
  hairColor: number;
  outfitStyle: number;
  outfitColor: number;
}

export interface ItemStack {
  id: string;
  qty: number;
  /** 0 normal, 1 silver, 2 gold */
  q: number;
}

export interface PlotState {
  tilled: boolean;
  watered: boolean;
  fertilized: boolean;
  crop?: string;
  /** Watered days accumulated. */
  progress: number;
  quality: number;
}

export interface SkillState {
  xp: number;
  level: number;
}

export interface NpcRelation {
  points: number;
  talkedDay: number;
  giftedDay: number;
  seenEvents: string[];
}

export interface QuestProgress {
  /** stat snapshot taken at quest start so objectives count only new actions */
  baseline: Record<string, number>;
  stage: number;
}

export interface GameState {
  version: number;
  meta: {
    name: string;
    createdAt: number;
    savedAt: number;
    playTimeMs: number;
    seed: number;
  };
  player: {
    name: string;
    appearance: Appearance;
    x: number;
    y: number;
    facing: 'up' | 'down' | 'left' | 'right';
    hp: number;
    maxHp: number;
    energy: number;
    maxEnergy: number;
    hunger: number;
    gold: number;
    skills: Record<SkillId, SkillState>;
  };
  time: { day: number; minutes: number };
  weather: { today: WeatherType; tomorrow: WeatherType };
  inventory: {
    slots: Array<ItemStack | null>;
    selected: number;
  };
  farm: { plots: Record<string, PlotState> };
  world: {
    /** object id -> day it becomes available again (resource respawn). 0/absent = available */
    depleted: Record<string, number>;
    /** id -> remaining hits/health on harvestable objects */
    damage: Record<string, number>;
    /** placed object ids (chests, scarecrows) -> data */
    placed: Record<string, { type: string; x: number; y: number; contents?: Array<ItemStack | null> }>;
    discoveries: string[];
  };
  npcs: Record<string, NpcRelation>;
  quests: {
    active: Record<string, QuestProgress>;
    completed: string[];
  };
  /** Monotonic counters used by quests/achievements: gathered:wood, planted, harvested, ... */
  stats: Record<string, number>;
  flags: Record<string, boolean | number | string>;
}

export function emptySkills(): Record<SkillId, SkillState> {
  const out = {} as Record<SkillId, SkillState>;
  for (const s of SKILLS) out[s] = { xp: 0, level: 1 };
  return out;
}

export const DEFAULT_APPEARANCE: Appearance = { skin: 1, hairStyle: 0, hairColor: 0, outfitStyle: 0, outfitColor: 0 };

export function createNewState(name: string, appearance: Appearance, seed: number, spawn: { x: number; y: number }): GameState {
  const slots: Array<ItemStack | null> = new Array(INVENTORY_SIZE).fill(null);
  const starter = ['hoe', 'can', 'axe', 'pick', 'rod'];
  starter.forEach((id, i) => (slots[i] = { id, qty: 1, q: 0 }));
  slots[5] = { id: 'seed_turnip', qty: 6, q: 0 };
  slots[6] = { id: 'bread', qty: 2, q: 0 };
  void HOTBAR_SIZE;

  const now = Date.now();
  return {
    version: SAVE_VERSION,
    meta: { name, createdAt: now, savedAt: now, playTimeMs: 0, seed },
    player: {
      name,
      appearance: { ...appearance },
      x: spawn.x,
      y: spawn.y,
      facing: 'down',
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      hunger: 80,
      gold: 50,
      skills: emptySkills()
    },
    time: { day: 1, minutes: DAY_START_MIN },
    weather: { today: 'sunny', tomorrow: 'sunny' },
    inventory: { slots, selected: 0 },
    farm: { plots: {} },
    world: { depleted: {}, damage: {}, placed: {}, discoveries: [] },
    npcs: {},
    quests: { active: {}, completed: [] },
    stats: {},
    flags: {}
  };
}
