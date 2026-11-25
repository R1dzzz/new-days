import { Session } from '../../core/Session';
import { bus } from '../../core/EventBus';
import { QUESTS } from '../../data/quests';
import { NPCS, hearts } from '../../data/npcs';
import { CROPS } from '../../data/crops';
import { FISH } from '../../data/fish';
import { objectiveProgress } from '../../systems/Quests';
import { relation } from '../../systems/Relationships';
import { LORE_IDS } from '../../systems/Discovery';
import { t } from '../../i18n/I18n';
import { Modal, type UiHost } from '../Modal';
import { addText, makeButton } from '../Widgets';

type Tab = 'quests' | 'lore' | 'people' | 'collection';

export class JournalPanel extends Modal {
  private tab: Tab = 'quests';
  private page = 0;
  private unsubQ: () => void;

  constructor(host: UiHost) {
    super(host, { w: 600, h: 420, title: t('panel.journal') });
    Session.state.flags['opened_journal'] = true;
    this.unsubQ = bus.on('quest:updated', () => !this.closed && this.rebuild());
    this.build();
  }

  close(silent = false): void {
    this.unsubQ?.();
    super.close(silent);
  }

  private tabs(): void {
    const s = this.host.sc;
    const tabs: Tab[] = ['quests', 'lore', 'people', 'collection'];
    const w = Math.min(112, (this.pw - 180) / 4);
    tabs.forEach((k, i) => this.body.add(makeButton(s, 150 + i * (w + 4), 10, w, 30, t(`journal.${k}`), () => ((this.tab = k), (this.page = 0), this.rebuild()), { primary: this.tab === k, size: 12 })));
  }

  private pager(total: number, perPage: number): void {
    const s = this.host.sc;
    const pages = Math.max(1, Math.ceil(total / perPage));
    if (pages <= 1) return;
    const y = this.ph - 46;
    this.body.add(makeButton(s, 20, y, 90, 34, `‹ ${t('common.prev')}`, () => ((this.page = (this.page + pages - 1) % pages), this.rebuild()), { size: 13 }));
    this.body.add(makeButton(s, this.pw - 110, y, 90, 34, `${t('common.next')} ›`, () => ((this.page = (this.page + 1) % pages), this.rebuild()), { size: 13 }));
    this.body.add(addText(s, this.pw / 2, y + 8, `${this.page + 1} / ${pages}`, 14, this.th.textDim).setOrigin(0.5, 0));
  }

  protected build(): void {
    this.tabs();
    if (this.tab === 'quests') this.quests();
    else if (this.tab === 'lore') this.lore();
    else if (this.tab === 'people') this.people();
    else this.collection();
  }

  private quests(): void {
    const s = this.host.sc;
    const st = Session.state;
    const ids = Object.keys(st.quests.active).sort((a, b) => (QUESTS[a].kind === 'main' ? -1 : 1) - (QUESTS[b].kind === 'main' ? -1 : 1));
    if (!ids.length) this.body.add(addText(s, 24, 70, t('journal.noQuests'), 15, this.th.textDim, { wrap: this.pw - 48 }));
    const per = 2;
    ids.slice(this.page * per, this.page * per + per).forEach((id, i) => {
      const q = QUESTS[id];
      const y = 54 + i * 156;
      const box = s.add.graphics();
      box.fillStyle(this.th.slot, 1);
      box.fillRoundedRect(20, y, this.pw - 40, 146, 8);
      this.body.add(box);
      this.body.add(addText(s, 34, y + 8, t(`quest.${id}.title`), 17, undefined, { bold: true }));
      this.body.add(addText(s, this.pw - 34, y + 10, q.kind === 'main' ? t('journal.main') : t('journal.side'), 12, q.kind === 'main' ? '#c9533f' : this.th.textDim, { bold: true }).setOrigin(1, 0));
      this.body.add(addText(s, 34, y + 32, t(`quest.${id}.desc`), 12, this.th.textDim, { wrap: this.pw - 68 }));
      objectiveProgress(st, id).forEach((o, k) => {
        const oy = y + 72 + k * 24;
        const done = o.current >= o.target;
        this.body.add(addText(s, 34, oy, `${done ? '✔' : '○'} ${t(`obj.${o.stat}`)}`, 13, done ? this.th.good : undefined, { wrap: this.pw - 190 }));
        this.body.add(addText(s, this.pw - 34, oy, `${o.current}/${o.target}`, 13, undefined, { bold: true }).setOrigin(1, 0));
      });
    });
    this.pager(ids.length, per);
    this.body.add(addText(s, 24, this.ph - 36, `${t('journal.completed')}: ${st.quests.completed.length}`, 12, this.th.textDim));
  }

