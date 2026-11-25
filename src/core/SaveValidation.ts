import { DAY_END_MIN, INVENTORY_SIZE, SAVE_VERSION, SKILLS } from '../config/constants';
import type { GameState } from './GameState';
import { isItemId } from '../data/items';

/** cyrb53: fast, dependency-free 53-bit string hash. Detects corruption/truncation (not tampering). */
export function checksum(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Structural validation of a save payload. Collects every problem rather than stopping at the first. */
export function validateState(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => {
    if (!cond) errors.push(msg);
  };
  if (!isObj(raw)) return { ok: false, errors: ['state is not an object'] };
  const s = raw as Record<string, any>;

  need(isNum(s.version) && s.version >= 1 && s.version <= SAVE_VERSION, `unsupported version ${String(s.version)}`);
  need(isObj(s.meta) && isNum(s.meta.seed) && typeof s.meta.name === 'string', 'meta invalid');

  const p = s.player;
  if (!isObj(p)) errors.push('player missing');
  else {
    for (const k of ['x', 'y', 'hp', 'maxHp', 'energy', 'maxEnergy', 'hunger', 'gold']) need(isNum(p[k]), `player.${k} invalid`);
    need(isNum(p.gold) && p.gold >= 0, 'player.gold negative');
    need(isObj(p.appearance), 'player.appearance missing');
    const sk = p.skills as Record<string, any> | undefined;
    need(isObj(sk) && SKILLS.every((k) => isObj(sk![k]) && isNum(sk![k].level) && isNum(sk![k].xp)), 'player.skills invalid');
  }

  need(isObj(s.time) && isNum(s.time.day) && s.time.day >= 1 && isNum(s.time.minutes) && s.time.minutes >= 0 && s.time.minutes <= DAY_END_MIN + 120, 'time invalid');
  need(isObj(s.weather) && typeof s.weather.today === 'string' && typeof s.weather.tomorrow === 'string', 'weather invalid');

  const inv = s.inventory;
  if (!isObj(inv) || !Array.isArray(inv.slots)) errors.push('inventory invalid');
  else {
    need(inv.slots.length === INVENTORY_SIZE, `inventory has ${inv.slots.length} slots, expected ${INVENTORY_SIZE}`);
    inv.slots.forEach((st: unknown, i: number) => {
      if (st === null) return;
      if (!isObj(st) || typeof st.id !== 'string' || !isNum(st.qty) || st.qty < 1 || !isNum(st.q)) errors.push(`inventory slot ${i} malformed`);
      else need(isItemId(st.id as string), `inventory slot ${i} unknown item "${String(st.id)}"`);
    });
    need(isNum(inv.selected) && inv.selected >= 0 && inv.selected < INVENTORY_SIZE, 'inventory.selected invalid');
  }

  need(isObj(s.farm) && isObj(s.farm.plots), 'farm invalid');
  need(isObj(s.world) && isObj(s.world.depleted) && Array.isArray(s.world.discoveries), 'world invalid');
  need(isObj(s.npcs), 'npcs invalid');
  need(isObj(s.quests) && isObj(s.quests.active) && Array.isArray(s.quests.completed), 'quests invalid');
  need(isObj(s.stats), 'stats invalid');
  need(isObj(s.flags), 'flags invalid');
  return { ok: errors.length === 0, errors };
}

/** Upgrade older saves to the current schema. Add a case per version bump; never mutate the input. */
export function migrate(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const s = JSON.parse(JSON.stringify(raw)) as Record<string, any>;
  // v1 is the first schema; nothing to migrate yet. Future: if (s.version === 1) { ...; s.version = 2; }
  return s;
}

export function asGameState(raw: unknown): GameState {
  const migrated = migrate(raw);
  const v = validateState(migrated);
  if (!v.ok) throw new Error(`Invalid save: ${v.errors.slice(0, 5).join('; ')}`);
  return migrated as GameState;
}
