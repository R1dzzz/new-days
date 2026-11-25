import { Session } from '../../core/Session';
import { Audio } from '../../audio/AudioManager';
import { bus } from '../../core/EventBus';
import { recipesFor, type StationId } from '../../data/recipes';
import { canCraft, craft } from '../../systems/Crafting';
import { countItem } from '../../systems/Inventory';
import { checkQuests } from '../../systems/Quests';
import { t } from '../../i18n/I18n';
import { Modal, type UiHost } from '../Modal';
import { addText, makeButton } from '../Widgets';

export class CraftPanel extends Modal {
  constructor(host: UiHost, private station: StationId) {
    super(host, { w: 540, h: 330, title: t(`panel.craft.${station}`) });
    this.build();
  }

  protected build(): void {
    const s = this.host.sc;
    const st = Session.state;
    const gx = 20;
    recipesFor(this.station).forEach((r, i) => {
      const y = 54 + i * 76;
      const row = s.add.graphics();
      row.fillStyle(this.th.slot, 1);
      row.fillRoundedRect(gx, y, this.pw - gx * 2, 68, 8);
      this.body.add(row);
      this.body.add(s.add.image(gx + 34, y + 34, `icon_${r.output.id}`).setDisplaySize(44, 44));
      this.body.add(addText(s, gx + 68, y + 6, `${t(`item.${r.output.id}.name`)} ×${r.output.qty}`, 16, undefined, { bold: true }));
      const needs = r.inputs.map((n) => `${n.qty}× ${t(`item.${n.id}.name`)} (${countItem(st, n.id)})`).join(', ');
      this.body.add(addText(s, gx + 68, y + 28, `${t('craft.needs')}: ${needs}`, 12, this.th.textDim, { wrap: this.pw - gx * 2 - 190 }));
      const ok = canCraft(st, r);
      this.body.add(
        makeButton(s, this.pw - gx - 108, y + 15, 98, 38, t('craft.make'), () => {
          const res = craft(st, r.id);
          if (res.ok) {
            Audio.sfx('harvest');
            bus.emit('toast', { key: 'toast.crafted', params: { item: `item.${r.output.id}.name` }, tone: 'good' });
            checkQuests(st);
          } else {
            Audio.sfx('error');
            bus.emit('toast', { key: res.reason === 'noSpace' ? 'toast.craftSpace' : res.reason === 'tired' ? 'toast.craftTired' : 'toast.craftMissing', tone: 'warn' });
          }
          this.rebuild();
        }, { primary: ok, disabled: !ok, size: 15 })
      );
    });
  }
}
