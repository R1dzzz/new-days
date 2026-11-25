import type { GameState } from '../core/GameState';

export interface HintDef {
  id: string;
  /** i18n key. May contain {interact}, {use}, {inv}, {journal}, {eat} placeholders for key labels. */
  text: string;
  /** Hint is shown while this returns true. The first matching hint wins. */
  when: (s: GameState) => boolean;
}

const stat = (s: GameState, k: string) => s.stats[k] ?? 0;

/**
 * Onboarding is taught through play: one contextual line at a time, ordered by the opening story's beats.
 * Each hint disappears as soon as the player does the thing it teaches.
 */
export const HINTS: HintDef[] = [
  { id: 'move', text: 'hint.move', when: (s) => stat(s, 'moved') < 6 },
  { id: 'chop', text: 'hint.chop', when: (s) => stat(s, 'gathered:wood') < 1 },
  { id: 'mine', text: 'hint.mine', when: (s) => stat(s, 'gathered:stone') < 1 },
  { id: 'till', text: 'hint.till', when: (s) => stat(s, 'tilled') < 1 },
  { id: 'plant', text: 'hint.plant', when: (s) => stat(s, 'planted') < 1 },
  { id: 'water', text: 'hint.water', when: (s) => stat(s, 'watered') < 1 },
  { id: 'talk', text: 'hint.talk', when: (s) => stat(s, 'talked:mira') < 1 || stat(s, 'talked:bram') < 1 },
  { id: 'inventory', text: 'hint.inventory', when: (s) => !s.flags['opened_inventory'] },
  { id: 'fish', text: 'hint.fish', when: (s) => stat(s, 'fished') < 1 },
  { id: 'eat', text: 'hint.eat', when: (s) => s.player.hunger < 35 },
  { id: 'harvest', text: 'hint.harvest', when: (s) => stat(s, 'harvested') < 1 && stat(s, 'planted') >= 1 },
  { id: 'sleep', text: 'hint.sleep', when: (s) => stat(s, 'slept') < 1 && s.time.minutes > 18 * 60 },
  { id: 'journal', text: 'hint.journal', when: (s) => !s.flags['opened_journal'] }
];

export function currentHint(s: GameState): HintDef | undefined {
  return HINTS.find((h) => h.when(s));
}
