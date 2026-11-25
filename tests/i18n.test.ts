import { describe, it, expect } from 'vitest';
import { en } from '../src/i18n/en';
import { id } from '../src/i18n/id';
import { ja } from '../src/i18n/ja';
import { ITEMS } from '../src/data/items';
import { QUESTS } from '../src/data/quests';
import { DIALOGUE } from '../src/data/dialogue';
import { NPCS } from '../src/data/npcs';
import { t } from '../src/i18n/I18n';
import { LORE_IDS } from '../src/systems/Discovery';

describe('localization', () => {
  it('id and ja have exactly the same keys as en', () => {
    const k = Object.keys(en).sort();
    expect(Object.keys(id).sort()).toEqual(k);
    expect(Object.keys(ja).sort()).toEqual(k);
  });
  it('no translation is empty and placeholders match English', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const [k, v] of Object.entries(en)) {
      expect(id[k].length, `id ${k}`).toBeGreaterThan(0);
      expect(ja[k].length, `ja ${k}`).toBeGreaterThan(0);
      expect(ph(id[k]), `id placeholders ${k}`).toBe(ph(v));
      expect(ph(ja[k]), `ja placeholders ${k}`).toBe(ph(v));
    }
  });
  it('every item has a name and description', () => {
    for (const i of Object.keys(ITEMS)) {
      expect(en[`item.${i}.name`], i).toBeTruthy();
      expect(en[`item.${i}.desc`], i).toBeTruthy();
    }
  });
  it('every quest has title, description and objective labels', () => {
    for (const q of Object.values(QUESTS)) {
      expect(en[`quest.${q.id}.title`]).toBeTruthy();
      expect(en[`quest.${q.id}.desc`]).toBeTruthy();
      for (const o of q.objectives) expect(en[`obj.${o.stat}`], `obj.${o.stat}`).toBeTruthy();
    }
  });
  it('every dialogue string key exists', () => {
    for (const [nid, n] of Object.entries(DIALOGUE)) {
      expect(en[n.text], `${nid}.text`).toBeTruthy();
      for (const c of n.choices ?? []) expect(en[c.text], `${nid} choice ${c.text}`).toBeTruthy();
      if (n.next) expect(DIALOGUE[n.next], `${nid}.next -> ${n.next}`).toBeTruthy();
      for (const c of n.choices ?? []) if (c.next) expect(DIALOGUE[c.next], `${nid} -> ${c.next}`).toBeTruthy();
    }
  });
  it('npc dialogue entry points and events resolve', () => {
    for (const n of Object.values(NPCS)) {
      expect(en[`npc.${n.id}.name`]).toBeTruthy();
      for (const ids of Object.values(n.greeting)) for (const g of ids) expect(DIALOGUE[g], g).toBeTruthy();
      for (const e of n.events) expect(DIALOGUE[e.node], e.node).toBeTruthy();
    }
  });
  it('every lore id has title and text', () => {
    for (const l of LORE_IDS) {
      expect(en[`${l}.title`], l).toBeTruthy();
      expect(en[`${l}.text`], l).toBeTruthy();
    }
  });
  it('interpolates params and nested keys', () => {
    expect(t('toast.levelUp', { skill: 'skill.farming', level: 3 }, 'en')).toBe('Farming reached level 3!');
    expect(t('toast.levelUp', { skill: 'skill.farming', level: 3 }, 'ja')).toContain('農業');
  });
  it('unknown keys fall back to the key itself', () => {
    expect(t('does.not.exist', undefined, 'en')).toBe('does.not.exist');
  });
});
