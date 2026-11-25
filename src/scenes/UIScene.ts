import Phaser from 'phaser';
import { Session } from '../core/Session';
import { bus } from '../core/EventBus';
import { Settings } from '../core/Settings';
import { Controls } from '../input/Controls';
import { Audio } from '../audio/AudioManager';
import { dateFromDay, festivalOn } from '../core/Calendar';
import { currentHint } from '../data/hints';
import { QUESTS } from '../data/quests';
import { objectiveProgress } from '../systems/Quests';
import { t } from '../i18n/I18n';
import { Modal, setupUiCamera, type UiHost } from '../ui/Modal';
import { UiMetrics, addText, makeButton, theme } from '../ui/Widgets';
import { makeSlot } from '../ui/ItemSlot';
import { InventoryPanel } from '../ui/panels/InventoryPanel';
import { JournalPanel } from '../ui/panels/JournalPanel';
import { PausePanel } from '../ui/panels/PausePanel';
import { DialoguePanel } from '../ui/panels/DialoguePanel';
import { CraftPanel } from '../ui/panels/CraftPanel';
import { ConfirmPanel } from '../ui/panels/ConfirmPanel';
import type { StationId } from '../data/recipes';
import type { GameScene, ContextPrompt } from './GameScene';
import { keyLabel } from '../input/Controls';

interface Toast {
  text: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Graphics;
  life: number;
}

export class UIScene extends Phaser.Scene implements UiHost {
  get sc(): Phaser.Scene {
    return this;
  }
  W = 640;
  H = 400;
  modal: Modal | null = null;
  private zoom = 1;
  private hud?: Phaser.GameObjects.Container;
  private toastLayer?: Phaser.GameObjects.Container;
  private toasts: Toast[] = [];
  private fadeRect?: Phaser.GameObjects.Rectangle;
  private fadeAlpha = 0;
  private statusText?: Phaser.GameObjects.Text;
  private goldText?: Phaser.GameObjects.Text;
  private bars: Record<string, { g: Phaser.GameObjects.Graphics; w: number; h: number }> = {};
  private hotbar?: Phaser.GameObjects.Container;
  private hintText?: Phaser.GameObjects.Text;
  private questText?: Phaser.GameObjects.Text;
  private actionBtn?: Phaser.GameObjects.Container;
  private ctx: ContextPrompt | null = null;
  private joyBase?: Phaser.GameObjects.Arc;
  private joyKnob?: Phaser.GameObjects.Arc;
  private joyPointer = -1;
  private joyOrigin = { x: 0, y: 0 };
  private unsubs: Array<() => void> = [];
  private hudDirty = true;
  private gameScene!: GameScene;

  constructor() {
    super('UI');
  }

  relayout(): void {
    const r = setupUiCamera(this);
    this.W = r.W;
    this.H = r.H;
    this.zoom = r.zoom;
    UiMetrics.zoom = r.zoom;
  }

  init(data: { game: GameScene }): void {
    this.gameScene = data.game;
  }

