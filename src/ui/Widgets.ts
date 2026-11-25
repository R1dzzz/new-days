import Phaser from 'phaser';
import { Settings } from '../core/Settings';
import { FONT_STACK } from '../i18n/I18n';
import { Audio } from '../audio/AudioManager';

export interface Theme {
  panel: number;
  panelEdge: number;
  ink: number;
  accent: number;
  accent2: number;
  text: string;
  textDim: string;
  textOnAccent: string;
  good: string;
  warn: string;
  slot: number;
  slotEdge: number;
}

export function theme(): Theme {
  if (Settings.data.highContrast) {
    return { panel: 0x10141a, panelEdge: 0xffffff, ink: 0xffffff, accent: 0xffd23f, accent2: 0x3fd0ff, text: '#ffffff', textDim: '#d0d6de', textOnAccent: '#101010', good: '#7dff9a', warn: '#ff8f7a', slot: 0x1d242e, slotEdge: 0xffffff };
  }
  return { panel: 0xf4e9cf, panelEdge: 0x2b2430, ink: 0x2b2430, accent: 0xc9533f, accent2: 0x2f7a78, text: '#2b2430', textDim: '#6f6256', textOnAccent: '#fff7e6', good: '#2f7a3a', warn: '#b5352a', slot: 0xe3d3ab, slotEdge: 0xb59a62 };
}

/** Scale factor of the UI camera; set by UIScene so text can render crisply at its zoom. */
export const UiMetrics = { zoom: 1 };

export function textStyle(size: number, color?: string, opts: { bold?: boolean; wrap?: number; align?: 'left' | 'center' | 'right' } = {}): Phaser.Types.GameObjects.Text.TextStyle {
  const th = theme();
  const scale = Settings.data.textScale;
  return {
    fontFamily: FONT_STACK,
    fontSize: `${Math.round(size * scale)}px`,
    fontStyle: opts.bold ? 'bold' : 'normal',
    color: color ?? th.text,
    align: opts.align ?? 'left',
    wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
    resolution: Math.min(4, Math.max(1, Math.ceil(UiMetrics.zoom * (window.devicePixelRatio || 1))))
  };
}

export function addText(scene: Phaser.Scene, x: number, y: number, str: string, size: number, color?: string, opts?: Parameters<typeof textStyle>[2]): Phaser.GameObjects.Text {
  return scene.add.text(x, y, str, textStyle(size, color, opts));
}

/** Parchment panel with a double border and corner studs. Origin = top-left. */
export function drawPanel(g: Phaser.GameObjects.Graphics, w: number, h: number, th = theme()): void {
  g.clear();
  g.fillStyle(0x000000, 0.28);
  g.fillRoundedRect(3, 5, w, h, 12);
  g.fillStyle(th.panel, 1);
  g.fillRoundedRect(0, 0, w, h, 12);
  g.lineStyle(3, th.panelEdge, 1);
  g.strokeRoundedRect(0, 0, w, h, 12);
  g.lineStyle(1.5, Settings.data.highContrast ? 0xffffff : 0xc9a96a, 1);
  g.strokeRoundedRect(6, 6, w - 12, h - 12, 8);
  if (!Settings.data.highContrast) {
    g.fillStyle(0xc9a96a, 1);
    for (const [cx, cy] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]] as const) g.fillCircle(cx, cy, 2.4);
  }
}

export function makePanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  drawPanel(g, w, h);
  c.add(g);
  c.setSize(w, h);
  return c;
}

export interface ButtonOpts {
  primary?: boolean;
  disabled?: boolean;
  size?: number;
  sfx?: boolean;
}