  private lore(): void {
    const s = this.host.sc;
    const found = LORE_IDS.filter((l) => Session.state.world.discoveries.includes(l));
    if (!found.length) this.body.add(addText(s, 24, 70, t('journal.noLore'), 15, this.th.textDim));
    const per = 3;
    found.slice(this.page * per, this.page * per + per).forEach((id, i) => {
      const y = 54 + i * 104;
      const box = s.add.graphics();
      box.fillStyle(this.th.slot, 1);
      box.fillRoundedRect(20, y, this.pw - 40, 96, 8);
      this.body.add(box);
      this.body.add(addText(s, 34, y + 8, t(`${id}.title`), 15, undefined, { bold: true }));
      this.body.add(addText(s, 34, y + 30, t(`${id}.text`), 12, undefined, { wrap: this.pw - 68 }));
    });
    this.pager(found.length, per);
    this.body.add(addText(s, 24, this.ph - 36, `${found.length} / ${LORE_IDS.length}`, 12, this.th.textDim));
  }

  private people(): void {
    const s = this.host.sc;
    const st = Session.state;
    const met = Object.keys(NPCS).filter((id) => (st.stats[`talked:${id}`] ?? 0) > 0);
    if (!met.length) this.body.add(addText(s, 24, 70, t('journal.noPeople'), 15, this.th.textDim));
    met.slice(this.page * 2, this.page * 2 + 2).forEach((id, i) => {
      const y = 54 + i * 150;
      const def = NPCS[id];
      const box = s.add.graphics();
      box.fillStyle(this.th.slot, 1);
      box.fillRoundedRect(20, y, this.pw - 40, 142, 8);
      this.body.add(box);
      this.body.add(s.add.image(58, y + 110, `char_npc_${id}`, 0).setOrigin(0.5, 44 / 48).setScale(2));
      this.body.add(addText(s, 104, y + 8, t(`npc.${id}.name`), 17, undefined, { bold: true }));
      this.body.add(addText(s, 104, y + 32, t(`npc.${id}.bio`), 12, this.th.textDim, { wrap: this.pw - 150 }));
      const h = hearts(relation(st, id).points);
      this.body.add(addText(s, 104, y + 72, `${t('journal.hearts')}: ${'♥'.repeat(Math.ceil(h / 2) > 0 ? Math.floor(h / 2) : 0)}${h % 2 ? '♡' : ''}${'·'.repeat(4 - Math.ceil(h / 2))}  (${relation(st, id).points})`, 14, '#c9533f', { bold: true }));
      this.body.add(addText(s, 104, y + 98, `${t('journal.likes')}:`, 12, this.th.textDim, { bold: true }));
      def.loved.forEach((item, k) => this.body.add(s.add.image(190 + k * 34, y + 106, `icon_${item}`).setDisplaySize(28, 28)));
    });
    this.pager(met.length, 2);
  }

  private collection(): void {
    const s = this.host.sc;
    const st = Session.state;
    this.body.add(addText(s, 24, 54, t('journal.fish'), 15, undefined, { bold: true }));
    FISH.forEach((f, i) => {
      const n = st.stats[`caught:${f.id}`] ?? 0;
      const x = 24 + i * 120;
      const slot = s.add.graphics();
      slot.fillStyle(this.th.slot, 1);
      slot.fillRoundedRect(x, 80, 108, 96, 8);
      this.body.add(slot);
      const img = s.add.image(x + 54, 112, `icon_${f.id}`).setDisplaySize(44, 44);
      if (!n) img.setTintFill(0x5a5048);
      this.body.add(img);
      this.body.add(addText(s, x + 54, 140, n ? t(`item.${f.id}.name`) : t('journal.unknown'), 12, undefined, { bold: true, align: 'center' }).setOrigin(0.5, 0));
      this.body.add(addText(s, x + 54, 156, `×${n}`, 12, this.th.textDim).setOrigin(0.5, 0));
    });
    this.body.add(addText(s, 24, 196, t('journal.crops'), 15, undefined, { bold: true }));
    Object.values(CROPS).forEach((c, i) => {
      const n = st.stats[`harvested:${c.harvest}`] ?? 0;
      const x = 24 + i * 120;
      const slot = s.add.graphics();
      slot.fillStyle(this.th.slot, 1);
      slot.fillRoundedRect(x, 222, 108, 96, 8);
      this.body.add(slot);
      const img = s.add.image(x + 54, 254, `icon_${c.harvest}`).setDisplaySize(44, 44);
      if (!n) img.setTintFill(0x5a5048);
      this.body.add(img);
      this.body.add(addText(s, x + 54, 282, n ? t(`item.${c.harvest}.name`) : t('journal.unknown'), 12, undefined, { bold: true, align: 'center' }).setOrigin(0.5, 0));
      this.body.add(addText(s, x + 54, 298, `×${n}`, 12, this.th.textDim).setOrigin(0.5, 0));
    });
  }
}
