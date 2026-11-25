import Phaser from 'phaser';
import { TILE } from '../config/constants';
import { NPCS, type NpcDef, type ScheduleEntry, type SpotId } from '../data/npcs';
import { findPath, type Pt } from '../world/Pathfinder';
import type { IslandData } from '../world/WorldData';
import { makeCharacterTexture } from '../art/TextureFactory';
import { DIR_ROW } from '../art/characterArt';

/** Pure schedule lookup (unit-tested): which spot should the NPC be at, given the hour and weather? */
export function scheduledSpot(def: NpcDef, hour: number, rainy: boolean): ScheduleEntry {
  const list = rainy ? def.rainSchedule : def.schedule;
  let current = list[list.length - 1]; // before the first entry, they are still where they ended the previous night
  for (const e of list) if (hour >= e.from) current = e;
  return current;
}

export class NpcEntity {
  readonly def: NpcDef;
  sprite: Phaser.GameObjects.Sprite;
  mark: Phaser.GameObjects.Image;
  /** pixel position of the feet */
  x = 0;
  y = 0;
  private path: Pt[] = [];
  private targetSpot: SpotId | null = null;
  hidden = false;
  facing: 'down' | 'left' | 'right' | 'up' = 'down';
  private animT = 0;
  moving = false;

  constructor(private scene: Phaser.Scene, readonly id: string, private island: IslandData) {
    this.def = NPCS[id];
    const tk = makeCharacterTexture(scene, `npc_${id}`, this.def.look);
    this.sprite = scene.add.sprite(0, 0, tk, 0).setOrigin(0.5, 44 / 48);
    this.mark = scene.add.image(0, 0, 'talkmark').setOrigin(0.5, 1).setVisible(false);
  }

  get tile(): Pt {
    return { x: Math.floor(this.x / TILE), y: Math.floor((this.y - 2) / TILE) };
  }

  /** Place instantly at a spot (used after loading, or at the start of a day). */
  snapTo(spot: SpotId): void {
    const p = this.island.spots[spot];
    this.x = p.x * TILE + TILE / 2;
    this.y = p.y * TILE + TILE - 2;
    this.path = [];
    this.targetSpot = spot;
    this.hidden = spot.startsWith('shelter_');
    this.applyVisual();
  }

  /** Walk toward a spot (re-planned only when the target changes). */
  goTo(spot: SpotId): void {
    if (this.targetSpot === spot) return;
    this.targetSpot = spot;
    const goal = this.island.spots[spot];
    const p = findPath(this.island.blocked, this.tile, goal);
    this.path = p ? p.slice(1) : [];
    if (!p) this.snapTo(spot); // unreachable (should not happen; guarded by tests) — fail safe by teleporting
    if (this.hidden && this.path.length) {
      // leaving a shelter: step out in front of the door
      this.hidden = false;
      this.applyVisual();
    }
  }

  update(dt: number): void {
    this.moving = false;
    if (this.path.length) {
      const next = this.path[0];
      const tx = next.x * TILE + TILE / 2;
      const ty = next.y * TILE + TILE - 2;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      const step = 58 * dt;
      if (dist <= step) {
        this.x = tx;
        this.y = ty;
        this.path.shift();
        if (!this.path.length && this.targetSpot?.startsWith('shelter_')) this.hidden = true;
      } else {
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        this.moving = true;
        this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      }
    }
    this.animT += dt;
    this.applyVisual();
  }

  private applyVisual(): void {
    const row = DIR_ROW[this.facing];
    const col = this.moving ? [1, 0, 3, 2][Math.floor(this.animT * 8) % 4] : 0;
    this.sprite.setFrame(row * 6 + col);
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setDepth(this.y);
    this.sprite.setVisible(!this.hidden);
    this.mark.setPosition(this.x, this.y - 48);
    this.mark.setDepth(this.y + 1000);
    if (this.hidden) this.mark.setVisible(false);
  }

  destroy(): void {
    this.sprite.destroy();
    this.mark.destroy();
  }
}
