import Phaser from 'phaser';
import { Audio } from '../audio/AudioManager';
import { Session } from '../core/Session';
import { Settings } from '../core/Settings';
import { Controls } from '../input/Controls';
import { SAVE_SLOTS, TILE } from '../config/constants';
import { createNewState, DEFAULT_APPEARANCE, type Appearance } from '../core/GameState';
import { weatherForDay } from '../core/Calendar';
import { hashSeed } from '../core/Rng';
import { t } from '../i18n/I18n';
import { Log } from '../core/Logger';
import { bus } from '../core/EventBus';
import { makeCharacterTexture, getIsland } from '../art/TextureFactory';
import { HAIR_COLOR_COUNT, HAIR_STYLE_COUNT, OUTFIT_COLOR_COUNT, OUTFIT_STYLE_COUNT, SKIN_COUNT } from '../art/characterArt';
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES } from '../art/draw';
import { Modal, setupUiCamera, type UiHost } from '../ui/Modal';
import { UiMetrics, addText, makeButton, makePanel, theme } from '../ui/Widgets';
import { ConfirmPanel } from '../ui/panels/ConfirmPanel';
import type { SlotSummary } from '../core/SaveManager';

const MAX_NAME = 14;

/** Character creation: name, appearance with live preview, slot selection (with overwrite confirmation). */
export class CreateScene extends Phaser.Scene implements UiHost {
  get sc(): Phaser.Scene {
    return this;
  }
  W = 640;
  H = 400;
  modal: Modal | null = null;
  private look: Appearance = { ...DEFAULT_APPEARANCE };
  private name = '';
  private slot = 1;
  private summaries: SlotSummary[] = [];
  private layer?: Phaser.GameObjects.Container;
  private preview?: Phaser.GameObjects.Sprite;
  private input_?: HTMLInputElement;
  private starting = false;

  constructor() {
    super('Create');
  }

  relayout(): void {
    const r = setupUiCamera(this);
    this.W = r.W;
    this.H = r.H;
    UiMetrics.zoom = r.zoom;
  }

