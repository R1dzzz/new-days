import { en } from './en';
import { id } from './id';
import { ja } from './ja';
import { Settings, type Lang } from '../core/Settings';
import { Log } from '../core/Logger';

const TABLES: Record<Lang, Record<string, string>> = { en, id, ja };

export const LANGUAGES: Array<{ code: Lang; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'ja', label: '日本語' }
];

const warned = new Set<string>();

/** Translate a key. Falls back to English, then to the key itself (logged once so gaps are noticed). */
export function t(key: string, params?: Record<string, string | number>, lang: Lang = Settings.data.language): string {
  let s = TABLES[lang]?.[key];
  if (s === undefined) {
    s = en[key];
    if (s === undefined) {
      if (!warned.has(key)) {
        warned.add(key);
        Log.warn('i18n', `Missing translation key: ${key}`);
      }
      return key;
    }
  }
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k];
    if (v === undefined) return `{${k}}`;
    // Params that look like translation keys (e.g. "skill.farming") are translated too.
    if (typeof v === 'string' && v in en) return t(v, undefined, lang);
    return String(v);
  });
}

export function tableFor(lang: Lang): Record<string, string> {
  return TABLES[lang];
}

/** Font stack that covers Latin + Japanese on every platform. */
export const FONT_STACK = '"Noto Sans JP","Hiragino Sans","Yu Gothic UI","Meiryo","Segoe UI",system-ui,-apple-system,Roboto,sans-serif';
