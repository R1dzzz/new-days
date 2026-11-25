import type { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';
import { QUESTS, type QuestDef } from '../data/quests';
import { addItem } from './Inventory';
import { addXp } from './Skills';
import { addFriendship } from './Relationships';
import { discover } from './Discovery';
import { Log } from '../core/Logger';

export function startQuest(state: GameState, id: string): boolean {
  const def = QUESTS[id];
  if (!def) {
    Log.error('quests', `startQuest: unknown quest "${id}"`);
    return false;
  }
  if (state.quests.active[id] || state.quests.completed.includes(id)) return false;
  const baseline: Record<string, number> = {};
  for (const o of def.objectives) baseline[o.stat] = state.stats[o.stat] ?? 0;
  state.quests.active[id] = { baseline, stage: 0 };
  bus.emit('quest:updated', { id });
  bus.emit('toast', { key: 'toast.questStarted', params: { quest: `quest.${id}.title` }, tone: 'info' });
  // Objectives may already be partly satisfied for stats that count "ever"; baseline prevents that. Check anyway.
  checkQuests(state);
  return true;
}

export interface ObjectiveProgress {
  stat: string;
  current: number;
  target: number;
}

export function objectiveProgress(state: GameState, id: string): ObjectiveProgress[] {
  const def = QUESTS[id];
  const act = state.quests.active[id];
  if (!def) return [];
  return def.objectives.map((o) => {
    const base = act?.baseline[o.stat] ?? 0;
    const cur = state.quests.completed.includes(id) ? o.target : Math.min(o.target, (state.stats[o.stat] ?? 0) - base);
    return { stat: o.stat, current: Math.max(0, cur), target: o.target };
  });
}

function isDone(state: GameState, def: QuestDef): boolean {
  return objectiveProgress(state, def.id).every((p) => p.current >= p.target);
}

function grantRewards(state: GameState, def: QuestDef): void {
  const r = def.rewards;
  if (r.gold) state.player.gold += r.gold;
  for (const it of r.items ?? []) addItem(state, it.id, it.qty);
  for (const x of r.xp ?? []) addXp(state, x.skill, x.amount);
  for (const f of r.friendship ?? []) addFriendship(state, f.npc, f.points);
  for (const d of r.discover ?? []) discover(state, d);
  bus.emit('player:stats');
}

/** Complete every active quest whose objectives are satisfied. Safe to call after any stat change. */
export function checkQuests(state: GameState): string[] {
  const finished: string[] = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const id of Object.keys(state.quests.active)) {
      const def = QUESTS[id];
      if (!def || !isDone(state, def)) continue;
      delete state.quests.active[id];
      state.quests.completed.push(id);
      grantRewards(state, def);
      finished.push(id);
      bus.emit('quest:completed', { id });
      bus.emit('toast', { key: 'toast.questDone', params: { quest: `quest.${id}.title` }, tone: 'good' });
      if (def.next) startQuest(state, def.next);
      progressed = true;
    }
  }
  if (finished.length) bus.emit('quest:updated', { id: finished[finished.length - 1] });
  return finished;
}

export function bumpStat(state: GameState, key: string, by = 1): void {
  state.stats[key] = (state.stats[key] ?? 0) + by;
  if (Object.keys(state.quests.active).length) {
    // quests show progress live, so refresh the journal on every relevant bump
    bus.emit('quest:updated', { id: '' });
  }
  checkQuests(state);
}
