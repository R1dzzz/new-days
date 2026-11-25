export type SpotId = 'beach_pier' | 'market' | 'lighthouse' | 'bram_shop' | 'bram_field' | 'shelter_mira' | 'shelter_bram' | 'campfire';

export interface ScheduleEntry {
  /** Hour of day (0-26) this entry starts. Entries are sorted ascending; the last one that started wins. */
  from: number;
  spot: SpotId;
  /** If true this entry is used on rainy/stormy days instead (shelter). */
  indoor?: boolean;
}

export interface NpcDef {
  id: string;
  /** Appearance indices into the sprite palette */
  look: { skin: number; hairStyle: number; hairColor: number; outfitStyle: number; outfitColor: number };
  loved: string[];
  liked: string[];
  hated: string[];
  schedule: ScheduleEntry[];
  rainSchedule: ScheduleEntry[];
  /** Shop id this NPC runs, if any. */
  shop?: string;
  /** Dialogue entry node ids by friendship tier (0..4). Falls back to lower tiers. */
  greeting: Record<number, string[]>;
  /** One-time friendship events keyed by id; triggered at a friendship threshold. */
  events: Array<{ id: string; atPoints: number; node: string }>;
}

export const NPCS: Record<string, NpcDef> = {
  mira: {
    id: 'mira',
    look: { skin: 2, hairStyle: 2, hairColor: 3, outfitStyle: 1, outfitColor: 2 },
    loved: ['seashell', 'moon_flower'],
    liked: ['wild_berry', 'silver_bass', 'tomato'],
    hated: ['stone', 'fiber'],
    schedule: [
      { from: 6, spot: 'beach_pier' },
      { from: 12, spot: 'market' },
      { from: 18, spot: 'lighthouse' },
      { from: 23, spot: 'shelter_mira' }
    ],
    rainSchedule: [
      { from: 6, spot: 'shelter_mira', indoor: true },
      { from: 12, spot: 'market', indoor: true },
      { from: 20, spot: 'shelter_mira', indoor: true }
    ],
    greeting: {
      0: ['mira.greet.stranger'],
      1: ['mira.greet.acquaintance', 'mira.greet.tide'],
      2: ['mira.greet.friend', 'mira.greet.lighthouse'],
      3: ['mira.greet.close']
    },
    events: [
      { id: 'mira_first_meeting', atPoints: 0, node: 'mira.event.first' },
      { id: 'mira_lighthouse_secret', atPoints: 250, node: 'mira.event.lighthouse' }
    ]
  },
  bram: {
    id: 'bram',
    look: { skin: 0, hairStyle: 3, hairColor: 5, outfitStyle: 2, outfitColor: 1 },
    loved: ['pumpkin', 'turnip_stew'],
    liked: ['turnip', 'bread', 'copper_ore'],
    hated: ['seashell'],
    shop: 'bram_general',
    schedule: [
      { from: 6, spot: 'bram_field' },
      { from: 9, spot: 'bram_shop' },
      { from: 18, spot: 'campfire' },
      { from: 22, spot: 'shelter_bram' }
    ],
    rainSchedule: [
      { from: 6, spot: 'shelter_bram', indoor: true },
      { from: 9, spot: 'bram_shop', indoor: true },
      { from: 18, spot: 'shelter_bram', indoor: true }
    ],
    greeting: {
      0: ['bram.greet.stranger'],
      1: ['bram.greet.acquaintance', 'bram.greet.weather'],
      2: ['bram.greet.friend'],
      3: ['bram.greet.close']
    },
    events: [
      { id: 'bram_first_meeting', atPoints: 0, node: 'bram.event.first' },
      { id: 'bram_old_ship', atPoints: 250, node: 'bram.event.ship' }
    ]
  }
};

export interface ShopDef {
  id: string;
  /** item id -> optional stock rule (always available if no season list). */
  stock: Array<{ item: string; seasons?: string[] }>;
  /** Buys items of these categories (sell price multiplier). */
  sellMult: number;
}

export const SHOPS: Record<string, ShopDef> = {
  bram_general: {
    id: 'bram_general',
    sellMult: 1,
    stock: [
      { item: 'seed_turnip', seasons: ['spring', 'autumn'] },
      { item: 'seed_tomato', seasons: ['summer'] },
      { item: 'seed_pumpkin', seasons: ['autumn'] },
      { item: 'seed_frostleaf', seasons: ['winter'] },
      { item: 'fertilizer' },
      { item: 'bread' }
    ]
  }
};

/** Friendship points -> heart tier (0..4). Each tier = 250 points (max 1000 = 4 full tiers shown as 8 half hearts). */
export const POINTS_PER_HEART = 125;
export const MAX_FRIENDSHIP = 1000;

export function friendshipTier(points: number): number {
  return Math.min(4, Math.floor(points / 250));
}

export function hearts(points: number): number {
  return Math.min(8, Math.floor(points / POINTS_PER_HEART));
}

export function giftReaction(npc: NpcDef, itemId: string): 'love' | 'like' | 'neutral' | 'hate' {
  if (npc.loved.includes(itemId)) return 'love';
  if (npc.liked.includes(itemId)) return 'like';
  if (npc.hated.includes(itemId)) return 'hate';
  return 'neutral';
}

export const GIFT_POINTS = { love: 80, like: 45, neutral: 20, hate: -40 } as const;
