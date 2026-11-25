import { INVENTORY_SIZE } from '../../config/constants';
import { Session } from '../../core/Session';
import { t } from '../../i18n/I18n';
import { Modal, type UiHost } from '../Modal';
import { makeSlot } from '../ItemSlot';
import { addText } from '../Widgets';

/** Pick one inventory slot (used for gifts). */
export class SlotPickerPanel extends Modal {
  constructor(host: UiHost, private title: string, private onPick: (slot: number) => void, onCancel?: () => void) {
    super(host, { w: 520, h: 300, title, onClose: onCancel });
    this.build();
  }

  protected build(): void {
    const s = this.host.sc;
    const cols = 8;
    const gap = 6;
    const size = Math.min(52, Math.floor((this.pw - 40 - gap * (cols - 1)) / cols));
    const gx = Math.floor((this.pw - (size * cols + gap * (cols - 1))) / 2);
    this.body.add(addText(s, gx, 46, t('gift.pick'), 13, this.th.textDim));
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const stack = Session.state.inventory.slots[i];
      this.body.add(
        makeSlot(s, gx + (i % cols) * (size + gap), 70 + Math.floor(i / cols) * (size + gap), size, stack, {
          onClick: () => {
            if (!stack) return;
            this.opts.onClose = undefined;
            this.close(true);
            this.onPick(i);
          }
        })
      );
    }
  }
}
