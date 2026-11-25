import { SAVE_SLOTS, SAVE_VERSION } from '../config/constants';
import type { GameState } from './GameState';
import { asGameState, checksum } from './SaveValidation';
import { Log } from './Logger';
import { dateFromDay } from './Calendar';

const DB_NAME = 'lost-traveler';
const DB_VERSION = 1;
const STORE = 'saves';

/** What we store per key. `payload` is the exact JSON string the checksum was computed from. */
export interface SaveRecord {
  key: string; // "slot:<n>" or "backup:<n>"
  slot: number;
  payload: string;
  checksum: string;
  version: number;
  savedAt: number;
}

export interface SlotSummary {
  slot: number;
  empty: boolean;
  corrupt?: boolean;
  recoveredFromBackup?: boolean;
  name?: string;
  day?: number;
  seasonIndex?: number;
  year?: number;
  gold?: number;
  playTimeMs?: number;
  savedAt?: number;
}

export type LoadResult =
  | { ok: true; state: GameState; recoveredFromBackup: boolean }
  | { ok: false; reason: 'empty' | 'corrupt'; detail?: string };

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export class SaveManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private factory: IDBFactory = indexedDB) {}

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const open = this.factory.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error ?? new Error('Cannot open IndexedDB'));
        open.onblocked = () => Log.warn('save', 'IndexedDB open blocked by another tab');
      });
    }
    return this.dbPromise;
  }

  private async getRecord(key: string): Promise<SaveRecord | undefined> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readonly');
    return (await reqToPromise(tx.objectStore(STORE).get(key))) as SaveRecord | undefined;
  }

  private static verify(rec: SaveRecord | undefined): GameState | null {
    if (!rec || typeof rec.payload !== 'string') return null;
    if (checksum(rec.payload) !== rec.checksum) return null;
    try {
      return asGameState(JSON.parse(rec.payload));
    } catch {
      return null;
    }
  }

  /**
   * Save to a slot. Order of operations protects the player:
   *  1. serialize + validate the NEW state — refuse to write if it is invalid
   *  2. if the existing slot is valid, copy it to the backup key (same transaction as the write)
   *  3. write the new record, then read it back and verify the checksum
   */
  async save(slot: number, state: GameState): Promise<void> {
    state.meta.savedAt = Date.now();
    state.version = SAVE_VERSION;
    const payload = JSON.stringify(state);
    try {
      asGameState(JSON.parse(payload));
    } catch (err) {
      Log.error('save', `Refusing to save slot ${slot}: state failed validation`, err);
      throw new Error(`Refusing to save an invalid state: ${(err as Error).message}`);
    }
    const record: SaveRecord = { key: `slot:${slot}`, slot, payload, checksum: checksum(payload), version: SAVE_VERSION, savedAt: state.meta.savedAt };

    const existing = await this.getRecord(record.key);
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (existing && SaveManager.verify(existing)) {
      store.put({ ...existing, key: `backup:${slot}` });
    }
    store.put(record);
    await txDone(tx);

    const back = await this.getRecord(record.key);
    if (!back || back.checksum !== record.checksum || checksum(back.payload) !== record.checksum) {
      Log.error('save', `Read-back verification failed for slot ${slot}`);
      throw new Error('Save verification failed after writing');
    }
    Log.info('save', `Saved slot ${slot} (${payload.length} bytes)`);
  }

  async load(slot: number): Promise<LoadResult> {
    const rec = await this.getRecord(`slot:${slot}`);
    const backup = await this.getRecord(`backup:${slot}`);
    if (!rec && !backup) return { ok: false, reason: 'empty' };
    const state = SaveManager.verify(rec);
    if (state) return { ok: true, state, recoveredFromBackup: false };
    Log.error('save', `Slot ${slot} failed verification; trying backup`);
    const fromBackup = SaveManager.verify(backup);
    if (fromBackup) return { ok: true, state: fromBackup, recoveredFromBackup: true };
    return { ok: false, reason: 'corrupt', detail: `slot ${slot} and its backup are both unreadable` };
  }

  async summary(slot: number): Promise<SlotSummary> {
    const res = await this.load(slot);
    if (!res.ok) return res.reason === 'empty' ? { slot, empty: true } : { slot, empty: false, corrupt: true };
    const s = res.state;
    const d = dateFromDay(s.time.day);
    return {
      slot,
      empty: false,
      recoveredFromBackup: res.recoveredFromBackup,
      name: s.player.name,
      day: d.dayOfSeason,
      seasonIndex: d.seasonIndex,
      year: d.year,
      gold: s.player.gold,
      playTimeMs: s.meta.playTimeMs,
      savedAt: s.meta.savedAt
    };
  }

  async listSlots(): Promise<SlotSummary[]> {
    const out: SlotSummary[] = [];
    for (let i = 0; i <= SAVE_SLOTS; i++) out.push(await this.summary(i));
    return out;
  }

  /** Most recently saved valid slot (auto or manual), for the "Continue" button. */
  async latest(): Promise<SlotSummary | null> {
    const all = (await this.listSlots()).filter((s) => !s.empty && !s.corrupt);
    all.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
    return all[0] ?? null;
  }

  async delete(slot: number): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(`slot:${slot}`);
    tx.objectStore(STORE).delete(`backup:${slot}`);
    await txDone(tx);
  }

  /** Wrap a slot in a portable envelope (JSON text) for download. */
  async exportSlot(slot: number): Promise<string> {
    const res = await this.load(slot);
    if (!res.ok) throw new Error(`Nothing valid to export from slot ${slot}`);
    const payload = JSON.stringify(res.state);
    return JSON.stringify({ format: 'lost-traveler-save', version: SAVE_VERSION, checksum: checksum(payload), payload });
  }

  /** Import an exported envelope into a slot. Verifies checksum and schema before touching the slot. */
  async importToSlot(slot: number, text: string): Promise<void> {
    let env: any;
    try {
      env = JSON.parse(text);
    } catch {
      throw new Error('File is not valid JSON');
    }
    if (!env || env.format !== 'lost-traveler-save' || typeof env.payload !== 'string') throw new Error('Not a Lost Traveler save file');
    if (checksum(env.payload) !== env.checksum) throw new Error('Checksum mismatch — the file is damaged or was edited');
    const state = asGameState(JSON.parse(env.payload));
    await this.save(slot, state);
  }
}
