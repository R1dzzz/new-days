import { Rng } from '../core/Rng';
import type { SpotId } from '../data/npcs';

export const MAP_W = 64;
export const MAP_H = 48;

export const enum T {
  Water = 0,
  Sand = 1,
  Grass = 2,
  Pier = 3,
  Path = 4
}

export type ObjType = 'tree' | 'rock' | 'bush' | 'shell' | 'campfire' | 'stone' | 'workbench';

export interface WorldObject {
  id: string;
  type: ObjType;
  tx: number;
  ty: number;
  /** visual variant */
  v: number;
}

export interface Building {
  id: 'cabin' | 'shop' | 'lighthouse' | 'hut';
  /** footprint top-left and size in tiles */
  x: number;
  y: number;
  w: number;
  h: number;
  /** door tile (inside footprint, bottom row) */
  doorX: number;
  doorY: number;
}

export interface IslandData {
  terrain: Uint8Array;
  /** 1 = cannot walk. Includes water, buildings, solid objects. */
  blocked: Uint8Array;
  objects: WorldObject[];
  buildings: Building[];
  farmRect: { x: number; y: number; w: number; h: number };
  spots: Record<SpotId, { x: number; y: number }>;
  spawn: { x: number; y: number };
}

export const idx = (x: number, y: number) => y * MAP_W + x;
export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

const CX = 32;
const CY = 24;
const RX = 26;
const RY = 19;

function isLandShape(x: number, y: number): boolean {
  const dx = (x - CX) / RX;
  const dy = (y - CY) / RY;
  const a = Math.atan2(dy, dx);
  const wobble = 0.1 * Math.sin(3 * a + 0.6) + 0.06 * Math.sin(5 * a + 1.9) + 0.04 * Math.sin(9 * a);
  return dx * dx + dy * dy < 1 + wobble;
}

const BUILDINGS: Building[] = [
  { id: 'cabin', x: 26, y: 15, w: 4, h: 3, doorX: 28, doorY: 17 },
  { id: 'shop', x: 40, y: 15, w: 5, h: 3, doorX: 42, doorY: 17 },
  { id: 'lighthouse', x: 52, y: 19, w: 2, h: 3, doorX: 52, doorY: 21 },
  { id: 'hut', x: 12, y: 25, w: 3, h: 3, doorX: 13, doorY: 27 }
];

const SPOTS: Record<SpotId, { x: number; y: number }> = {
  beach_pier: { x: 32, y: 42 },
  market: { x: 38, y: 20 },
  lighthouse: { x: 52, y: 23 },
  bram_shop: { x: 42, y: 19 },
  bram_field: { x: 38, y: 26 },
  shelter_mira: { x: 13, y: 27 },
  shelter_bram: { x: 42, y: 17 },
  campfire: { x: 36, y: 33 }
};

const FARM = { x: 22, y: 22, w: 13, h: 9 };

function carvePath(terrain: Uint8Array, x0: number, y0: number, x1: number, y1: number): void {
  let x = x0;
  let y = y0;
  const mark = () => {
    if (inBounds(x, y) && terrain[idx(x, y)] === T.Grass) terrain[idx(x, y)] = T.Path;
  };
  mark();
  while (x !== x1) {
    x += Math.sign(x1 - x);
    mark();
  }
  while (y !== y1) {
    y += Math.sign(y1 - y);
    mark();
  }
}

