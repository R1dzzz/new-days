import { createNewState, DEFAULT_APPEARANCE, type GameState } from '../src/core/GameState';
import { bus } from '../src/core/EventBus';

export function freshState(seed = 1234): GameState {
  bus.clear();
  return createNewState('Tester', { ...DEFAULT_APPEARANCE }, seed, { x: 100, y: 100 });
}