  create(): void {
    this.input.addPointer(2);
    this.modal = null;
    this.toasts = [];
    this.relayout();
    this.buildHud();
    this.fadeRect = this.add.rectangle(0, 0, 4000, 4000, 0x0b1217, 0).setOrigin(0.5).setDepth(5000);
    this.fadeRect.setPosition(this.W / 2, this.H / 2).setScale(2);

    const dirty = () => (this.hudDirty = true);
    this.unsubs.push(bus.on('settings:changed', () => (this.relayout(), this.buildHud())));
    this.unsubs.push(bus.on('language:changed', () => this.buildHud()));
    this.unsubs.push(bus.on('inventory:changed', dirty));
    this.unsubs.push(bus.on('player:stats', dirty));
    this.unsubs.push(bus.on('quest:updated', dirty));
    this.unsubs.push(bus.on('time:minute', dirty));
    this.unsubs.push(
      bus.on('toast', (e) => {
        this.toast(e.key, e.params, e.tone);
        if (e.tone === 'good' && e.key.startsWith('toast.quest')) Audio.sfx('quest');
        if (e.key === 'toast.levelUp') Audio.sfx('level');
        if (e.key === 'toast.discovery') Audio.sfx('discover');
      })
    );
    this.events.on('toast-direct', (key: string) => this.toast(key));
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const u of this.unsubs) u();
      this.unsubs = [];
      this.scale.off('resize', this.onResize, this);
      this.modal?.close(true);
      Controls.hudRects = [];
    });
    this.input.on('pointerdown', this.onJoyDown, this);
    this.input.on('pointermove', this.onJoyMove, this);
    this.input.on('pointerup', this.onJoyUp, this);
    // audio must start from a user gesture
    this.input.on('pointerdown', () => Audio.unlock());
    this.input.keyboard?.on('keydown', () => Audio.unlock());
  }

  private onResize(): void {
    this.relayout();
    this.buildHud();
    this.modal?.rebuild();
    this.fadeRect?.setPosition(this.W / 2, this.H / 2);
  }

  /* ------------------------------------------------------------ API used by GameScene */
  hasModal(): boolean {
    return !!this.modal;
  }
  closeModal(): void {
    this.modal?.close();
  }
  modalConfirm(): void {
    this.modal?.onConfirm();
  }
  modalNumber(n: number): void {
    this.modal?.onNumber(n);
  }
  openInventory(): void {
    if (this.modal instanceof InventoryPanel) return this.modal.close();
    new InventoryPanel(this);
  }
  openJournal(): void {
    if (this.modal instanceof JournalPanel) return this.modal.close();
    new JournalPanel(this);
  }
  openPause(): void {
    new PausePanel(this, {
      load: (slot) => void this.loadSlot(slot),
      quit: () => this.quitToTitle()
    });
  }
  openDialogue(npcId: string, node: string, onDone?: () => void): void {
    new DialoguePanel(this, npcId, node, onDone);
  }
  openCraft(station: StationId): void {
    new CraftPanel(this, station);
  }
  openConfirm(msg: string, yes: string, no: string, onYes: () => void): void {
    new ConfirmPanel(this, msg, yes, no, onYes);
  }
  setContext(c: ContextPrompt | null): void {
    this.ctx = c;
    this.updateActionButton();
  }
  fade(to: number, ms: number): void {
    this.tweens.add({ targets: this, fadeAlpha: to, duration: ms });
  }

  private async loadSlot(slot: number): Promise<void> {
    const res = await Session.saves.load(slot);
    if (!res.ok) return void this.toast('menu.loadFailed', undefined, 'warn');
    if (res.recoveredFromBackup) bus.emit('toast', { key: 'toast.recovered', tone: 'good' });
    this.gameScene.stopPlaying();
    Session.begin(res.state, slot === 0 ? Session.slot : slot);
    this.game.scene.start('Game');
  }

  private quitToTitle(): void {
    this.gameScene.stopPlaying();
    this.game.scene.start('Menu');
  }

  /* ------------------------------------------------------------ HUD */
  private buildHud(): void {
    this.hud?.destroy();
    this.toastLayer?.destroy();
    this.bars = {};
    const th = theme();
    const hud = this.add.container(0, 0).setDepth(100);
    this.hud = hud;
    this.toastLayer = this.add.container(0, 0).setDepth(3000);
    const touch = Controls.isTouchDevice();
    Controls.touchActive = touch;
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const reg = (x: number, y: number, w: number, h: number) => rects.push({ x: x * this.zoom, y: y * this.zoom, w: w * this.zoom, h: h * this.zoom });

    // status card
    const sw = 196;
    const sh = 112;
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.25);
    card.fillRoundedRect(10, 12, sw, sh, 10);
    card.fillStyle(th.panel, 0.94);
    card.fillRoundedRect(8, 8, sw, sh, 10);
    card.lineStyle(2.5, th.panelEdge, 1);
    card.strokeRoundedRect(8, 8, sw, sh, 10);
    hud.add(card);
    this.statusText = addText(this, 18, 13, '', 12, undefined, { bold: true });
    this.goldText = addText(this, 8 + sw - 10, 13, '', 13, undefined, { bold: true }).setOrigin(1, 0);
    hud.add([this.statusText, this.goldText]);
    const barDefs: Array<[string, string, number]> = [['hp', 'stat.health', 0xd9534f], ['energy', 'stat.energy', 0xf0b429], ['hunger', 'stat.hunger', 0x7fb069]];
    barDefs.forEach(([key, label, color], i) => {
      const y = 52 + i * 21;
      hud.add(addText(this, 18, y - 1, t(label), 10, th.textDim, { bold: true }));
      const g = this.add.graphics();
      g.setPosition(80, y);
      hud.add(g);
      this.bars[key] = { g, w: sw - 90, h: 13 };
      (g as unknown as { color: number }).color = color;
    });
    reg(8, 8, sw, sh);

    // top-right menu buttons
    const bw = 40;
    const labels: Array<[string, () => void]> = [
      ['🎒', () => this.openInventory()],
      ['📖', () => this.openJournal()],
      ['☰', () => this.openPause()]
    ];
    labels.forEach(([ic, fn], i) => {
      const b = makeButton(this, this.W - 10 - (3 - i) * (bw + 6) + 6, 10, bw, bw, ic, fn, { size: 18 });
      hud.add(b);
    });
    reg(this.W - 10 - 3 * (bw + 6) + 6, 10, 3 * (bw + 6), bw);

    // quest tracker + hint
    this.questText = addText(this, 12, sh + 14, '', 12, '#ffffff', { wrap: 230 }).setStroke('#1b2a30', 4);
    hud.add(this.questText);
    this.hintText = addText(this, this.W / 2, this.H - 106, '', 14, '#ffffff', { wrap: Math.min(this.W - 40, 520), align: 'center' }).setOrigin(0.5, 1).setStroke('#1b2a30', 5);
    hud.add(this.hintText);

    // hotbar
    const size = Math.max(30, Math.min(46, touch ? (this.W - 300) / 8.4 : (this.W - 40) / 8.4));
    const gap = 4;
    const total = 8 * size + 7 * gap;
    const hx = (this.W - total) / 2;
    const hy = this.H - size - 10;
    this.hotbar = this.add.container(hx, hy);
    hud.add(this.hotbar);
    this.hotbarSize = size;
    this.hotbarGap = gap;
    reg(hx - 4, hy - 4, total + 8, size + 8);
    this.drawHotbar();

    // touch controls
    if (touch) {
      const ar = 38;
      const ax = this.W - 62;
      const ay = this.H - 100;
      const act = this.add.container(ax, ay);
      const g = this.add.graphics();
      g.fillStyle(th.accent, 0.92);
      g.fillCircle(0, 0, ar);
      g.lineStyle(3, th.panelEdge, 1);
      g.strokeCircle(0, 0, ar);
      const lbl = addText(this, 0, 0, '', 14, th.textOnAccent, { bold: true, align: 'center' }).setOrigin(0.5);
      const hit = this.add.circle(0, 0, ar + 6, 0xffffff, 0.001).setInteractive();
      hit.on('pointerdown', () => (Audio.unlock(), Controls.press('interact')));
      act.add([g, lbl, hit]);
      (act as unknown as { label: Phaser.GameObjects.Text }).label = lbl;
      this.actionBtn = act;
      hud.add(act);
      reg(ax - ar - 6, ay - ar - 6, (ar + 6) * 2, (ar + 6) * 2);
      const ub = makeButton(this, ax - ar - 62, ay + 10, 52, 52, t('action.use'), () => Controls.press('use'), { size: 12, sfx: false });
      hud.add(ub);
      reg(ax - ar - 62, ay + 10, 52, 52);
      // joystick graphics (positioned on touch)
      this.joyBase = this.add.circle(0, 0, 52, 0x2b2430, 0.28).setStrokeStyle(3, 0xffffff, 0.5).setVisible(false).setDepth(120);
      this.joyKnob = this.add.circle(0, 0, 24, 0xffffff, 0.55).setVisible(false).setDepth(121);
      hud.add([this.joyBase, this.joyKnob]);
      this.updateActionButton();
    } else this.actionBtn = undefined;

    Controls.hudRects = rects;
    this.hudDirty = true;
  }

  private hotbarSize = 44;
  private hotbarGap = 4;

  private drawHotbar(): void {
    if (!this.hotbar) return;
    this.hotbar.removeAll(true);
    const st = Session.state;
    for (let i = 0; i < 8; i++) {
      const stack = st.inventory.slots[i];
      this.hotbar.add(
        makeSlot(this, i * (this.hotbarSize + this.hotbarGap), 0, this.hotbarSize, stack, {
          selected: st.inventory.selected === i,
          hotbar: true,
          keyLabel: String(i + 1),
          onClick: () => Controls.press(`hotbar${i + 1}` as 'hotbar1')
        })
      );
    }
  }

  private updateActionButton(): void {
    const lbl = (this.actionBtn as unknown as { label?: Phaser.GameObjects.Text } | undefined)?.label;
    if (!lbl) return;
    lbl.setText(this.ctx ? t(this.ctx.action) : t('action.interact'));
    lbl.setAlpha(this.ctx ? 1 : 0.7);
  }

  private refreshHud(): void {
    const st = Session.state;
    if (!st || !this.statusText) return;
    const d = dateFromDay(st.time.day);
    const h = Math.floor(st.time.minutes / 60) % 24;
    const m = Math.floor(st.time.minutes % 60 / 10) * 10;
    const fest = festivalOn(st.time.day);
    this.statusText.setText(`${t(`weekday.${d.weekday}`)} ${d.dayOfSeason} ${t(`season.${d.season}`)}\n${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}  ${t(`weather.${st.weather.today}`)}${fest ? ' ★' : ''}`);
    this.goldText?.setText(`${st.player.gold}g`);
    const p = st.player;
    const vals: Record<string, number> = { hp: p.hp / p.maxHp, energy: p.energy / p.maxEnergy, hunger: p.hunger / 100 };
    for (const [k, b] of Object.entries(this.bars)) {
      const v = Phaser.Math.Clamp(vals[k], 0, 1);
      const color = (b.g as unknown as { color: number }).color;
      const th = theme();
      b.g.clear();
      b.g.fillStyle(th.slot, 1);
      b.g.fillRoundedRect(0, 0, b.w, b.h, 5);
      b.g.fillStyle(v < 0.2 ? 0xd9534f : color, 1);
      b.g.fillRoundedRect(0, 0, Math.max(2, b.w * v), b.h, 5);
      b.g.lineStyle(1.5, th.panelEdge, 1);
      b.g.strokeRoundedRect(0, 0, b.w, b.h, 5);
    }
    this.drawHotbar();
    // objective
    const ids = Object.keys(st.quests.active).filter((id) => QUESTS[id]?.kind === 'main');
    const id = ids[0] ?? Object.keys(st.quests.active)[0];
    if (id && !Controls.touchActive) {
      const o = objectiveProgress(st, id).find((x) => x.current < x.target);
      this.questText?.setText(`${t('hud.objective')}: ${t(`quest.${id}.title`)}\n${o ? `${t(`obj.${o.stat}`)} ${o.current}/${o.target}` : ''}`);
    } else this.questText?.setText('');
    // contextual hint (only when nothing is open)
    const hint = currentHint(st);
    const k = Settings.data.keys;
    const kl = (a: keyof typeof k) => keyLabel(k[a][0]);
    const touch = Controls.touchActive;
    this.hintText?.setText(
      hint && !this.modal
        ? t(hint.text, { move: touch ? '🕹' : `${kl('up')}${kl('left')}${kl('down')}${kl('right')}`, use: touch ? t('action.use') : kl('use'), interact: touch ? t('action.interact') : kl('interact'), inv: touch ? '🎒' : kl('inventory'), journal: touch ? '📖' : kl('journal'), eat: kl('eat') })
        : ''
    );
    this.hudDirty = false;
  }

  /* ------------------------------------------------------------ toasts */
  toast(key: string, params?: Record<string, string | number>, tone: 'info' | 'good' | 'warn' = 'info'): void {
    if (!this.toastLayer) return;
    const th = theme();
    const txt = addText(this, 0, 0, t(key, params), 14, tone === 'warn' ? th.warn : tone === 'good' ? th.good : th.text, { bold: true, wrap: Math.min(this.W - 60, 420), align: 'center' }).setOrigin(0.5);
    const w = txt.width + 28;
    const h = txt.height + 14;
    const bg = this.add.graphics();
    bg.fillStyle(th.panel, 0.96);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.lineStyle(2, th.panelEdge, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    this.toastLayer.add([bg, txt]);
    this.toasts.push({ text: txt, bg, life: 3.2 });
    if (this.toasts.length > 4) {
      const old = this.toasts.shift()!;
      old.text.destroy();
      old.bg.destroy();
    }
  }

  /* ------------------------------------------------------------ joystick */
  private joyAllowed(p: Phaser.Input.Pointer): boolean {
    if (!Controls.touchActive || this.modal) return false;
    if (Controls.overHud(p.x, p.y)) return false;
    return p.x < this.scale.width * 0.55 && p.y > this.scale.height * 0.25;
  }
  private onJoyDown(p: Phaser.Input.Pointer): void {
    if (this.joyPointer !== -1 || !this.joyAllowed(p)) return;
    this.joyPointer = p.id;
    this.joyOrigin = { x: p.x / this.zoom, y: p.y / this.zoom };
    this.joyBase?.setPosition(this.joyOrigin.x, this.joyOrigin.y).setVisible(true);
    this.joyKnob?.setPosition(this.joyOrigin.x, this.joyOrigin.y).setVisible(true);
  }
  private onJoyMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyPointer) return;
    const dx = p.x / this.zoom - this.joyOrigin.x;
    const dy = p.y / this.zoom - this.joyOrigin.y;
    const max = 46;
    const len = Math.hypot(dx, dy);
    const k = len > max ? max / len : 1;
    this.joyKnob?.setPosition(this.joyOrigin.x + dx * k, this.joyOrigin.y + dy * k);
    const dead = 8;
    if (len < dead) Controls.touch.x = Controls.touch.y = 0;
    else {
      Controls.touch.x = (dx * k) / max;
      Controls.touch.y = (dy * k) / max;
    }
  }
  private onJoyUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyPointer) return;
    this.joyPointer = -1;
    Controls.touch.x = Controls.touch.y = 0;
    this.joyBase?.setVisible(false);
    this.joyKnob?.setVisible(false);
  }

  update(_t: number, dms: number): void {
    const dt = dms / 1000;
    this.fadeRect?.setFillStyle(0x0b1217, this.fadeAlpha);
    if (this.hudDirty) this.refreshHud();
    // stack toasts at the top-centre
    let y = 28;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const tt = this.toasts[i];
      tt.life -= dt;
      const a = Phaser.Math.Clamp(tt.life / 0.5, 0, 1);
      const tx = this.W / 2;
      tt.text.setPosition(tx, y + tt.text.height / 2 + 7).setAlpha(a);
      tt.bg.setPosition(tx, y + tt.text.height / 2 + 7).setAlpha(a);
      y += tt.text.height + 20;
      if (tt.life <= 0) {
        tt.text.destroy();
        tt.bg.destroy();
        this.toasts.splice(i, 1);
      }
    }
  }
}
