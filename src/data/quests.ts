import type { SkillId } from '../config/constants';

export interface QuestObjective {
  /** Key in GameState.stats. Progress = stats[stat] - baseline. */
  stat: string;
  target: number;
}

export interface QuestReward {
  gold?: number;
  items?: Array<{ id: string; qty: number }>;
  xp?: Array<{ skill: SkillId; amount: number }>;
  friendship?: Array<{ npc: string; points: number }>;
  discover?: string[];
}

export interface QuestDef {
  id: string;
  kind: 'main' | 'side';
  chapter?: number;
  objectives: QuestObjective[];
  rewards: QuestReward;
  /** Quest started automatically when this one completes. */
  next?: string;
}

export const QUESTS: Record<string, QuestDef> = {
  ch1_washed_ashore: {
    id: 'ch1_washed_ashore',
    kind: 'main',
    chapter: 1,
    objectives: [
      { stat: 'gathered:wood', target: 5 },
      { stat: 'gathered:stone', target: 3 },
      { stat: 'planted', target: 3 }
    ],
    rewards: { gold: 60, xp: [{ skill: 'foraging', amount: 20 }, { skill: 'farming', amount: 15 }] },
    next: 'ch1_meet_neighbors'
  },
  ch1_meet_neighbors: {
    id: 'ch1_meet_neighbors',
    kind: 'main',
    chapter: 1,
    objectives: [
      { stat: 'talked:mira', target: 1 },
      { stat: 'talked:bram', target: 1 }
    ],
    rewards: { items: [{ id: 'fertilizer', qty: 3 }], discover: ['lore.neighbors'] },
    next: 'ch1_first_harvest'
  },
  ch1_first_harvest: {
    id: 'ch1_first_harvest',
    kind: 'main',
    chapter: 1,
    objectives: [
      { stat: 'harvested', target: 3 },
      { stat: 'sold', target: 1 },
      { stat: 'slept', target: 3 }
    ],
    rewards: { gold: 150, items: [{ id: 'moon_flower', qty: 1 }], xp: [{ skill: 'farming', amount: 40 }], discover: ['lore.lamp_clue'] },
    next: 'ch1_lantern_mystery'
  },
  ch1_lantern_mystery: {
    id: 'ch1_lantern_mystery',
    kind: 'main',
    chapter: 1,
    objectives: [{ stat: 'discovered:lore.lighthouse', target: 1 }],
    rewards: { gold: 200, discover: ['lore.first_chapter_end'] }
  },
  ch1_find_mira_help: {
    id: 'ch1_find_mira_help',
    kind: 'side',
    objectives: [{ stat: 'gathered:seashell', target: 3 }],
    rewards: { gold: 80, friendship: [{ npc: 'mira', points: 100 }] }
  }
};
