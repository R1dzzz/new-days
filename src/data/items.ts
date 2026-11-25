import type { SkillId } from '../config/constants';

export type ItemCategory = 'tool' | 'seed' | 'crop' | 'resource' | 'food' | 'material' | 'gift' | 'misc';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';
export type ToolKind = 'hoe' | 'can' | 'axe' | 'pick' | 'rod';

export interface ItemDef {
  id: string;
  category: ItemCategory;
  rarity: Rarity;
  /** Base sell price in gold. 0 = cannot be sold. */
  sell: number;
  /** Base buy price (when a merchant offers it). */
  buy?: number;
  stack: number;
  tool?: ToolKind;
  /** Energy restored when eaten. */
  energy?: number;
  /** Health restored when eaten. */
  health?: number;
  /** Hunger restored when eaten (0..100 scale). */
  hunger?: number;
  /** Plant data key if this is a seed. */
  plants?: string;
  /** i18n keys are derived: item.<id>.name / item.<id>.desc */
}

const def = (d: ItemDef): ItemDef => d;

export const ITEMS: Record<string, ItemDef> = {
  // --- tools ---
  hoe: def({ id: 'hoe', category: 'tool', rarity: 'common', sell: 0, stack: 1, tool: 'hoe' }),
  can: def({ id: 'can', category: 'tool', rarity: 'common', sell: 0, stack: 1, tool: 'can' }),
  axe: def({ id: 'axe', category: 'tool', rarity: 'common', sell: 0, stack: 1, tool: 'axe' }),
  pick: def({ id: 'pick', category: 'tool', rarity: 'common', sell: 0, stack: 1, tool: 'pick' }),
  rod: def({ id: 'rod', category: 'tool', rarity: 'common', sell: 0, stack: 1, tool: 'rod' }),

  // --- seeds ---
  seed_turnip: def({ id: 'seed_turnip', category: 'seed', rarity: 'common', sell: 5, buy: 12, stack: 99, plants: 'turnip' }),
  seed_tomato: def({ id: 'seed_tomato', category: 'seed', rarity: 'common', sell: 8, buy: 20, stack: 99, plants: 'tomato' }),
  seed_pumpkin: def({ id: 'seed_pumpkin', category: 'seed', rarity: 'common', sell: 12, buy: 30, stack: 99, plants: 'pumpkin' }),
  seed_frostleaf: def({ id: 'seed_frostleaf', category: 'seed', rarity: 'uncommon', sell: 10, buy: 26, stack: 99, plants: 'frostleaf' }),

  // --- crops ---
  turnip: def({ id: 'turnip', category: 'crop', rarity: 'common', sell: 28, stack: 99, energy: 12, hunger: 10 }),
  tomato: def({ id: 'tomato', category: 'crop', rarity: 'common', sell: 45, stack: 99, energy: 15, hunger: 12 }),
  pumpkin: def({ id: 'pumpkin', category: 'crop', rarity: 'uncommon', sell: 95, stack: 99, energy: 25, hunger: 22 }),
  frostleaf: def({ id: 'frostleaf', category: 'crop', rarity: 'uncommon', sell: 70, stack: 99, energy: 20, hunger: 12 }),

  // --- resources ---
  wood: def({ id: 'wood', category: 'resource', rarity: 'common', sell: 4, stack: 99 }),
  stone: def({ id: 'stone', category: 'resource', rarity: 'common', sell: 3, stack: 99 }),
  fiber: def({ id: 'fiber', category: 'resource', rarity: 'common', sell: 2, stack: 99 }),
  copper_ore: def({ id: 'copper_ore', category: 'resource', rarity: 'uncommon', sell: 18, stack: 99 }),
  crystal_shard: def({ id: 'crystal_shard', category: 'resource', rarity: 'rare', sell: 60, stack: 99 }),
  seashell: def({ id: 'seashell', category: 'gift', rarity: 'common', sell: 12, stack: 99 }),
  wild_berry: def({ id: 'wild_berry', category: 'food', rarity: 'common', sell: 8, stack: 99, energy: 8, hunger: 8 }),
  moon_flower: def({ id: 'moon_flower', category: 'gift', rarity: 'rare', sell: 80, stack: 99 }),
  fertilizer: def({ id: 'fertilizer', category: 'material', rarity: 'common', sell: 6, buy: 18, stack: 99 }),

  // --- fish ---
  minnow: def({ id: 'minnow', category: 'food', rarity: 'common', sell: 15, stack: 99, energy: 10, hunger: 12 }),
  silver_bass: def({ id: 'silver_bass', category: 'food', rarity: 'uncommon', sell: 42, stack: 99, energy: 22, hunger: 20 }),
  glow_eel: def({ id: 'glow_eel', category: 'food', rarity: 'rare', sell: 140, stack: 99, energy: 35, hunger: 25 }),

  // --- food ---
  bread: def({ id: 'bread', category: 'food', rarity: 'common', sell: 20, buy: 40, stack: 99, energy: 30, hunger: 35, health: 5 }),
  turnip_stew: def({ id: 'turnip_stew', category: 'food', rarity: 'uncommon', sell: 60, stack: 99, energy: 45, hunger: 45, health: 15 })
};

export function getItem(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item id: ${id}`);
  return d;
}

export function isItemId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ITEMS, id);
}

/** Quality tiers for crops/fish: 0 normal, 1 silver, 2 gold. */
export const QUALITY_MULT = [1, 1.25, 1.5] as const;

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#d8d2c0',
  uncommon: '#7fd6a2',
  rare: '#6fb3ff',
  epic: '#d890ff'
};

export const SKILL_FOR_CATEGORY: Partial<Record<ItemCategory, SkillId>> = {
  crop: 'farming'
};
