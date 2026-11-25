import { bus } from './EventBus';
import type { Difficulty } from '../systems/Needs';
import { Log } from './Logger';

export type Lang = 'en' | 'id' | 'ja';
export type Quality = 'auto' | 'low' | 'medium' | 'high';
export type ColorMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export type ActionKey = 'up' | 'down' | 'left' | 'right' | 'interact' | 'use' | 'inventory' | 'journal' | 'map' | 'eat';

export interface SettingsData {
  language: Lang;
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  muted: boolean;
  quality: Quality;
  textScale: number;
  uiScale: number;
  reducedMotion: boolean;
  screenShake: boolean;
  colorMode: ColorMode;
  highContrast: boolean;
  subtitleBackground: boolean;
  cameraZoom: number;
  difficulty: Difficulty;
  touchControls: 'auto' | 'on' | 'off';
  keys: Record<ActionKey, string[]>;
}

export const DEFAULT_KEYS: Record<ActionKey, string[]> = {
  up: ['W', 'UP'],
  down: ['S', 'DOWN'],
  left: ['A', 'LEFT'],
  right: ['D', 'RIGHT'],
  interact: ['E', 'SPACE'],
  use: ['F', 'ENTER'],
  inventory: ['I', 'TAB'],
  journal: ['J'],
  map: ['M'],
  eat: ['Q']
};

export const DEFAULT_SETTINGS: SettingsData = {
  language: 'en',
  musicVolume: 0.6,
  sfxVolume: 0.8,
  ambienceVolume: 0.6,
  muted: false,
  quality: 'auto',
  textScale: 1,
  uiScale: 1,
  reducedMotion: false,
  screenShake: true,
  colorMode: 'none',
  highContrast: false,
  subtitleBackground: true,
  cameraZoom: 1,
  difficulty: 'normal',
  touchControls: 'auto',
  keys: DEFAULT_KEYS
};

const LS_KEY = 'lost-traveler:settings:v1';

function clamp(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
}

/** Validate untrusted/old settings JSON field by field. Unknown or malformed fields fall back to defaults. */
export function sanitizeSettings(raw: unknown): SettingsData {
  const d = DEFAULT_SETTINGS;
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T => (allowed.includes(v as T) ? (v as T) : fb);
  const keys: Record<ActionKey, string[]> = { ...DEFAULT_KEYS };
  const rk = (r.keys && typeof r.keys === 'object' ? r.keys : {}) as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_KEYS) as ActionKey[]) {
    const v = rk[k];
    if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string')) keys[k] = v as string[];
  }
  return {
    language: pick(r.language, ['en', 'id', 'ja'] as const, d.language),
    musicVolume: clamp(r.musicVolume, 0, 1, d.musicVolume),
    sfxVolume: clamp(r.sfxVolume, 0, 1, d.sfxVolume),
    ambienceVolume: clamp(r.ambienceVolume, 0, 1, d.ambienceVolume),
    muted: r.muted === true,
    quality: pick(r.quality, ['auto', 'low', 'medium', 'high'] as const, d.quality),
    textScale: clamp(r.textScale, 0.8, 1.6, d.textScale),
    uiScale: clamp(r.uiScale, 0.8, 1.6, d.uiScale),
    reducedMotion: r.reducedMotion === true,
    screenShake: r.screenShake !== false,
    colorMode: pick(r.colorMode, ['none', 'protanopia', 'deuteranopia', 'tritanopia'] as const, d.colorMode),
    highContrast: r.highContrast === true,
    subtitleBackground: r.subtitleBackground !== false,
    cameraZoom: clamp(r.cameraZoom, 0.75, 2, d.cameraZoom),
    difficulty: pick(r.difficulty, ['relaxed', 'normal', 'hard'] as const, d.difficulty),
    touchControls: pick(r.touchControls, ['auto', 'on', 'off'] as const, d.touchControls),
    keys
  };
}

class SettingsStore {
  data: SettingsData = sanitizeSettings(undefined);

  load(): void {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.data = sanitizeSettings(JSON.parse(raw));
      else this.data = sanitizeSettings(undefined);
    } catch (err) {
      Log.warn('settings', 'Could not read saved settings; using defaults', err);
      this.data = sanitizeSettings(undefined);
    }
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data = { ...this.data, [key]: value };
    this.persist();
    bus.emit('settings:changed');
    if (key === 'language') bus.emit('language:changed', { lang: value as string });
  }

  persist(): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.data));
    } catch (err) {
      Log.warn('settings', 'Could not persist settings', err);
    }
  }

  reset(): void {
    this.data = sanitizeSettings(undefined);
    this.persist();
    bus.emit('settings:changed');
    bus.emit('language:changed', { lang: this.data.language });
  }
}

export const Settings = new SettingsStore();
