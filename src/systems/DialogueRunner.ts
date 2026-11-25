import type { GameState } from '../core/GameState';
import { DIALOGUE, type DialogueChoice, type DialogueEffect, type DialogueNode } from '../data/dialogue';
import { NPCS, friendshipTier } from '../data/npcs';
import { addItem } from './Inventory';
import { addFriendship, eventNode, markEventSeen, markTalked, pendingEvent, relation } from './Relationships';
import { startQuest, checkQuests } from './Quests';
import { discover } from './Discovery';
import { hashSeed } from '../core/Rng';
import { Log } from '../core/Logger';

export interface UiRequest {
  gift?: boolean;
  openShop?: boolean;
}

/** Apply an effect to game state. UI-only effects (gift picker, shop) are returned for the caller to open. */
export function applyEffect(state: GameState, npcId: string, e: DialogueEffect | undefined): UiRequest {
  const req: UiRequest = {};
  if (!e) return req;
  if (e.friendship && npcId in NPCS) addFriendship(state, npcId, e.friendship);
  if (e.flag) state.flags[e.flag] = true;
  for (const g of e.give ?? []) addItem(state, g.id, g.qty);
  if (e.discover) discover(state, e.discover);
  if (e.startQuest) startQuest(state, e.startQuest);
  if (e.gift) req.gift = true;
  if (e.openShop) req.openShop = true;
  checkQuests(state);
  return req;
}

/** Choose what an NPC says when approached: a pending friendship event first, else a daily-varied greeting. */
export function pickConversation(state: GameState, npcId: string): { node: string; eventId?: string } {
  markTalked(state, npcId);
  checkQuests(state);
  const ev = pendingEvent(state, npcId);
  if (ev) {
    const node = eventNode(npcId, ev);
    if (node) {
      markEventSeen(state, npcId, ev);
      return { node, eventId: ev };
    }
  }
  const def = NPCS[npcId];
  const tier = friendshipTier(relation(state, npcId).points);
  let list: string[] | undefined;
  for (let t = tier; t >= 0 && !list; t--) list = def.greeting[t];
  if (!list || !list.length) throw new Error(`NPC ${npcId} has no greetings`);
  return { node: list[hashSeed('greet', state.time.day, npcId) % list.length] };
}

export class DialogueRunner {
  node: DialogueNode;
  nodeId: string;
  ended = false;

  constructor(private state: GameState, readonly npcId: string, startNode: string) {
    this.nodeId = startNode;
    const n = DIALOGUE[startNode];
    if (!n) throw new Error(`Unknown dialogue node: ${startNode}`);
    this.node = n;
  }

  /** Run the current node's effects (call once when the node is shown). */
  enter(): UiRequest {
    return applyEffect(this.state, this.npcId, this.node.effect);
  }

  visibleChoices(): DialogueChoice[] {
    return (this.node.choices ?? []).filter((c) => {
      if (!c.requires) return true;
      const neg = c.requires.startsWith('!');
      const flag = neg ? c.requires.slice(1) : c.requires;
      return neg ? !this.state.flags[flag] : !!this.state.flags[flag];
    });
  }

  private goto(id: string | undefined): void {
    if (!id) {
      this.ended = true;
      return;
    }
    const n = DIALOGUE[id];
    if (!n) {
      Log.error('dialogue', `Missing dialogue node "${id}" (from ${this.nodeId})`);
      this.ended = true;
      return;
    }
    this.nodeId = id;
    this.node = n;
  }

  /** Advance a node that has no choices. */
  next(): void {
    this.goto(this.node.next);
  }

  /** Pick a choice by index among visibleChoices(). Returns UI requests triggered by the choice. */
  choose(i: number): UiRequest {
    const c = this.visibleChoices()[i];
    if (!c) return {};
    const req = applyEffect(this.state, this.npcId, c.effect);
    this.goto(c.next);
    return req;
  }
}
