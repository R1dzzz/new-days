import { AUTOSAVE_SLOT_INDEX, SAVE_SLOTS } from '../config/constants';
import type { GameState } from './GameState';
import { SaveManager } from './SaveManager';
import { Settings } from './Settings';
import { bus } from './EventBus';
import { Log } from './Logger';
import type { Difficulty } from '../systems/Needs';

/**
 * Process-wide holder for the active game. Scenes read `Session.state`; all mutation goes through systems.
 * Keeping it out of Phaser scenes means a scene restart never loses progress and logic stays testable.
 */
class SessionImpl {
  state!: GameState;
  /** Slot the player manually saves into (1..SAVE_SLOTS). */
  slot = 1;
  readonly saves = new SaveManager();
  private sessionStart = 0;
  private dirty = false;
  active = false;

  begin(state: GameState, slot: number): void {
    this.state = state;
    this.slot = Math.min(SAVE_SLOTS, Math.max(1, slot));
    this.sessionStart = performance.now();
    this.dirty = false;
    this.active = true;
  }

  end(): void {
    this.active = false;
  }

  get difficulty(): Difficulty {
    return Settings.data.difficulty;
  }

  markDirty(): void {
    this.dirty = true;
  }

  private accumulatePlaytime(): void {
    const now = performance.now();
    this.state.meta.playTimeMs += now - this.sessionStart;
    this.sessionStart = now;
  }

  /** Manual save to the player's slot (also refreshes the rolling auto-save). */
  async saveManual(): Promise<boolean> {
    return this.write(this.slot, false);
  }

  async saveAuto(): Promise<boolean> {
    return this.write(AUTOSAVE_SLOT_INDEX, true);
  }

  /** Sleeping writes both the player's slot and the auto-save slot. */
  async saveOnSleep(): Promise<boolean> {
    const a = await this.write(this.slot, false, true);
    await this.write(AUTOSAVE_SLOT_INDEX, true, true);
    return a;
  }

  private async write(slot: number, auto: boolean, quiet = false): Promise<boolean> {
    if (!this.active) return false;
    this.accumulatePlaytime();
    try {
      await this.saves.save(slot, this.state);
      this.dirty = false;
      bus.emit('save:done', { slot, auto });
      if (!quiet) bus.emit('toast', { key: auto ? 'toast.autosaved' : 'toast.saved', tone: 'good' });
      return true;
    } catch (err) {
      const reason = (err as Error).message;
      Log.error('session', `Save to slot ${slot} failed`, err);
      bus.emit('save:failed', { reason });
      bus.emit('toast', { key: 'toast.saveFailed', params: { reason }, tone: 'warn' });
      return false;
    }
  }
}

export const Session = new SessionImpl();
