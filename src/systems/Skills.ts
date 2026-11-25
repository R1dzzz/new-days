import { MAX_SKILL_LEVEL, type SkillId } from '../config/constants';
import type { GameState } from '../core/GameState';
import { bus } from '../core/EventBus';

/** XP required to advance FROM `level` to `level + 1`. */
export function xpForNext(level: number): number {
  return Math.round(40 * Math.pow(level, 1.45));
}

export function addXp(state: GameState, skill: SkillId, amount: number): void {
  const s = state.player.skills[skill];
  if (s.level >= MAX_SKILL_LEVEL) return;
  s.xp += amount;
  while (s.level < MAX_SKILL_LEVEL && s.xp >= xpForNext(s.level)) {
    s.xp -= xpForNext(s.level);
    s.level += 1;
    bus.emit('player:levelUp', { skill, level: s.level });
    bus.emit('toast', { key: 'toast.levelUp', params: { skill: `skill.${skill}`, level: s.level }, tone: 'good' });
  }
  if (s.level >= MAX_SKILL_LEVEL) s.xp = 0;
}

/** Each skill level trims 4% off tool energy cost, capped at 40%. */
export function energyDiscount(level: number): number {
  return Math.min(0.4, (level - 1) * 0.04);
}
