import Phaser from 'phaser';
import { Session } from '../../core/Session';
import { Settings } from '../../core/Settings';
import { Audio } from '../../audio/AudioManager';
import { DialogueRunner, applyEffect } from '../../systems/DialogueRunner';
import { giveGift } from '../../systems/Relationships';
import { checkQuests } from '../../systems/Quests';
import { NPCS } from '../../data/npcs';
import { t } from '../../i18n/I18n';
import { Modal, type UiHost } from '../Modal';
import { addText, makeButton } from '../Widgets';
import { SlotPickerPanel } from './SlotPickerPanel';
import { ShopPanel } from './ShopPanel';

/** Bottom dialogue box with a portrait, typewriter text, choices and keyboard support. */
export class DialoguePanel extends Modal {
  private runner: DialogueRunner;
  private full = '';
  private shown = 0;
  private txt?: Phaser.GameObjects.Text;
  private timer?: Phaser.Time.TimerEvent;
  private choicesAdded = false;
  private pendingGift = false;
  private pendingShop = false;

  constructor(host: UiHost, private npcId: string, startNode: string, private onDone?: () => void) {
    super(host, { w: 640, h: 200, anchor: 'bottom', closeable: false, dim: 0 });
    this.runner = new DialogueRunner(Session.state, npcId, startNode);
    this.enterNode();
    this.build();
  }

  private speakerName(): string {
    const sp = this.runner.node.speaker;
    if (sp === 'narrator') return '';
    const id = sp === 'npc' ? this.npcId : sp;
    return NPCS[id] ? t(`npc.${id}.name`) : '';
  }

  private enterNode(): void {
    const req = this.runner.enter();
    this.pendingGift = !!req.gift;
    this.pendingShop = !!req.openShop;
    this.full = t(this.runner.node.text);
    this.shown = Settings.data.reducedMotion ? this.full.length : 0;
    this.choicesAdded = false;
  }

  protected build(): void {
    const s = this.host.sc;
    const hasPortrait = this.runner.node.speaker !== 'narrator' && !!NPCS[this.runner.node.speaker === 'npc' ? this.npcId : this.runner.node.speaker];
    const tx = hasPortrait ? 112 : 24;
    if (!Settings.data.subtitleBackground) {
      // transparent mode: keep the text legible with a heavy outline instead of the panel
      this.root.list.forEach((o) => ((o as Phaser.GameObjects.Graphics).type === 'Graphics' ? (o as Phaser.GameObjects.Graphics).setAlpha(0.0) : void 0));
    }
    if (hasPortrait) {
      const id = this.runner.node.speaker === 'npc' ? this.npcId : this.runner.node.speaker;
      const frame = s.add.graphics();
      frame.fillStyle(this.th.slot, 1);
      frame.fillRoundedRect(16, 18, 84, 100, 10);
      frame.lineStyle(3, this.th.panelEdge, 1);
      frame.strokeRoundedRect(16, 18, 84, 100, 10);
      this.body.add(frame);
      this.body.add(s.add.image(58, 112, `char_npc_${id}`, 0).setOrigin(0.5, 44 / 48).setScale(2.2));
    }
    const name = this.speakerName();
    if (name) this.body.add(addText(s, tx, 12, name, 17, this.th.text === '#ffffff' ? '#ffd23f' : '#c9533f', { bold: true }));
    this.txt = addText(s, tx, 38, this.full.slice(0, this.shown), 16, undefined, { wrap: this.pw - tx - 24 });
    if (!Settings.data.subtitleBackground) this.txt.setStroke('#000000', 4).setColor('#ffffff');
    this.body.add(this.txt);
    this.timer?.remove();
    if (this.shown < this.full.length) {
      this.timer = s.time.addEvent({
        delay: 18,
        loop: true,
        callback: () => {
          this.shown = Math.min(this.full.length, this.shown + 2);
          this.txt?.setText(this.full.slice(0, this.shown));
          if (this.shown >= this.full.length) {
            this.timer?.remove();
            this.addChoices();
          }
        }
      });
    } else this.addChoices();
    // tapping the box completes the text
    const hit = s.add.rectangle(this.pw / 2, this.ph / 2, this.pw, this.ph, 0xffffff, 0.001).setInteractive();
    hit.on('pointerup', () => this.onConfirm());
    this.body.addAt(hit, 0);
  }

  private addChoices(): void {
    if (this.choicesAdded) return;
    this.choicesAdded = true;
    const s = this.host.sc;
    const choices = this.runner.visibleChoices();
    if (!choices.length) {
      this.body.add(makeButton(s, this.pw - 150, this.ph - 50, 130, 38, t('common.continue'), () => this.advance(), { size: 14, primary: true }));
      return;
    }
    const n = choices.length;
    const bw = Math.min(180, (this.pw - 40 - (n - 1) * 8) / n);
    const startX = this.pw - 20 - n * bw - (n - 1) * 8;
    choices.forEach((c, i) => this.body.add(makeButton(s, startX + i * (bw + 8), this.ph - 52, bw, 40, `${i + 1}. ${t(c.text)}`, () => this.pick(i), { size: 13 })));
  }

  onConfirm(): void {
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.txt?.setText(this.full);
      this.timer?.remove();
      this.addChoices();
      return;
    }
    if (!this.runner.visibleChoices().length) this.advance();
  }

  onNumber(n: number): void {
    if (this.shown >= this.full.length && this.runner.visibleChoices().length >= n) this.pick(n - 1);
  }

  private advance(): void {
    this.runner.next();
    this.afterStep(false);
  }

  private pick(i: number): void {
    const req = this.runner.choose(i);
    if (req.gift) this.pendingGift = true;
    if (req.openShop) this.pendingShop = true;
    this.afterStep(true);
  }

  private afterStep(fromChoice: boolean): void {
    void fromChoice;
    if (this.runner.ended) return this.finish();
    this.enterNode();
    this.rebuildKeepOpen();
  }

  private rebuildKeepOpen(): void {
    this.timer?.remove();
    this.root.destroy();
    (this as unknown as { frame: () => void }).frame();
    this.build();
  }

  private finish(): void {
    this.timer?.remove();
    const gift = this.pendingGift;
    const shop = this.pendingShop;
    const npcId = this.npcId;
    const host = this.host;
    const done = this.onDone;
    this.close(true);
    checkQuests(Session.state);
    if (gift) {
      new SlotPickerPanel(host, t('panel.gift'), (slot) => {
        const outcome = giveGift(Session.state, npcId, slot);
        Audio.sfx(outcome === 'hate' ? 'error' : 'coin');
        checkQuests(Session.state);
        new DialoguePanel(host, npcId, `gift.${outcome}`, done);
      }, () => done?.());
      return;
    }
    if (shop) {
      const shopId = NPCS[npcId]?.shop;
      if (shopId) {
        const hour = Session.state.time.minutes / 60;
        if (hour >= 9 && hour < 18) new ShopPanel(host, shopId, () => done?.());
        else {
          host.sc.events.emit('toast-direct', 'shop.closed');
          done?.();
        }
        return;
      }
    }
    done?.();
  }

  close(silent = false): void {
    this.timer?.remove();
    super.close(silent);
  }
}

export { applyEffect };
