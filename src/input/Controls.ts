import Phaser from 'phaser';
import { Settings, type ActionKey } from '../core/Settings';

export type Action = ActionKey | 'pause' | `hotbar${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` | 'hotbarNext' | 'hotbarPrev';

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Reverse lookup: Phaser keyCode -> KeyCodes name ("W", "SPACE", ...). */
const CODE_TO_NAME = new Map<number, string>();
for (const [name, code] of Object.entries(Phaser.Input.Keyboard.KeyCodes)) CODE_TO_NAME.set(code as number, name);

export function keyNameFromCode(code: number): string | undefined {
  return CODE_TO_NAME.get(code);
}

class ControlsImpl {
  /** Joystick output, each axis -1..1. */
  touch = { x: 0, y: 0 };
  /** Keyboard held state by KeyCodes name. */
  private held = new Set<string>();
  private queue: Action[] = [];
  /** Number of open modal panels / dialogues; the world pauses while > 0. */
  private modals = 0;
  /** HUD rectangles in screen pixels, so clicks on them don't also act on the world. */
  hudRects: ScreenRect[] = [];
  /** True when a touch-capable device is in use (or forced). */
  touchActive = false;
  /** While rebinding a key in Settings, raw key presses go here instead of gameplay. */
  captureKey: ((name: string) => void) | null = null;

  get modal(): boolean {
    return this.modals > 0;
  }
  pushModal(): void {
    this.modals++;
    this.clearInput();
  }
  popModal(): void {
    this.modals = Math.max(0, this.modals - 1);
    this.clearInput();
  }
  resetModals(): void {
    this.modals = 0;
    this.clearInput();
  }

  clearInput(): void {
    this.queue.length = 0;
    this.touch.x = 0;
    this.touch.y = 0;
  }

  press(a: Action): void {
    if (this.queue.length < 8) this.queue.push(a);
  }

  drain(): Action[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  /** Wire raw keyboard events into held-state + action queue. Call once per scene that plays. */
  attach(scene: Phaser.Scene): void {
    const kb = scene.input.keyboard;
    if (!kb) return;
    kb.on('keydown', (ev: KeyboardEvent) => {
      const name = keyNameFromCode(ev.keyCode);
      if (!name) return;
      if (this.captureKey) {
        ev.preventDefault();
        const cb = this.captureKey;
        this.captureKey = null;
        cb(name);
        return;
      }
      if (ev.repeat) {
        this.held.add(name);
        return;
      }
      this.held.add(name);
      if (ev.keyCode === 9 || ev.keyCode === 32) ev.preventDefault(); // TAB / SPACE
      const keys = Settings.data.keys;
      for (const [action, names] of Object.entries(keys) as Array<[ActionKey, string[]]>) {
        if (action === 'up' || action === 'down' || action === 'left' || action === 'right') continue;
        // while a panel is open only toggles/confirm are meaningful
        if (this.modal && !(action === 'inventory' || action === 'journal' || action === 'interact')) continue;
        if (names.includes(name)) this.press(action);
      }
      if (!this.modal && (name === 'ESC' || name === 'P')) this.press('pause'); // Esc while a panel is open is handled by the panel itself
      const n = parseInt(name.replace('ONE', '1').replace('TWO', '2').replace('THREE', '3').replace('FOUR', '4').replace('FIVE', '5').replace('SIX', '6').replace('SEVEN', '7').replace('EIGHT', '8'), 10);
      if (n >= 1 && n <= 8) this.press(`hotbar${n}` as Action);
    });
    kb.on('keyup', (ev: KeyboardEvent) => {
      const name = keyNameFromCode(ev.keyCode);
      if (name) this.held.delete(name);
    });
    scene.game.events.on(Phaser.Core.Events.BLUR, () => {
      this.held.clear();
      this.touch.x = this.touch.y = 0;
    });
  }

  private anyHeld(names: string[]): boolean {
    return names.some((n) => this.held.has(n));
  }

  /** Combined movement vector (keyboard + joystick), normalised to length <= 1. */
  moveVector(): { x: number; y: number } {
    if (this.modal) return { x: 0, y: 0 };
    const k = Settings.data.keys;
    let x = (this.anyHeld(k.right) ? 1 : 0) - (this.anyHeld(k.left) ? 1 : 0);
    let y = (this.anyHeld(k.down) ? 1 : 0) - (this.anyHeld(k.up) ? 1 : 0);
    if (x === 0 && y === 0) {
      x = this.touch.x;
      y = this.touch.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  overHud(px: number, py: number): boolean {
    return this.hudRects.some((r) => px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h);
  }

  isTouchDevice(): boolean {
    const mode = Settings.data.touchControls;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /** Human-readable name for a key binding, e.g. "SPACE" → "Space". */
  static label(name: string): string {
    const map: Record<string, string> = { UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→', SPACE: 'Space', ENTER: 'Enter', TAB: 'Tab', ESC: 'Esc' };
    return map[name] ?? name;
  }
}

export const Controls = new ControlsImpl();
export const keyLabel = (n: string): string => (ControlsImpl as unknown as { label: (n: string) => string }).label(n);
