import { INVENTORY_SIZE } from '../../config/constants';
import { Session } from '../../core/Session';
import { bus } from '../../core/EventBus';
import { Audio } from '../../audio/AudioManager';
import { RARITY_COLORS, getItem } from '../../data/items';
import { eatSlot } from '../../systems/Needs';
import { moveSlot, sortInventory } from '../../systems/Inventory';
import { t } from '../../i18n/I18n';
import { Modal, type UiHost } from '../Modal';
import { makeSlot } from '../ItemSlot';
import { addText, makeButton } from '../Widgets';

export class InventoryPanel extends Modal {
  private sel = -1;
  private unsubInv: () => void;

  constructor(host: UiHost) {
    super(host, { w: 560, h: 410, title: t('panel.inventory') });
    Session.state.flags['opened_inventory'] = true;
    this.unsubInv = bus.on('inventory:changed', () => !this.closed && this.rebuild());
    this.build();
  }

  close(silent = false): void {
    this.unsubInv?.();
    super.close(silent);
  }

  protected build(): void {
    const s = this.host.sc;
    const st = Session.state;
    const cols = 8;
    const gap = 6;
    const size = Math.min(52, Math.floor((this.pw - 40 - gap * (cols - 1)) / cols));
    const gx = Math.floor((this.pw - (size * cols + gap * (cols - 1))) / 2);
    const gy = 52;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const stack = st.inventory.slots[i];
      this.body.add(
        makeSlot(s, gx + col * (size + gap), gy + row * (size + gap), size, stack, {
          selected: i === this.sel,
          hotbar: i < 8,
          keyLabel: i < 8 ? String(i + 1) : undefined,
          onClick: () => this.onSlot(i)
        })
      );
    }
    const dy = gy + 3 * (size + gap) + 6;
    this.body.add(addText(s, gx, dy - 2, t('inv.hint'), 11, this.th.textDim));

    const stack = this.sel >= 0 ? st.inventory.slots[this.sel] : null;
    const boxY = dy + 18;
    const boxH = this.ph - boxY - 58;
    const box = s.add.graphics();
    box.fillStyle(this.th.slot, 1);
    box.fillRoundedRect(gx, boxY, this.pw - gx * 2, boxH, 8);
    box.lineStyle(2, this.th.slotEdge, 1);
    box.strokeRoundedRect(gx, boxY, this.pw - gx * 2, boxH, 8);
    this.body.add(box);
    if (stack) {
      const def = getItem(stack.id);
      this.body.add(s.add.image(gx + 34, boxY + boxH / 2, `icon_${stack.id}`).setDisplaySize(52, 52));
      this.body.add(addText(s, gx + 70, boxY + 8, `${t(`item.${stack.id}.name`)}  ×${stack.qty}`, 16, RARITY_COLORS[def.rarity] === '#d8d2c0' ? undefined : this.shade(RARITY_COLORS[def.rarity]), { bold: true }));
      this.body.add(addText(s, gx + 70, boxY + 30, t(`item.${stack.id}.desc`), 13, undefined, { wrap: this.pw - gx * 2 - 90 }));
      const meta: string[] = [`${t('inv.rarity')}: ${t(`rarity.${def.rarity}`)}`];
      if (stack.q > 0) meta.push(t(`inv.quality.${stack.q}`));
      if (def.sell > 0) meta.push(`${t('inv.sellValue')}: ${Math.floor(def.sell * [1, 1.25, 1.5][stack.q])}g`);
      this.body.add(addText(s, gx + 70, boxY + boxH - 22, meta.join('  •  '), 11, this.th.textDim));
    }
    const by = this.ph - 48;
    this.body.add(makeButton(s, gx, by, 110, 36, t('inv.sort'), () => (sortInventory(st), (this.sel = -1)), { size: 15 }));
    const edible = !!stack && (getItem(stack.id).energy !== undefined || getItem(stack.id).hunger !== undefined || getItem(stack.id).health !== undefined);
    this.body.add(
      makeButton(
        s,
        gx + 120,
        by,
        110,
        36,
        t('inv.eat'),
        () => {
          if (eatSlot(st, this.sel)) {
            Audio.sfx('eat');
            if (!st.inventory.slots[this.sel]) this.sel = -1;
          }
        },
        { size: 15, primary: edible, disabled: !edible }
      )
    );
    this.body.add(addText(s, this.pw - gx, by + 9, `${t('common.gold')}: ${st.player.gold}`, 16, undefined, { bold: true }).setOrigin(1, 0));
  }

  private shade(hex: string): string {
    return hex;
  }

  private onSlot(i: number): void {
    const st = Session.state;
    if (this.sel === -1) {
      if (st.inventory.slots[i]) this.sel = i;
    } else if (this.sel === i) this.sel = -1;
    else {
      moveSlot(st, this.sel, i);
      this.sel = i;
      Audio.sfx('pickup');
      return; // moveSlot emits inventory:changed → rebuild
    }
    this.rebuild();
  }
}