/** Rounded button; container origin is its top-left. */
export function makeButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, opts: ButtonOpts = {}): Phaser.GameObjects.Container {
  const th = theme();
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const txt = addText(scene, w / 2, h / 2, label, opts.size ?? 16, opts.primary ? th.textOnAccent : th.text, { bold: true, align: 'center' }).setOrigin(0.5);
  txt.setWordWrapWidth?.(w - 10);
  const hit = scene.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0.001);
  c.add([bg, txt, hit]);
  c.setSize(w, h);
  let state: 'idle' | 'hover' | 'down' = 'idle';
  const paint = () => {
    bg.clear();
    const disabled = opts.disabled;
    const base = opts.primary ? th.accent : th.slot;
    const shade = disabled ? 0x9a9488 : state === 'down' ? Phaser.Display.Color.ValueToColor(base).darken(14).color : state === 'hover' ? Phaser.Display.Color.ValueToColor(base).lighten(8).color : base;
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(1, state === 'down' ? 2 : 3, w, h, 9);
    bg.fillStyle(shade, 1);
    bg.fillRoundedRect(0, state === 'down' ? 2 : 0, w, h, 9);
    bg.lineStyle(2, th.panelEdge, 1);
    bg.strokeRoundedRect(0, state === 'down' ? 2 : 0, w, h, 9);
    txt.y = h / 2 + (state === 'down' ? 2 : 0);
    txt.setAlpha(disabled ? 0.55 : 1);
  };
  paint();
  if (!opts.disabled) {
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => ((state = 'hover'), paint()));
    hit.on('pointerout', () => ((state = 'idle'), paint()));
    hit.on('pointerdown', () => ((state = 'down'), paint()));
    hit.on('pointerup', () => {
      const was = state === 'down';
      state = 'hover';
      paint();
      if (was) {
        if (opts.sfx !== false) Audio.sfx('ui');
        onClick();
      }
    });
  }
  (c as unknown as { setLabel: (s: string) => void }).setLabel = (s: string) => txt.setText(s);
  return c;
}

export function makeSlider(scene: Phaser.Scene, x: number, y: number, w: number, value: number, onChange: (v: number) => void, min = 0, max = 1): Phaser.GameObjects.Container {
  const th = theme();
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const knob = scene.add.circle(0, 0, 11, th.accent).setStrokeStyle(2, th.panelEdge);
  const hit = scene.add.rectangle(w / 2, 0, w + 28, 34, 0xffffff, 0.001).setInteractive({ useHandCursor: true, draggable: false });
  c.add([g, knob, hit]);
  const norm = (v: number) => (v - min) / (max - min);
  const render = (v: number) => {
    g.clear();
    g.fillStyle(th.slot, 1);
    g.fillRoundedRect(0, -4, w, 8, 4);
    g.fillStyle(th.accent2, 1);
    g.fillRoundedRect(0, -4, w * norm(v), 8, 4);
    g.lineStyle(1.5, th.panelEdge, 1);
    g.strokeRoundedRect(0, -4, w, 8, 4);
    knob.x = w * norm(v);
  };
  render(value);
  let dragging = false;
  const setFromPointer = (p: Phaser.Input.Pointer) => {
    const local = c.getWorldTransformMatrix().applyInverse(p.worldX, p.worldY);
    const n = Phaser.Math.Clamp(local.x / w, 0, 1);
    const v = min + n * (max - min);
    render(v);
    onChange(v);
  };
  hit.on('pointerdown', (p: Phaser.Input.Pointer) => ((dragging = true), setFromPointer(p)));
  const onMove = (p: Phaser.Input.Pointer) => dragging && setFromPointer(p);
  const onUp = () => {
    if (dragging) Audio.sfx('ui');
    dragging = false;
  };
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  c.once('destroy', () => {
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
  });
  return c;
}

/** Left/right selector showing the current option label. Origin top-left. */
export function makeSelector<T extends string | number>(scene: Phaser.Scene, x: number, y: number, w: number, options: Array<{ value: T; label: string }>, current: T, onChange: (v: T) => void): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  let i = Math.max(0, options.findIndex((o) => o.value === current));
  const label = addText(scene, w / 2, 17, options[i]?.label ?? '', 15, undefined, { bold: true, align: 'center' }).setOrigin(0.5);
  const step = (d: number) => {
    i = (i + d + options.length) % options.length;
    label.setText(options[i].label);
    onChange(options[i].value);
  };
  const left = makeButton(scene, 0, 0, 34, 34, '‹', () => step(-1), { size: 20 });
  const right = makeButton(scene, w - 34, 0, 34, 34, '›', () => step(1), { size: 20 });
  c.add([left, right, label]);
  c.setSize(w, 34);
  return c;
}

export function makeToggle(scene: Phaser.Scene, x: number, y: number, on: boolean, onChange: (v: boolean) => void, tOn: string, tOff: string): Phaser.GameObjects.Container {
  let v = on;
  const btn = makeButton(scene, 0, 0, 96, 34, v ? tOn : tOff, () => {
    v = !v;
    (btn as unknown as { setLabel: (s: string) => void }).setLabel(v ? tOn : tOff);
    onChange(v);
  }, { size: 14 });
  btn.setPosition(x, y);
  return btn;
}

/** Full-screen click blocker so taps on a panel's surroundings don't reach the world. */
export function makeBlocker(scene: Phaser.Scene, w: number, h: number, alpha = 0.45, onClick?: () => void): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(w / 2, h / 2, w, h, 0x0b1217, alpha).setInteractive();
  if (onClick) r.on('pointerup', onClick);
  return r;
}
