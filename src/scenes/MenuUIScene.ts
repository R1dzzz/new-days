import Phaser from 'phaser';
import { Audio } from '../audio/AudioManager';
import { Session } from '../core/Session';
import { Log } from '../core/Logger';
import { bus } from '../core/EventBus';
import { Controls } from '../input/Controls';
import { t } from '../i18n/I18n';
import { Modal, setupUiCamera, type UiHost } from '../ui/Modal';
import { UiMetrics, addText, makeButton, drawPanel } from '../ui/Widgets';
import { SlotsPanel } from '../ui/panels/SlotsPanel';
import { SettingsPanel } from '../ui/panels/SettingsPanel';
import { ConfirmPanel } from '../ui/panels/ConfirmPanel';

class CreditsPanel extends Modal {
  constructor(host: UiHost) {
    super(host, { w: 480, h: 330, title: t('credits.title') });
    this.build();
  }
  protected build(): void {
    this.body.add(addText(this.host.sc, 26, 58, t('credits.body'), 14, undefined, { wrap: this.pw - 52 }));
  }
}

/** Title-screen buttons and panels, hosted in their own scene so the backdrop camera is untouched. */
export class MenuUIScene extends Phaser.Scene implements UiHost {
  get sc(): Phaser.Scene {
    return this;
  }
  W = 640;
  H = 400;
  modal: Modal | null = null;
  private layer?: Phaser.GameObjects.Container;
  private hasSave = false;
  private latest = -1;
  private status = '';
  private busy = false;

  constructor() {
    super('MenuUI');
  }

  relayout(): void {
    const r = setupUiCamera(this);
    this.W = r.W;
    this.H = r.H;
    UiMetrics.zoom = r.zoom;
  }

  create(): void {
    this.modal = null;
    this.busy = false;
    this.relayout();
    this.build();
    void this.scanSaves();
    const rel = () => {
      this.relayout();
      this.build();
    };
    this.scale.on('resize', rel);
    const off = bus.on('settings:changed', rel);
    this.input.keyboard?.on('keydown', () => Audio.unlock());
    this.input.on('pointerdown', () => Audio.unlock());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', rel);
      off();
    });
  }

  private async scanSaves(): Promise<void> {
    try {
      const list = await Session.saves.listSlots();
      let best = -1;
      let bestAt = 0;
      for (const s of list) if (!s.empty && !s.corrupt && (s.savedAt ?? 0) >= bestAt) ((best = s.slot), (bestAt = s.savedAt ?? 0));
      this.latest = best;
      this.hasSave = best >= 0;
    } catch (err) {
      Log.error('menu', 'Could not scan saves', err);
      this.status = (err as Error).message;
    }
    this.build();
  }

  private build(): void {
    this.layer?.destroy();
    const { W, H } = this;
    const c = this.add.container(0, 0);
    this.layer = c;
    c.add(addText(this, W / 2, H * 0.1, t('menu.title'), 40, '#fff4d6', { bold: true, align: 'center' }).setOrigin(0.5, 0).setShadow(0, 3, '#1b1409', 0, false, true));
    c.add(addText(this, W / 2, H * 0.1 + 52, t('menu.subtitle'), 14, '#ffe9c9', { align: 'center' }).setOrigin(0.5, 0).setShadow(0, 2, '#1b1409', 0, false, true));
    const bw = 210;
    const bh = 38;
    const x = W * 0.74 - bw / 2 > W - bw - 12 ? W - bw - 12 : Math.max(12, W * 0.74 - bw / 2);
    let y = H * 0.36;
    const add = (label: string, fn: () => void, o: { primary?: boolean; disabled?: boolean } = {}) => {
      c.add(makeButton(this, x, y, bw, bh, label, fn, { size: 17, ...o }));
      y += bh + 8;
    };
    add(t('menu.continue'), () => void this.continueGame(), { primary: this.hasSave, disabled: !this.hasSave });
    add(t('menu.new'), () => this.guard(() => (this.scene.stop('Menu'), this.scene.start('Create'))), { primary: !this.hasSave });
    add(t('menu.load'), () => this.guard(() => new SlotsPanel(this, 'menu', (slot) => void this.loadSlot(slot), () => void this.scanSaves())));
    add(t('menu.settings'), () => this.guard(() => new SettingsPanel(this)));
    add(t('menu.credits'), () => this.guard(() => new CreditsPanel(this)));
    if (!this.hasSave) c.add(addText(this, x + bw / 2, y + 2, t('menu.noSave'), 12, '#ffe9c9', { align: 'center' }).setOrigin(0.5, 0));
    if (this.status) c.add(addText(this, 10, H - 22, this.status, 11, '#ff9c8a'));
    c.add(addText(this, W - 10, H - 20, 'v0.1.0', 11, '#ffe9c9').setOrigin(1, 0).setAlpha(0.7));
    void drawPanel;
  }

  private guard(fn: () => void): void {
    if (this.busy || this.modal) return;
    fn();
  }

  private async continueGame(): Promise<void> {
    if (this.busy || this.modal || this.latest < 0) return;
    await this.loadSlot(this.latest);
  }

  private async loadSlot(slot: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await Session.saves.load(slot);
      if (!res.ok) {
        this.busy = false;
        this.status = t('menu.loadFailed');
        this.build();
        return;
      }
      if (res.recoveredFromBackup) bus.emit('toast', { key: 'toast.recovered', tone: 'good' });
      Controls.resetModals();
      Session.begin(res.state, slot === 0 ? 1 : slot);
      this.modal?.close(true);
      this.scene.stop('Menu');
      this.scene.start('Game');
    } catch (err) {
      Log.error('menu', 'Load failed', err);
      this.busy = false;
      this.status = t('menu.loadFailed');
      this.build();
    }
  }
}
void ConfirmPanel;
