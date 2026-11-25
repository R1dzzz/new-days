import type { GameState, NpcRelation } from '../core/GameState';
import { bus } from '../core/EventBus';
import { GIFT_POINTS, MAX_FRIENDSHIP, NPCS, giftReaction } from '../data/npcs';
import { removeFromSlot } from './Inventory';

export function relation(state: GameState, npc: string): NpcRelation {
  let r = state.npcs[npc];
  if (!r) {
    r = { points: 0, talkedDay: 0, giftedDay: 0, seenEvents: [] };
    state.npcs[npc] = r;
  }
  return r;
}

export function addFriendship(state: GameState, npc: string, points: number): void {
  const r = relation(state, npc);
  r.points = Math.max(0, Math.min(MAX_FRIENDSHIP, r.points + points));
  bus.emit('friendship:changed', { npc, points: r.points });
}

/** First chat of the day gives a small friendship bump. Returns true if the bump was awarded. */
export function markTalked(state: GameState, npc: string): boolean {
  const r = relation(state, npc);
  state.stats[`talked:${npc}`] = (state.stats[`talked:${npc}`] ?? 0) + 1;
  if (r.talkedDay === state.time.day) return false;
  r.talkedDay = state.time.day;
  addFriendship(state, npc, 10);
  return true;
}

/** Next unseen friendship event the NPC is ready to play, if any. */
export function pendingEvent(state: GameState, npc: string): string | undefined {
  const def = NPCS[npc];
  const r = relation(state, npc);
  const ev = def.events.find((e) => !r.seenEvents.includes(e.id) && r.points >= e.atPoints);
  return ev?.id;
}

export function eventNode(npc: string, eventId: string): string | undefined {
  return NPCS[npc]?.events.find((e) => e.id === eventId)?.node;
}

export function markEventSeen(state: GameState, npc: string, eventId: string): void {
  const r = relation(state, npc);
  if (!r.seenEvents.includes(eventId)) r.seenEvents.push(eventId);
}

export type GiftOutcome = 'love' | 'like' | 'neutral' | 'hate' | 'already' | 'nothing';

/** Give the item in `slotIndex` to the NPC. One gift per NPC per day. */
export function giveGift(state: GameState, npc: string, slotIndex: number): GiftOutcome {
  const stack = state.inventory.slots[slotIndex];
  if (!stack) return 'nothing';
  const r = relation(state, npc);
  if (r.giftedDay === state.time.day) return 'already';
  const def = NPCS[npc];
  const reaction = giftReaction(def, stack.id);
  removeFromSlot(state, slotIndex, 1);
  r.giftedDay = state.time.day;
  addFriendship(state, npc, GIFT_POINTS[reaction]);
  state.stats[`gifted:${npc}`] = (state.stats[`gifted:${npc}`] ?? 0) + 1;
  return reaction;
}