  create(): void {
    this.modal = null;
    this.starting = false;
    this.look = { ...DEFAULT_APPEARANCE };
    this.name = this.name || '';
    Controls.resetModals();
    this.cameras.main.setBackgroundColor('#2a3a52');
    this.add.image(0, 0, 'sky_dusk').setOrigin(0).setDisplaySize(4000, 4000).setDepth(-10).setScrollFactor(0);
    this.relayout();
    void this.refreshSlots();
    const rel = () => {
      this.relayout();
      this.build();
    };
    this.scale.on('resize', rel);
    const off = bus.on('settings:changed', rel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', rel);
      off();
      this.removeInput();
    });
    this.build();
  }

  private async refreshSlots(): Promise<void> {
    try {
      this.summaries = await Session.saves.listSlots();
      const free = this.summaries.find((s) => s.slot >= 1 && s.empty);
      if (free) this.slot = free.slot;
    } catch (err) {
      Log.error('create', 'listSlots failed', err);
    }
    if (this.scene.isActive()) this.build();
  }

  private removeInput(): void {
    this.input_?.remove();
    this.input_ = undefined;
  }

  /** The name field is a real DOM input positioned over the canvas (best for IME / mobile keyboards). */
  private placeInput(x: number, y: number, w: number, h: number): void {
    const zoom = this.cameras.main.zoom;
    const rect = this.game.canvas.getBoundingClientRect();
    const sx = rect.width / this.scale.width;
    const left = rect.left + x * zoom * sx;
    const top = rect.top + y * zoom * sx;
    if (!this.input_) {
      const el = document.createElement('input');
      el.type = 'text';
      el.maxLength = MAX_NAME;
      el.autocomplete = 'off';
      el.spellcheck = false;
      el.setAttribute('aria-label', t('create.name'));
      el.style.cssText = 'position:fixed;z-index:20;box-sizing:border-box;border:3px solid #3a2a18;border-radius:8px;background:#fff8e6;color:#2b1d0e;font-weight:700;padding:0 10px;outline:none;';
      el.addEventListener('input', () => (this.name = el.value));
      el.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') el.blur();
      });
      document.body.appendChild(el);
      this.input_ = el;
    }
    const el = this.input_;
    el.value = this.name;
    el.placeholder = t('create.defaultName');
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${w * zoom * sx}px`;
    el.style.height = `${h * zoom * sx}px`;
    el.style.fontSize = `${Math.round(16 * zoom * sx)}px`;
    el.style.display = this.modal ? 'none' : 'block';
  }

  private cycle(key: keyof Appearance, count: number, dir: number): void {
    this.look[key] = (this.look[key] + dir + count) % count;
    Audio.sfx('ui');
    this.refreshPreview();
    this.build();
  }

  private refreshPreview(): void {
    makeCharacterTexture(this, 'create', this.look);
  }

  private build(): void {
    this.layer?.destroy();
    this.tweens.killAll();
    const { W, H } = this;
    const th = theme();
    const c = this.add.container(0, 0).setDepth(10);
    this.layer = c;
    const pw = Math.min(W - 16, 600);
    const ph = Math.min(H - 16, 380);
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    c.add(makePanel(this, px, py, pw, ph));
    c.add(addText(this, px + 22, py + 12, t('create.title'), 22, undefined, { bold: true }));

    // preview
    const pvx = px + 90;
    const pvy = py + ph / 2 + 10;
    const disc = this.add.ellipse(pvx, pvy + 58, 100, 26, 0x000000, 0.18);
    c.add(disc);
    this.refreshPreview();
    this.preview = this.add.sprite(pvx, pvy + 50, 'char_create', 0).setOrigin(0.5, 44 / 48).setScale(3.2);
    c.add(this.preview);
    if (!Settings.data.reducedMotion) this.tweens.add({ targets: this.preview, y: this.preview.y - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // option rows
    const rx = px + 190;
    const rw = pw - 190 - 22;
    let y = py + 52;
    c.add(addText(this, rx, y + 6, t('create.name'), 14, undefined, { bold: true }));
    this.placeInput(rx + 96, y, rw - 96, 32);
    y += 38;
    const row = (label: string, key: keyof Appearance, count: number, swatch?: readonly string[]) => {
      c.add(addText(this, rx, y + 6, label, 14, undefined, { bold: true }));
      const bx = rx + 96;
      c.add(makeButton(this, bx, y, 34, 30, '◀', () => this.cycle(key, count, -1), { size: 14 }));
      const vx = bx + 40;
      const vw = rw - 96 - 80;
      const g = this.add.graphics();
      g.fillStyle(th.slot, 1);
      g.fillRoundedRect(vx, y, vw, 30, 6);
      g.lineStyle(2, th.slotEdge, 1);
      g.strokeRoundedRect(vx, y, vw, 30, 6);
      c.add(g);
      if (swatch) {
        const col = Phaser.Display.Color.HexStringToColor(swatch[this.look[key] % swatch.length]).color;
        const sw = this.add.rectangle(vx + vw / 2, y + 15, vw - 14, 16, col).setStrokeStyle(2, 0x2a1b0c);
        c.add(sw);
      } else c.add(addText(this, vx + vw / 2, y + 7, `${this.look[key] + 1} / ${count}`, 15, undefined, { align: 'center' }).setOrigin(0.5, 0));
      c.add(makeButton(this, vx + vw + 6, y, 34, 30, '▶', () => this.cycle(key, count, 1), { size: 14 }));
      y += 34;
    };
    row(t('create.skin'), 'skin', SKIN_COUNT, SKIN_TONES as unknown as string[]);
    row(t('create.hair'), 'hairStyle', HAIR_STYLE_COUNT);
    row(t('create.hairColor'), 'hairColor', HAIR_COLOR_COUNT, HAIR_COLORS as unknown as string[]);
    row(t('create.outfit'), 'outfitStyle', OUTFIT_STYLE_COUNT);
    row(t('create.outfitColor'), 'outfitColor', OUTFIT_COLOR_COUNT, OUTFIT_COLORS as unknown as string[]);

    // slot selector
    c.add(addText(this, rx, y + 6, t('create.chooseSlot'), 13, undefined, { bold: true }));
    y += 22;
    const sw = Math.floor((rw - 8 * (SAVE_SLOTS - 1)) / SAVE_SLOTS);
    for (let i = 1; i <= SAVE_SLOTS; i++) {
      const sum = this.summaries.find((s) => s.slot === i);
      const used = !!sum && !sum.empty;
      const label = `${i}${used ? ` · ${sum?.name ?? '?'}` : ''}`;
      c.add(makeButton(this, rx + (i - 1) * (sw + 8), y, sw, 28, label, () => ((this.slot = i), Audio.sfx('ui'), this.build()), { primary: this.slot === i, size: 12 }));
    }

    // footer
    c.add(makeButton(this, px + 20, py + ph - 46, 110, 34, t('create.back'), () => this.back(), { size: 15 }));
    c.add(makeButton(this, px + pw - 20 - 200, py + ph - 46, 200, 34, t('create.start'), () => this.start(), { primary: true, size: 16 }));
  }

  private back(): void {
    if (this.modal || this.starting) return;
    this.scene.start('Menu');
  }

  private start(): void {
    if (this.modal || this.starting) return;
    const sum = this.summaries.find((s) => s.slot === this.slot);
    if (sum && !sum.empty) {
      this.input_ && (this.input_.style.display = 'none');
      const restore = () => this.input_ && (this.input_.style.display = 'block');
      new ConfirmPanel(this, 'create.overwrite', 'create.yes', 'create.no', () => this.begin(), restore);
      return;
    }
    this.begin();
  }

  private begin(): void {
    if (this.starting) return;
    this.starting = true;
    const name = (this.name.trim() || t('create.defaultName')).slice(0, MAX_NAME);
    const seed = hashSeed('lost-traveler', Date.now());
    const island = getIsland();
    const state = createNewState(name, this.look, seed, { x: island.spawn.x * TILE + TILE / 2, y: island.spawn.y * TILE + TILE / 2 });
    state.weather = { today: 'sunny', tomorrow: weatherForDay(seed, 2) };
    Session.begin(state, this.slot);
    void Session.saveManual().then(() => {
      this.removeInput();
      Controls.resetModals();
      this.scene.start('Game');
    });
  }
}
