import { describe, expect, it } from 'vitest';
import { DIALOGUE } from '../src/data/dialogue';
import { NPCS } from '../src/data/npcs';
import { scheduledSpot } from '../src/entities/NpcEntity';
import { daltonMatrix, matrixToSvgValues } from '../src/core/ColorFilter';
import { itemsWithoutIcon } from '../src/art/iconArt';
import { en as EN } from '../src/i18n/en';
import { ITEMS } from '../src/data/items';

describe('content integrity', () => {
  it('every dialogue node points to existing nodes and existing text keys', () => {
    for (const [id, node] of Object.entries(DIALOGUE)) {
      expect(EN[node.text], `${id} text ${node.text}`).toBeTruthy();
      if (node.next) expect(DIALOGUE[node.next], `${id}.next`).toBeTruthy();
      for (const c of node.choices ?? []) {
        expect(EN[c.text], `${id} choice ${c.text}`).toBeTruthy();
        if (c.next) expect(DIALOGUE[c.next], `${id} choice.next ${c.next}`).toBeTruthy();
      }
    }
  });
  it('every item has an icon and a name/description', () => {
    expect(itemsWithoutIcon()).toEqual([]);
    for (const id of Object.keys(ITEMS)) {
      expect(EN[`item.${id}.name`], id).toBeTruthy();
      expect(EN[`item.${id}.desc`], id).toBeTruthy();
    }
  });
  it('NPC schedules always resolve to a spot, rain included', () => {
    for (const def of Object.values(NPCS)) for (let h = 0; h < 24; h++) for (const rainy of [false, true]) expect(scheduledSpot(def, h, rainy)).toBeTruthy();
  });
  it('colour-blind matrices are 3x3 and produce an SVG matrix of 20 numbers', () => {
    for (const mode of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      const m = daltonMatrix(mode);
      expect(m).toHaveLength(3);
      expect(matrixToSvgValues(m).split(' ')).toHaveLength(20);
    }
  });
});
