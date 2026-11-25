import { Session } from '../../core/Session';
import { Audio } from '../../audio/AudioManager';
import { bus } from '../../core/EventBus';
import { getItem } from '../../data/items';
import { SHOPS } from '../../data/npcs';
import { buyItem, sellFromSlot, sellPriceOf, shopStock } from '../../systems/Economy';
import { checkQuests } from '../../systems/Quests';
import { t } from '../../i18n/I18n';
import { INVENTORY_SIZE } from '../../config/constants';
import { Modal, type UiHost } from '../Modal';
import { makeSlot } from '../ItemSlot';
import { addText, makeButton } from '../Widgets';

export class ShopPanel extends Modal {
  private tab: 'buy' | 'sell' = 'buy';
  private sel = -1;

  constructor(host: UiHost, private shopId: string, onClose?: () => void) {
    super(host, { w: 580, h: 420, title: t('panel.shop'), onClose });
    this.build();
  }

  private flash(key: string, params?: Record<string, string | number>, tone: 'info' | 'good' | 'warn' = 'info'): void {
    bus.emit('toast', { key, params, tone });
  }

  protected build(): void {
    const s = this.host.sc;
    const st = Session.state;
    const gx = 20;
    this.body.add(makeButton(s, 150, 10, 100, 32, t('shop.buy'), () => ((this.tab = 'buy'), this.rebuild()), { primary: this.tab === 'buy', size: 14 }));
    this.body.add(makeButton(s, 258, 10, 100, 32, t('shop.sell'), () => ((this.tab = 'sell'), this.rebuild()), { primary: this.tab === 'sell', size: 14 }));
    this.body.add(addText(s, this.pw - 64, 56, t('shop.yourGold', { gold: st.player.gold }), 15, undefined, { bold: true }).setOrigin(1, 0));

    if (this.tab === 'buy') {
      const stock = shopStock(st, this.shopId);
      stock.forEach((id, i) => {
        const y = 80 + i * 54;
        if (y + 48 > this.ph - 10) return;
        const def = getItem(id);
        const row = s.add.graphics();
        row.fillStyle(this.th.slot, 1);
        row.fillRoundedRect(gx, y, this.pw - gx * 2, 48, 8);
        this.body.add(row);
        this.body.add(s.add.image(gx + 30, y + 24, `icon_${id}`).setDisplaySize(36, 36));
        this.body.add(addText(s, gx + 60, y + 5, t(`item.${id}.name`), 15, undefined, { bold: true }));
        this.body.add(addText(s, gx + 60, y + 26, t(`item.${id}.desc`), 11, this.th.textDim));
        this.body.add(addText(s, this.pw - gx - 190, y + 14, `${def.buy ?? 0}g`, 16, undefined, { bold: true }).setOrigin(1, 0));
        this.body.add(
          makeButton(s, this.pw - gx - 170, y + 6, 78, 36, t('shop.buy'), () => this.buy(id), { size: 14, primary: true, disabled: (def.buy ?? 0) > st.player.gold })
        );
        this.body.add(makeButton(s, this.pw - gx - 86, y + 6, 78, 36, '×5', () => this.buy(id, 5), { size: 14, disabled: (def.buy ?? 0) * 5 > st.player.gold }));
      });
    } else {
      const cols = 8;
      const gap = 6;
      const size = Math.min(50, Math.floor((this.pw - 40 - gap * (cols - 1)) / cols));
      const x0 = Math.floor((this.pw - (size * cols + gap * (cols - 1))) / 2);
      this.body.add(addText(s, x0, 56, t('shop.sellHint'), 12, this.th.textDim));
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        const stack = st.inventory.slots[i];
        this.body.add(
          makeSlot(s, x0 + (i % cols) * (size + gap), 80 + Math.floor(i / cols) * (size + gap), size, stack, {
            selected: i === this.sel,
            onClick: () => ((this.sel = stack ? i : -1), this.rebuild())
          })
        );
      }
      const stack = this.sel >= 0 ? st.inventory.slots[this.sel] : null;
      const by = this.ph - 58;
      if (stack) {
        const price = sellPriceOf(stack.id, stack.q);
        this.body.add(addText(s, x0, by + 6, `${t(`item.${stack.id}.name`)} — ${price}g`, 15, undefined, { bold: true }));
        this.body.add(makeButton(s, this.pw - x0 - 220, by, 100, 40, `${t('shop.sell')} ×1`, () => this.sell(1), { size: 14, primary: true, disabled: price <= 0 }));
        this.body.add(makeButton(s, this.pw - x0 - 112, by, 112, 40, `${t('shop.sell')} ×${stack.qty}`, () => this.sell(stack.qty), { size: 14, disabled: price <= 0 }));
      }
    }
  }

  private buy(id: string, n = 1): void {
    const r = buyItem(Session.state, this.shopId, id, n);
    if (r.ok) {
      Audio.sfx('coin');
      this.flash('shop.bought', { item: `item.${id}.name` }, 'good');
    } else {
      Audio.sfx('error');
      this.flash(r.reason === 'noGold' ? 'shop.noGold' : r.reason === 'noSpace' ? 'shop.noSpace' : 'shop.closed', undefined, 'warn');
    }
    this.rebuild();
  }

  private sell(n: number): void {
    const r = sellFromSlot(Session.state, this.shopId, this.sel, n);
    if (r.ok) {
      Audio.sfx('coin');
      this.flash('shop.sold', { gold: r.gold }, 'good');
      checkQuests(Session.state);
      if (!Session.state.inventory.slots[this.sel]) this.sel = -1;
    } else {
      Audio.sfx('error');
      this.flash('shop.unsellable', undefined, 'warn');
    }
    this.rebuild();
  }
}

export const _shops = SHOPS;
