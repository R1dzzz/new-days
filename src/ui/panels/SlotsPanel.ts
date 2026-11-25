import { SAVE_SLOTS } from '../../config/constants';
import { Session } from '../../core/Session';
import { bus } from '../../core/EventBus';
import { Log } from '../../core/Logger';
import type { SlotSummary } from '../../core/SaveManager';
import { t } from '../../i18n/I18n';
import { Modal, type UiHost } from '../Modal';
import { addText, makeButton } from '../Widgets';
import { ConfirmPanel } from './ConfirmPanel';

export type SlotsMode = 'menu' | 'game';

/** Save management: save / load / delete / export / import for every slot. */
export class SlotsPanel extends Modal {
  private summaries: SlotSummary[] = [];
  private loaded = false;
  private message = '';

  constructor(host: UiHost, private mode: SlotsMode, private onLoad: (slot: number) => void, onClose?: () => void) {
    super(host, { w: 640, h: 400, title: t('panel.saves'), onClose });
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      this.summaries = await Session.saves.listSlots();
    } catch (err) {
      Log.error('slots', 'Could not list saves', err);
      this.message = (err as Error).message;
    }
    this.loaded = true;
    if (!this.closed) this.rebuild();
  }

  private fmtSummary(s: SlotSummary): string {
    if (s.empty) return t('save.empty');
    if (s.corrupt) return t('save.corrupt');
    const mins = Math.floor((s.playTimeMs ?? 0) / 60000);
    const text = t('save.summary', { name: s.name ?? '', season: `season.${['spring', 'summer', 'autumn', 'winter'][s.seasonIndex ?? 0]}`, day: s.day ?? 1, year: s.year ?? 1, gold: s.gold ?? 0 });
    return `${text}  •  ${t('save.playtime', { h: Math.floor(mins / 60), m: mins % 60 })}${s.recoveredFromBackup ? `  •  ${t('save.recovered')}` : ''}`;
  }

  protected build(): void {
    const s = this.host.sc;
    if (!this.loaded) {
      this.body.add(addText(s, 24, 60, t('misc.loading'), 15, this.th.textDim));
      return;
    }
    const gx = 18;
    this.summaries.forEach((sm, i) => {
      const y = 52 + i * 76;
      const box = s.add.graphics();
      box.fillStyle(this.th.slot, 1);
      box.fillRoundedRect(gx, y, this.pw - gx * 2, 68, 8);
      this.body.add(box);
      this.body.add(addText(s, gx + 12, y + 6, i === 0 ? t('save.auto') : t('save.slot', { n: i }), 15, undefined, { bold: true }));
      this.body.add(addText(s, gx + 12, y + 28, this.fmtSummary(sm), 12, sm.corrupt ? this.th.warn : this.th.textDim, { wrap: this.pw - 330 }));
      const bw = 62;
      let bx = this.pw - gx - 8 - bw;
      const add = (label: string, fn: () => void, opts: { primary?: boolean; disabled?: boolean } = {}) => {
        this.body.add(makeButton(s, bx, y + 8, bw, 24, label, fn, { size: 11, ...opts }));
        bx -= bw + 4;
      };
      // second row of small buttons
      const row2 = (label: string, fn: () => void, disabled = false) => {
        this.body.add(makeButton(s, bx2, y + 36, bw, 24, label, fn, { size: 11, disabled }));
        bx2 -= bw + 4;
      };
      let bx2 = this.pw - gx - 8 - bw;
      const usable = !sm.empty && !sm.corrupt;
      add(t('save.load'), () => this.doLoad(i), { primary: usable, disabled: !usable });
      if (this.mode === 'game' && i !== 0) add(t('save.save'), () => this.doSave(i), { primary: true });
      row2(t('save.export'), () => void this.doExport(i), !usable);
      if (i !== 0) row2(t('save.import'), () => this.doImport(i));
      row2(t('save.delete'), () => this.doDelete(i), sm.empty);
    });
    if (this.message) this.body.add(addText(s, gx, this.ph - 30, this.message, 12, this.th.textDim));
  }

  private doLoad(slot: number): void {
    this.close(true);
    this.onLoad(slot);
  }

  private doSave(slot: number): void {
    const prev = Session.slot;
    Session.slot = slot;
    void Session.saveManual().then((ok) => {
      if (!ok) Session.slot = prev;
      void this.refresh();
    });
  }

  private doDelete(slot: number): void {
    new ConfirmPanel(this.host, 'save.confirmDelete', 'save.delete', 'common.cancel', () => {
      void Session.saves.delete(slot).then(() => new SlotsPanel(this.host, this.mode, this.onLoad, this.opts.onClose));
    }, () => new SlotsPanel(this.host, this.mode, this.onLoad, this.opts.onClose));
    this.opts.onClose = undefined;
  }

  private async doExport(slot: number): Promise<void> {
    try {
      const text = await Session.saves.exportSlot(slot);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lost-traveler-slot${slot}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      this.message = t('save.exported');
    } catch (err) {
      this.message = t('save.importFail', { reason: (err as Error).message });
    }
    if (!this.closed) this.rebuild();
  }

  private doImport(slot: number): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await Session.saves.importToSlot(slot, await file.text());
        this.message = t('save.importOk');
        bus.emit('save:done', { slot, auto: false });
      } catch (err) {
        Log.warn('slots', 'Import rejected', err);
        this.message = t('save.importFail', { reason: (err as Error).message });
      }
      void this.refresh();
    };
    input.click();
  }
}
