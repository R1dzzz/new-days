import { DAY_END_MIN, DAY_START_MIN } from '../config/constants';
import type { GameState } from './GameState';
import { bus } from './EventBus';
import { dateFromDay, weatherForDay } from './Calendar';
import { dailyFarmUpdate, applyRainWatering } from '../systems/Farming';
import { sleepRestore, type Difficulty } from '../systems/Needs';
import { bumpStat } from '../systems/Quests';

/** Advance the clock. Returns true if the forced-sleep hour was reached. */
export function advanceTime(state: GameState, gameMinutes: number): boolean {
  state.time.minutes += gameMinutes;
  bus.emit('time:minute', { day: state.time.day, minutes: state.time.minutes });
  return state.time.minutes >= DAY_END_MIN;
}

export interface NewDayInfo {
  grown: number;
  withered: number;
  passedOut: boolean;
  newSeason: boolean;
}

/**
 * Roll over to the next day. Pure state mutation + events; the scene handles fades and saving.
 * Order matters: farm uses the weather of the day that just ended, and the new day's weather then applies.
 */
export function startNewDay(state: GameState, difficulty: Difficulty, passedOut: boolean): NewDayInfo {
  const finishedWeather = state.weather.today;
  const prevSeason = dateFromDay(state.time.day).seasonIndex;

  state.time.day += 1;
  state.time.minutes = DAY_START_MIN;
  const farm = dailyFarmUpdate(state, finishedWeather);

  state.weather.today = weatherForDay(state.meta.seed, state.time.day);
  state.weather.tomorrow = weatherForDay(state.meta.seed, state.time.day + 1);
  applyRainWatering(state, state.weather.today);

  sleepRestore(state, difficulty, passedOut);
  bumpStat(state, 'slept', 1);

  const d = dateFromDay(state.time.day);
  const newSeason = d.seasonIndex !== prevSeason;
  bus.emit('time:newDay', { day: state.time.day, season: d.seasonIndex, year: d.year });
  if (newSeason) bus.emit('time:season', { season: d.seasonIndex, year: d.year });
  bus.emit('weather:changed', { weather: state.weather.today });
  return { grown: farm.grown, withered: farm.withered, passedOut, newSeason };
}
