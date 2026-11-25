import { t } from '../../i18n/I18n';
import { Modal, type UiHost } from '../Modal';
import { addText, makeButton } from '../Widgets';

export class ConfirmPanel extends Modal {
  constructor(host: UiHost, private msgKey: string, private yesKey: string, private noKey: string, private onYes: () => void, private onNo?: () => void) {
    super(host, { w: 420, h: 190, closeable: false, dim: 0.55 });
    this.build();
  }

  protected build(): void {
    const s = this.host.sc;
    this.body.add(addText(s, 28, 30, t(this.msgKey), 17, undefined, { wrap: this.pw - 56, bold: true }));
    const bw = (this.pw - 28 * 2 - 14) / 2;
    this.body.add(makeButton(s, 28, this.ph - 62, bw, 42, t(this.yesKey), () => (this.close(true), this.onYes()), { primary: true, size: 16 }));
    this.body.add(makeButton(s, 28 + bw + 14, this.ph - 62, bw, 42, t(this.noKey), () => (this.close(), this.onNo?.()), { size: 16 }));
  }

  onConfirm(): void {
    this.close(true);
    this.onYes();
  }
}
