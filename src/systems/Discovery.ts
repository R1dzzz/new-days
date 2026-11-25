import type { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';

/**
 * Lore / location / collectible discoveries. Records the id once, bumps a stat so quests can depend on it.
 * Intentionally does NOT import Quests (avoids a cycle); callers run checkQuests afterwards.
 */
export function discover(state: GameState, id: string): boolean {
  if (state.world.discoveries.includes(id)) return false;
  state.world.discoveries.push(id);
  state.stats[`discovered:${id}`] = 1;
  state.stats['discoveries'] = (state.stats['discoveries'] ?? 0) + 1;
  bus.emit('discovery', { id });
  bus.emit('toast', { key: 'toast.discovery', params: { entry: `lore.${id.replace(/^lore\./, '')}.title` }, tone: 'good' });
  return true;
}

export const LORE_IDS = [
  'lore.shipwreck',
  'lore.archipelago',
  'lore.farming',
  'lore.neighbors',
  'lore.lamp_clue',
  'lore.lighthouse',
  'lore.ruins',
  'lore.first_chapter_end',
  'lore.ancient_stone'
] as const;
