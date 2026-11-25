import { Session } from '../../core/Session';
import { t } from '../../i18n/I18n';
import { Modal, type UiHost } from '../Modal';
import { makeButton } from '../Widgets';
import { SettingsPanel } from './SettingsPanel';
import { SlotsPanel } from './SlotsPanel';
import { ConfirmPanel } from './ConfirmPanel';

export class PausePanel extends Modal {
  constructor(host: UiHost, private callbacks: { load: (slot: number) => void; quit: () => void }) {
    super(host, { w: 340, h: 360, title: t('panel.pause') });
    this.build();
  }

  protected build(): void {
    const s = this.host.sc;
    const bw = this.pw - 60;
    const items: Array<[string, () => void, boolean?]> = [
      [t('pause.resume'), () => this.close(), true],
      [t('pause.save'), () => void Session.saveManual()],
      [t('pause.saves'), () => (this.close(true), new SlotsPanel(this.host, 'game', this.callbacks.load, () => new PausePanel(this.host, this.callbacks)))],
      [t('pause.settings'), () => (this.close(true), new SettingsPanel(this.host, () => new PausePanel(this.host, this.callbacks)))],
      [t('pause.quit'), () => (this.close(true), new ConfirmPanel(this.host, 'pause.quitConfirm', 'pause.quit', 'common.cancel', this.callbacks.quit, () => new PausePanel(this.host, this.callbacks)))]
    ];
    items.forEach(([label, fn, primary], i) => this.body.add(makeButton(s, 30, 58 + i * 56, bw, 46, label, fn, { primary, size: 16 })));
  }
}
