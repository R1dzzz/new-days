import Phaser from 'phaser';
import type { ItemStack } from '../core/GameState';
import { ITEMS, RARITY_COLORS } from '../data/items';
import { addText, theme } from './Widgets';

export interface SlotOpts {
  selected?: boolean;
  hotbar?: boolean;
  keyLabel?: string;
  onClick?: () => void;
  dim?: boolean;
}

/** One inventory cell. Container origin = top-left. */
export function makeSlot(scene: Phaser.Scene, x: number, y: number, size: number, stack: ItemStack | null, opts: SlotOpts = {}): Phaser.GameObjects.Container {
  const th = theme();
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(opts.hotbar ? 0xd9c28f : th.slot, 1);
  g.fillRoundedRect(0, 0, size, size, 7);
  g.lineStyle(opts.selected ? 4 : 2, opts.selected ? th.accent : th.slotEdge, 1);
  g.strokeRoundedRect(0, 0, size, size, 7);
  if (stack) {
    const rar = ITEMS[stack.id]?.rarity ?? 'common';
    if (rar !== 'common') {
      g.lineStyle(2, Phaser.Display.Color.HexStringToColor(RARITY_COLORS[rar]).color, 1);
      g.strokeRoundedRect(3, 3, size - 6, size - 6, 5);
    }
  }
  c.add(g);
  if (stack) {
    const icon = scene.add.image(size / 2, size / 2 - 1, `icon_${stack.id}`).setDisplaySize(size * 0.78, size * 0.78);
    c.add(icon);
    if (stack.qty > 1) c.add(addText(scene, size - 4, size - 3, String(stack.qty), Math.max(10, size * 0.27), undefined, { bold: true }).setOrigin(1, 1).setStroke('#f4e9cf', 3));
    if (stack.q > 0) {
      const star = scene.add.star(7, 7, 5, 2.2, 5, stack.q === 2 ? 0xf2c14e : 0xc4ccd4).setStrokeStyle(1, 0x2b2430);
      c.add(star);
    }
  }
  if (opts.keyLabel) c.add(addText(scene, 4, 2, opts.keyLabel, Math.max(9, size * 0.22), th.textDim, { bold: true }));
  if (opts.dim) c.setAlpha(0.55);
  c.setSize(size, size);
  if (opts.onClick) {
    const hit = scene.add.rectangle(size / 2, size / 2, size, size, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', opts.onClick);
    c.add(hit);
  }
  return c;
}
