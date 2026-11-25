import { MAP_H, MAP_W, idx, inBounds } from './WorldData';

export interface Pt {
  x: number;
  y: number;
}

/** Breadth-first search on the tile grid (4-directional). Returns the path including start and goal, or null. */
export function findPath(blocked: Uint8Array, from: Pt, to: Pt, maxNodes = MAP_W * MAP_H): Pt[] | null {
  if (!inBounds(from.x, from.y) || !inBounds(to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [from];
  const prev = new Int32Array(MAP_W * MAP_H).fill(-2);
  const queue: number[] = [idx(from.x, from.y)];
  prev[queue[0]] = -1;
  const goal = idx(to.x, to.y);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  let head = 0;
  let visited = 0;
  while (head < queue.length && visited < maxNodes) {
    const cur = queue[head++];
    visited++;
    if (cur === goal) {
      const out: Pt[] = [];
      for (let c = cur; c !== -1; c = prev[c]) out.push({ x: c % MAP_W, y: Math.floor(c / MAP_W) });
      return out.reverse();
    }
    const cx = cur % MAP_W;
    const cy = Math.floor(cur / MAP_W);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (prev[ni] !== -2) continue;
      // The goal tile may itself be blocked (e.g. a door) — allow stepping onto it.
      if (blocked[ni] && ni !== goal) continue;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  return null;
}