/** Deterministic: the starting island is always the same, so NPC spots and quests are stable. */
export function generateIsland(): IslandData {
  const terrain = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) terrain[idx(x, y)] = isLandShape(x, y) ? T.Grass : T.Water;

  // Beach ring: land within 2 tiles of water becomes sand.
  const sandMark: number[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (terrain[idx(x, y)] !== T.Grass) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inBounds(nx, ny) || terrain[idx(nx, ny)] === T.Water) {
            near = true;
            break;
          }
        }
      if (near) sandMark.push(idx(x, y));
    }
  }
  for (const i of sandMark) terrain[i] = T.Sand;

  // Pier running south into the water.
  for (let y = 40; y <= 46; y++) for (const x of [31, 32]) terrain[idx(x, y)] = T.Pier;

  // Dirt paths linking the places of the cove.
  carvePath(terrain, 28, 19, 28, 20);
  carvePath(terrain, 28, 20, 42, 20);
  carvePath(terrain, 42, 18, 42, 20);
  carvePath(terrain, 28, 20, 28, 24);
  carvePath(terrain, 36, 20, 36, 33);
  carvePath(terrain, 28, 32, 31, 39);
  carvePath(terrain, 42, 20, 52, 20);
  carvePath(terrain, 52, 20, 52, 23);
  carvePath(terrain, 13, 28, 13, 31);
  carvePath(terrain, 13, 31, 28, 31);

  const blocked = new Uint8Array(MAP_W * MAP_H);
  for (let i = 0; i < blocked.length; i++) if (terrain[i] === T.Water) blocked[i] = 1;

  for (const b of BUILDINGS)
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        blocked[idx(x, y)] = 1;
        if (terrain[idx(x, y)] === T.Water) terrain[idx(x, y)] = T.Grass;
      }

  const reserved = new Uint8Array(MAP_W * MAP_H);
  const reserve = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inBounds(x + dx, y + dy)) reserved[idx(x + dx, y + dy)] = 1;
  };
  for (const b of BUILDINGS) for (let y = b.y - 1; y <= b.y + b.h + 1; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) if (inBounds(x, y)) reserved[idx(x, y)] = 1;
  for (const s of Object.values(SPOTS)) reserve(s.x, s.y, 1);
  for (let y = FARM.y - 1; y < FARM.y + FARM.h + 1; y++) for (let x = FARM.x - 1; x < FARM.x + FARM.w + 1; x++) reserved[idx(x, y)] = 1;
  for (let i = 0; i < terrain.length; i++) if (terrain[i] === T.Path || terrain[i] === T.Pier) reserved[i] = 1;

  const objects: WorldObject[] = [];
  const objAt = new Set<number>();
  const place = (type: ObjType, x: number, y: number, v = 0, solid = true) => {
    const i = idx(x, y);
    objects.push({ id: `${type}:${x},${y}`, type, tx: x, ty: y, v });
    objAt.add(i);
    if (solid) blocked[i] = 1;
  };
  const free = (x: number, y: number, terr: T[]) => inBounds(x, y) && !reserved[idx(x, y)] && !blocked[idx(x, y)] && !objAt.has(idx(x, y)) && terr.includes(terrain[idx(x, y)]);

  // Fixed landmarks.
  place('campfire', 36, 34, 0);
  place('workbench', 30, 19, 0);
  reserve(30, 19, 1);
  reserve(36, 34, 1);
  place('stone', 14, 12, 0);

  const rng = new Rng(20240611);
  // Forest (north & north-west), denser than elsewhere.
  for (let n = 0; n < 900 && objects.filter((o) => o.type === 'tree').length < 95; n++) {
    const x = rng.int(6, 58);
    const y = rng.int(5, 42);
    const inForest = y < 14 || (x < 19 && y < 24) || (x > 46 && y < 16);
    if (!inForest && !rng.chance(0.04)) continue;
    if (!free(x, y, [T.Grass])) continue;
    // keep a clear ring around the standing stone so it is reachable
    if (Math.abs(x - 14) <= 1 && Math.abs(y - 12) <= 1) continue;
    place('tree', x, y, rng.int(0, 2));
  }
  // Rocks: eastern cliffs and western outcrop.
  for (let n = 0; n < 700 && objects.filter((o) => o.type === 'rock').length < 34; n++) {
    const east = rng.chance(0.65);
    const x = east ? rng.int(44, 55) : rng.int(8, 17);
    const y = east ? rng.int(27, 38) : rng.int(14, 22);
    if (free(x, y, [T.Grass])) place('rock', x, y, rng.int(0, 1));
  }
  // Berry bushes.
  for (let n = 0; n < 500 && objects.filter((o) => o.type === 'bush').length < 14; n++) {
    const x = rng.int(8, 56);
    const y = rng.int(8, 40);
    if (free(x, y, [T.Grass])) place('bush', x, y, 0);
  }
  // Seashells: walkable pick-ups on the beach.
  for (let n = 0; n < 900 && objects.filter((o) => o.type === 'shell').length < 16; n++) {
    const x = rng.int(6, 58);
    const y = rng.int(5, 43);
    if (free(x, y, [T.Sand])) place('shell', x, y, rng.int(0, 1), false);
  }

  return { terrain, blocked, objects, buildings: BUILDINGS, farmRect: FARM, spots: SPOTS, spawn: { x: 28, y: 20 } };
}

export function isTillable(island: IslandData, x: number, y: number): boolean {
  const f = island.farmRect;
  if (x < f.x || y < f.y || x >= f.x + f.w || y >= f.y + f.h) return false;
  if (island.terrain[idx(x, y)] !== T.Grass) return false;
  return !island.blocked[idx(x, y)];
}
