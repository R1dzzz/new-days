import Phaser from 'phaser';
import { Controls } from '../input/Controls';
import { Audio } from '../audio/AudioManager';
import { addText, drawPanel, makeBlocker, makeButton, theme } from './Widgets';
import { Settings } from '../core/Settings';
import { bus } from '../core/EventBus';

/** What a modal needs from the scene that hosts it. Implemented by UIScene and by the menu scenes. */
export interface UiHost {
  sc: Phaser.Scene;
  /** Logical (zoom-compensated) size of the UI canvas. */
  W: number;
  H: number;
  modal: Modal | null;
  /** Recompute W/H/zoom after a resize or settings change. */
  relayout(): void;
}

/** Compute and apply the UI camera for a scene; returns the logical size. */
export function setupUiCamera(scene: Phaser.Scene): { W: number; H: number; zoom: number } {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const zoom = Phaser.Math.Clamp(Math.min(w / 640, h / 400), 0.55, 2.4) * Settings.data.uiScale;
  const cam = scene.cameras.main;
  cam.setZoom(zoom);
  cam.setScroll((w / zoom - w) / 2, (h / zoom - h) / 2);
  cam.setBackgroundColor('rgba(0,0,0,0)');
  return { W: w / zoom, H: h / zoom, zoom };
}

export interface ModalOpts {
  w: number;
  h: number;
  title?: string;
  dim?: number;
  closeable?: boolean;
  anchor?: 'center' | 'bottom';
  onClose?: () => void;
}

/** Base class: dimmed backdrop, centred parchment panel, title, close button, Esc handling. */
export abstract class Modal {
  protected root!: Phaser.GameObjects.Container;
  /** Content container, origin = panel top-left. */
  protected body!: Phaser.GameObjects.Container;
  protected pw = 0;
  protected ph = 0;
  closed = false;
  private escHandler?: () => void;
  private unsub?: () => void;

  constructor(protected host: UiHost, protected opts: ModalOpts) {
    if (host.modal) host.modal.close(true);
    host.modal = this;
    Controls.pushModal();
    Audio.sfx('ui');
    this.frame();
    const kb = host.sc.input.keyboard;
    if (kb && opts.closeable !== false) {
      this.escHandler = () => this.close();
      kb.on('keydown-ESC', this.escHandler);
    }
    // rebuild in place if language/size/scale changes while open
    this.unsub = bus.on('settings:changed', () => !this.closed && this.rebuild());
  }

  /** Subclasses call build() from their own constructor tail (after fields are set up). */
  protected abstract build(): void;

  private frame(): void {
    const s = this.host.sc;
    const { W, H } = this.host;
    this.pw = Math.min(this.opts.w, W - 12);
    this.ph = Math.min(this.opts.h, H - 12);
    this.root = s.add.container(0, 0).setDepth(1000);
    const blocker = makeBlocker(s, W, H, this.opts.dim ?? 0.5);
    const px = (W - this.pw) / 2;
    const py = this.opts.anchor === 'bottom' ? H - this.ph - 8 : (H - this.ph) / 2;
    const panelBg = s.add.graphics();
    panelBg.setPosition(px, py);
    drawPanel(panelBg, this.pw, this.ph);
    this.body = s.add.container(px, py);
    this.root.add([blocker, panelBg, this.body]);
    if (this.opts.title) this.body.add(addText(s, 22, 14, this.opts.title, 20, undefined, { bold: true }));
    if (this.opts.closeable !== false) this.body.add(makeButton(s, this.pw - 46, 10, 34, 30, '✕', () => this.close(), { size: 16 }));
  }

  /** Destroy and rebuild the content (after resize/language/scale changes). */
  rebuild(): void {
    if (this.closed) return;
    this.root.destroy();
    this.frame();
    this.build();
  }

  close(silent = false): void {
    if (this.closed) return;
    this.closed = true;
    const kb = this.host.sc.input.keyboard;
    if (kb && this.escHandler) kb.off('keydown-ESC', this.escHandler);
    this.unsub?.();
    this.root.destroy();
    if (this.host.modal === this) this.host.modal = null;
    Controls.popModal();
    if (!silent) Audio.sfx('back');
    this.opts.onClose?.();
  }

  /** Keyboard "confirm" while the modal is open (Space/E). Override where useful. */
  onConfirm(): void {}
  /** Number keys 1..9 while open. Override where useful. */
  onNumber(_n: number): void {}

  protected get th() {
    return theme();
  }
}
