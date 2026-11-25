import Phaser from 'phaser';
import { AUTOSAVE_INTERVAL_MS, DAY_END_MIN, DAYS_PER_SEASON, GAME_MIN_PER_SEC, TILE } from '../config/constants';
import { Session } from '../core/Session';
import { bus } from '../core/EventBus';
import { Log } from '../core/Logger';
import { Rng } from '../core/Rng';
import { Settings } from '../core/Settings';
import { Quality } from '../core/Quality';
import { advanceTime, startNewDay } from '../core/TimeSystem';
import { dateFromDay, festivalOn, weatherForDay } from '../core/Calendar';
import type { GameState } from '../core/GameState';
import { Audio } from '../audio/AudioManager';
import { Controls, type Action } from '../input/Controls';
import { getIsland, makeCharacterTexture } from '../art/TextureFactory';
import { DIR_ROW } from '../art/characterArt';
import { MAP_H, MAP_W, T, idx, inBounds, isTillable, type Building, type IslandData, type WorldObject } from '../world/WorldData';
import { NpcEntity, scheduledSpot } from '../entities/NpcEntity';
import { NPCS } from '../data/npcs';
import { CROPS } from '../data/crops';
import { getItem } from '../data/items';
import { fishQuality, rollFish } from '../data/fish';
import { addItem, canFit, selectedStack } from '../systems/Inventory';
import { addXp, energyDiscount } from '../systems/Skills';
import { eatSlot, spendEnergy, tickNeeds } from '../systems/Needs';
import * as Farm from '../systems/Farming';
import { bumpStat, checkQuests } from '../systems/Quests';
import { discover } from '../systems/Discovery';
import { pickConversation } from '../systems/DialogueRunner';
import type { UIScene } from './UIScene';

type Facing = 'down' | 'left' | 'right' | 'up';
const FACE_VEC: Record<Facing, { x: number; y: number }> = { down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 } };

export type Target =
  | { type: 'npc'; npc: NpcEntity }
  | { type: 'door'; b: Building }
  | { type: 'object'; o: WorldObject }
  | { type: 'plot'; tx: number; ty: number }
  | { type: 'water'; tx: number; ty: number }
  | { type: 'tile'; tx: number; ty: number };

export interface ContextPrompt {
  action: string;
  name?: string;
}

interface FishingState {
  phase: 'wait' | 'bite';
  timer: number;
  fish: string | null;
  window: number;
  bobber: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
}

export class GameScene extends Phaser.Scene {
  island!: IslandData;
  st!: GameState;
  private player!: Phaser.GameObjects.Sprite;
  private px = 0;
  private py = 0;
  private facing: Facing = 'down';
  private animT = 0;
  private swingT = 0;
  private moving = false;
  private npcs: NpcEntity[] = [];
  private objSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private objByTile = new Map<number, WorldObject>();
  private openTiles = new Set<number>();
  private plotSprites = new Map<string, { soil: Phaser.GameObjects.Image; crop?: Phaser.GameObjects.Image }>();
  private cursor!: Phaser.GameObjects.Image;
  private water1!: Phaser.GameObjects.TileSprite;
  private water2?: Phaser.GameObjects.TileSprite;
  private farmDirty = true;
  private mode: 'play' | 'sleeping' = 'play';
  private fishing: FishingState | null = null;
  private lastAutosave = 0;
  private lastPrompt = '';
  private campfire?: Phaser.GameObjects.Sprite;
  private swayables: Array<{ s: Phaser.GameObjects.Sprite; phase: number; o: WorldObject }> = [];
  private unsubs: Array<() => void> = [];
  private bedtimeWarned = false;
  private hungryAt = 0;
  private fpsT = 0;
  private movedAccum = 0;
  private clickTarget: { tx: number; ty: number } | null = null;
  private lastMoodKey = '';
  /** Used by FXScene to project world coordinates. */
  get lightSources(): Array<{ x: number; y: number; r: number; kind: 'fire' | 'window' | 'lamp' }> {
    const out: Array<{ x: number; y: number; r: number; kind: 'fire' | 'window' | 'lamp' }> = [];
    for (const o of this.island.objects) if (o.type === 'campfire') out.push({ x: o.tx * TILE + 16, y: o.ty * TILE + 8, r: 150, kind: 'fire' });
    for (const b of this.island.buildings) {
      if (b.id === 'lighthouse') out.push({ x: b.x * TILE + 32, y: (b.y + b.h) * TILE - 6 * TILE + 8, r: 190, kind: 'lamp' });
      else out.push({ x: (b.x + b.w / 2) * TILE, y: (b.y + b.h) * TILE - 24, r: 90, kind: 'window' });
    }
    return out;
  }

  constructor() {
    super('Game');
  }

  get ui(): UIScene {
    return this.scene.get('UI') as UIScene;
  }
  get player_(): { x: number; y: number } {
    return { x: this.px, y: this.py };
  }

  create(): void {
    this.st = Session.state;
    this.island = getIsland();
    Controls.resetModals();
    Controls.attach(this);
    this.mode = 'play';
    this.fishing = null;
    this.swayables = [];
    this.objSprites.clear();
    this.objByTile.clear();
    this.openTiles.clear();
    this.plotSprites.clear();
    this.npcs = [];
    this.bedtimeWarned = false;
    this.lastAutosave = this.time.now;

    this.buildWorld();
    this.buildPlayer();
    this.buildNpcs();
    this.setupCamera();
    this.syncFarm();

    this.scene.launch('FX', { game: this });
    this.scene.launch('UI', { game: this });
    this.scene.bringToTop('FX');
    this.scene.bringToTop('UI');

    this.unsubs.push(bus.on('farm:changed', () => (this.farmDirty = true)));
    this.unsubs.push(bus.on('settings:changed', () => this.onSettingsChanged()));
    this.scale.on('resize', () => this.setupZoom());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => Controls.press(dy > 0 ? 'hotbarNext' : 'hotbarPrev'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    Audio.setMood({ place: 'island' });
    this.refreshWorldForDay();
    this.snapNpcs();

    if (!this.st.flags['intro_done']) this.time.delayedCall(700, () => this.ui.openDialogue('narrator', 'intro.wake'));
    Log.info('game', `Game started on day ${this.st.time.day}`);
  }

  private cleanup(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.scene.stop('UI');
    this.scene.stop('FX');
    for (const n of this.npcs) n.destroy();
    this.npcs = [];
  }

  /* ------------------------------------------------------------ construction */
  private buildWorld(): void {
    const mapW = MAP_W * TILE;
    const mapH = MAP_H * TILE;
    const pad = 20 * TILE;
    this.water1 = this.add.tileSprite(-pad, -pad, mapW + pad * 2, mapH + pad * 2, 'water_base').setOrigin(0, 0).setDepth(-30);
    if (Quality.profile.waterLayers > 1) this.water2 = this.add.tileSprite(-pad, -pad, mapW + pad * 2, mapH + pad * 2, 'water_hi').setOrigin(0, 0).setDepth(-29).setAlpha(0.75);
    this.add.image(0, 0, 'terrain').setOrigin(0, 0).setDepth(-20);

    // buildings
    const bTex: Record<string, string> = { cabin: 'b_cabin', shop: 'b_shop', lighthouse: 'b_lighthouse', hut: 'b_hut' };
    for (const b of this.island.buildings) this.add.image(b.x * TILE, (b.y + b.h) * TILE + 6, bTex[b.id]).setOrigin(0, 1).setDepth((b.y + b.h) * TILE);

    // objects
    for (const o of this.island.objects) {
      const cx = o.tx * TILE + TILE / 2;
      const base = o.ty * TILE + TILE - 2;
      let s: Phaser.GameObjects.Sprite;
      switch (o.type) {
        case 'tree':
          s = this.add.sprite(cx, base, `tree_${o.v}`).setOrigin(0.5, 92 / 96);
          this.swayables.push({ s, phase: o.tx * 0.7 + o.ty * 0.3, o });
          break;
        case 'rock':
          s = this.add.sprite(cx, base, `rock_${o.v}`).setOrigin(0.5, 28 / 32);
          break;
        case 'bush':
          s = this.add.sprite(cx, base, 'bush_berry').setOrigin(0.5, 28 / 32);
          break;
        case 'shell':
          s = this.add.sprite(cx, o.ty * TILE + TILE / 2, `shell_${o.v}`).setOrigin(0.5, 0.5);
          break;
        case 'campfire':
          s = this.add.sprite(cx, base, 'campfire', 0).setOrigin(0.5, 33 / 40);
          this.campfire = s;
          break;
        case 'stone':
          s = this.add.sprite(cx, base, 'ancient_stone').setOrigin(0.5, 74 / 80);
          break;
        case 'workbench':
          s = this.add.sprite(cx, base, 'workbench').setOrigin(0.5, 35 / 40);
          break;
      }
      s.setDepth(o.type === 'shell' ? -10 : base);
      this.objSprites.set(o.id, s);
      this.objByTile.set(idx(o.tx, o.ty), o);
    }

    this.cursor = this.add.image(0, 0, 'cursor').setOrigin(0, 0).setDepth(900000).setVisible(false);
  }

  private buildPlayer(): void {
    const p = this.st.player;
    const tk = makeCharacterTexture(this, 'player', p.appearance);
    this.px = p.x;
    this.py = p.y;
    this.facing = p.facing;
    this.player = this.add.sprite(this.px, this.py, tk, 0).setOrigin(0.5, 44 / 48);
  }

  private buildNpcs(): void {
    for (const id of Object.keys(NPCS)) this.npcs.push(new NpcEntity(this, id, this.island));
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(-4 * TILE, -4 * TILE, (MAP_W + 8) * TILE, (MAP_H + 8) * TILE);
    cam.startFollow(this.player, true, Settings.data.reducedMotion ? 1 : 0.12, Settings.data.reducedMotion ? 1 : 0.12);
    cam.setRoundPixels(true);
    this.setupZoom();
    cam.centerOn(this.px, this.py);
  }

  private setupZoom(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const base = Math.min(w, h) / 520;
    this.cameras.main.setZoom(Phaser.Math.Clamp(base * Settings.data.cameraZoom, 0.7, 4));
  }

  private onSettingsChanged(): void {
    this.setupZoom();
    const cam = this.cameras.main;
    cam.startFollow(this.player, true, Settings.data.reducedMotion ? 1 : 0.12, Settings.data.reducedMotion ? 1 : 0.12);
  }

  /* ------------------------------------------------------------ world state sync */
  private isDepleted(o: WorldObject): boolean {
    return (this.st.world.depleted[o.id] ?? 0) > this.st.time.day;
  }

  private refreshObject(o: WorldObject): void {
    const s = this.objSprites.get(o.id)!;
    const dep = this.isDepleted(o);
    const i = idx(o.tx, o.ty);
    switch (o.type) {
      case 'tree':
        s.setTexture(dep ? 'stump' : `tree_${o.v}`).setOrigin(0.5, dep ? 28 / 32 : 92 / 96);
        if (dep) this.openTiles.add(i);
        else this.openTiles.delete(i);
        if (dep) s.setAngle(0);
        break;
      case 'rock':
        s.setVisible(!dep);
        if (dep) this.openTiles.add(i);
        else this.openTiles.delete(i);
        break;
      case 'bush':
        s.setTexture(dep ? 'bush_empty' : 'bush_berry');
        break;
      case 'shell':
        s.setVisible(!dep);
        break;
      default:
        break;
    }
  }

  /** Called on load and each new day. */
  refreshWorldForDay(): void {
    for (const o of this.island.objects) this.refreshObject(o);
    this.farmDirty = true;
  }

  private snapNpcs(): void {
    const hour = this.st.time.minutes / 60;
    const rainy = this.st.weather.today === 'rain' || this.st.weather.today === 'storm';
    for (const n of this.npcs) n.snapTo(scheduledSpot(n.def, hour, rainy).spot);
  }

  private syncFarm(): void {
    const plots = this.st.farm.plots;
    for (const [k, v] of this.plotSprites) {
      if (!plots[k]) {
        v.soil.destroy();
        v.crop?.destroy();
        this.plotSprites.delete(k);
      }
    }
    for (const [k, p] of Object.entries(plots)) {
      if (!p.tilled) continue;
      const [tx, ty] = k.split(',').map(Number);
      let e = this.plotSprites.get(k);
      if (!e) {
        e = { soil: this.add.image(tx * TILE, ty * TILE, 'soil_dry').setOrigin(0, 0).setDepth(-15) };
        this.plotSprites.set(k, e);
      }
      e.soil.setTexture(p.watered ? 'soil_wet' : 'soil_dry');
      if (p.crop) {
        const stage = Math.min(4, Farm.cropStage(p));
        const frame = `${p.crop}_${stage}`;
        if (!e.crop) e.crop = this.add.image(tx * TILE + 16, ty * TILE + 30, 'crops', frame).setOrigin(0.5, 28 / 32).setDepth(ty * TILE + 30);
        else e.crop.setFrame(frame);
      } else if (e.crop) {
        e.crop.destroy();
        e.crop = undefined;
      }
    }
    this.farmDirty = false;
  }

  /* ------------------------------------------------------------ geometry helpers */
  private blockedTile(tx: number, ty: number): boolean {
    if (!inBounds(tx, ty)) return true;
    const i = idx(tx, ty);
    return this.island.blocked[i] === 1 && !this.openTiles.has(i);
  }

  private collides(x: number, y: number): boolean {
    const r = 7;
    return this.blockedTile(Math.floor((x - r) / TILE), Math.floor((y - 5) / TILE)) || this.blockedTile(Math.floor((x + r) / TILE), Math.floor((y - 5) / TILE)) || this.blockedTile(Math.floor((x - r) / TILE), Math.floor((y + 1) / TILE)) || this.blockedTile(Math.floor((x + r) / TILE), Math.floor((y + 1) / TILE));
  }

  private get playerTile(): { x: number; y: number } {
    return { x: Math.floor(this.px / TILE), y: Math.floor((this.py - 4) / TILE) };
  }

  private targetTile(): { tx: number; ty: number } {
    if (this.clickTarget) return this.clickTarget;
    const t = this.playerTile;
    const v = FACE_VEC[this.facing];
    return { tx: t.x + v.x, ty: t.y + v.y };
  }

  private npcAt(tx: number, ty: number): NpcEntity | undefined {
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    return this.npcs.find((n) => !n.hidden && Math.abs(n.x - cx) < 24 && Math.abs(n.y - 12 - cy) < 26);
  }

  findTarget(): Target {
    const { tx, ty } = this.targetTile();
    const npc = this.npcAt(tx, ty);
    if (npc) return { type: 'npc', npc };
    const b = this.island.buildings.find((bb) => bb.doorX === tx && bb.doorY === ty);
    if (b) return { type: 'door', b };
    const o = this.objByTile.get(idx(tx, ty));
    if (o && !(this.isDepleted(o) && (o.type === 'shell' || o.type === 'rock' || o.type === 'tree'))) return { type: 'object', o };
    if (inBounds(tx, ty) && this.island.terrain[idx(tx, ty)] === T.Water) return { type: 'water', tx, ty };
    if (Farm.getPlot(this.st, tx, ty)?.tilled) return { type: 'plot', tx, ty };
    return { type: 'tile', tx, ty };
  }

  /* ------------------------------------------------------------ update loop */
  update(time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.animateWorld(time, dt);
    for (const n of this.npcs) n.update(dt);

    if (this.farmDirty) this.syncFarm();

    for (const a of Controls.drain()) this.handleAction(a);

    if (this.mode === 'play' && !Controls.modal) {
      this.updateMovement(dt);
      this.updateClock(dt);
      this.updateFishing(dt);
      this.updateNpcSchedules();
      if (time - this.lastAutosave > AUTOSAVE_INTERVAL_MS) {
        this.lastAutosave = time;
        void Session.saveAuto();
      }
    } else {
      this.moving = false;
    }

    this.updatePlayerVisual(dt);
    this.updateCursorAndPrompt();
    this.updateMood();

    this.fpsT += dt;
    if (this.fpsT >= 1) {
      this.fpsT = 0;
      Quality.sampleFps(this.game.loop.actualFps);
    }
  }

  private animateWorld(time: number, dt: number): void {
    const flow = Settings.data.reducedMotion ? 0.3 : 1;
    this.water1.tilePositionX += 6 * dt * flow;
    this.water1.tilePositionY += 3 * dt * flow;
    if (this.water2) {
      this.water2.tilePositionX -= 10 * dt * flow;
      this.water2.tilePositionY += 5 * dt * flow;
    }
    if (this.campfire) this.campfire.setFrame(Math.floor(time / 130) % 3);
    if (Quality.profile.sway) {
      const wind = this.st.weather.today === 'storm' ? 3 : this.st.weather.today === 'rain' ? 1.6 : 1;
      const view = this.cameras.main.worldView;
      for (const sw of this.swayables) {
        if (sw.s.x < view.x - 64 || sw.s.x > view.right + 64 || sw.s.y < view.y - 100 || sw.s.y > view.bottom + 160) continue;
        const dep = this.isDepleted(sw.o);
        sw.s.setAngle(dep ? 0 : Math.sin(time / 900 + sw.phase) * 1.1 * wind);
      }
    } else {
      for (const sw of this.swayables) sw.s.setAngle(0);
    }
  }

  private updateMovement(dt: number): void {
    const v = Controls.moveVector();
    this.moving = false;
    if (v.x === 0 && v.y === 0) return;
    if (this.fishing) this.cancelFishing(true);
    const speed = 108;
    const nx = this.px + v.x * speed * dt;
    const ny = this.py + v.y * speed * dt;
    const ox = this.px;
    const oy = this.py;
    if (!this.collides(nx, this.py)) this.px = nx;
    if (!this.collides(this.px, ny)) this.py = ny;
    this.moving = this.px !== ox || this.py !== oy;
    if (Math.abs(v.x) > Math.abs(v.y)) this.facing = v.x > 0 ? 'right' : 'left';
    else this.facing = v.y > 0 ? 'down' : 'up';
    if (this.moving) {
      this.clickTarget = null;
      this.movedAccum += Math.hypot(this.px - ox, this.py - oy);
      if (this.movedAccum >= TILE) {
        const tiles = Math.floor(this.movedAccum / TILE);
        this.movedAccum -= tiles * TILE;
        this.st.stats['moved'] = (this.st.stats['moved'] ?? 0) + tiles;
      }
      Audio.step();
    }
    this.st.player.x = this.px;
    this.st.player.y = this.py;
    this.st.player.facing = this.facing;
  }

  private updatePlayerVisual(dt: number): void {
    this.animT += dt;
    let col = 0;
    if (this.swingT > 0) {
      this.swingT -= dt;
      col = this.swingT > 0.1 ? 4 : 5;
    } else if (this.moving) col = [1, 0, 3, 2][Math.floor(this.animT * 8) % 4];
    this.player.setFrame(DIR_ROW[this.facing] * 6 + col);
    this.player.setPosition(this.px, this.py);
    this.player.setDepth(this.py);
  }

  private updateClock(dt: number): void {
    const dm = dt * GAME_MIN_PER_SEC;
    const late = advanceTime(this.st, dm);
    tickNeeds(this.st, dm, Session.difficulty);
    this.st.meta.playTimeMs; // playtime accrues on save
    if (this.st.time.minutes >= 24 * 60 + 30 && !this.bedtimeWarned) {
      this.bedtimeWarned = true;
      bus.emit('toast', { key: 'toast.bedtime', tone: 'warn' });
    }
    if (this.st.player.hunger <= 0 && this.time.now - this.hungryAt > 60000) {
      this.hungryAt = this.time.now;
      bus.emit('toast', { key: 'toast.hungry', tone: 'warn' });
    }
    if (late) void this.sleep(true);
  }

  private updateNpcSchedules(): void {
    const hour = this.st.time.minutes / 60;
    const rainy = this.st.weather.today === 'rain' || this.st.weather.today === 'storm';
    for (const n of this.npcs) n.goTo(scheduledSpot(n.def, hour, rainy).spot);
    const day = this.st.time.day;
    for (const n of this.npcs) {
      const rel = this.st.npcs[n.id];
      n.mark.setVisible(!n.hidden && (!rel || rel.talkedDay !== day));
    }
  }

  private updateMood(): void {
    const hour = Math.floor(this.st.time.minutes / 60) % 24;
    const fest = !!festivalOn(this.st.time.day);
    const act = Controls.modal ? 'dialogue' : this.fishing ? 'fishing' : 'idle';
    const key = `${hour}|${this.st.weather.today}|${act}|${fest}`;
    if (key !== this.lastMoodKey) {
      this.lastMoodKey = key;
      Audio.setMood({ place: 'island', hour, weather: this.st.weather.today, activity: act, festival: fest });
    }
  }

  private updateCursorAndPrompt(): void {
    const show = this.mode === 'play' && !Controls.modal;
    const t = this.findTarget();
    let prompt: ContextPrompt | null = null;
    if (show) {
      const { tx, ty } = this.targetTile();
      const sel = selectedStack(this.st);
      const tool = sel ? getItem(sel.id).tool : undefined;
      this.cursor.setPosition(tx * TILE, ty * TILE).setVisible(true).setAlpha(0.65 + Math.sin(this.time.now / 160) * 0.2);
      prompt = this.promptFor(t, tool);
    } else this.cursor.setVisible(false);
    const key = prompt ? `${prompt.action}|${prompt.name ?? ''}` : '';
    if (key !== this.lastPrompt) {
      this.lastPrompt = key;
      this.ui?.setContext(prompt);
    }
  }

  private promptFor(t: Target, tool: string | undefined): ContextPrompt | null {
    if (this.fishing) return { action: 'action.fish' };
    switch (t.type) {
      case 'npc':
        return { action: 'action.talk', name: `npc.${t.npc.id}.name` };
      case 'door':
        return t.b.id === 'cabin' ? { action: 'action.sleep', name: 'obj.cabin' } : t.b.id === 'shop' ? { action: 'action.open', name: 'obj.shopDoor' } : { action: 'action.open' };
      case 'object': {
        const o = t.o;
        if (o.type === 'stone') return { action: 'action.examine', name: 'obj.stone' };
        if (o.type === 'workbench') return { action: 'action.craft', name: 'obj.workbench' };
        if (o.type === 'campfire') return { action: 'action.cook', name: 'obj.campfire' };
        if (o.type === 'bush' && !this.isDepleted(o)) return { action: 'action.gather', name: 'obj.bush' };
        if (o.type === 'shell') return { action: 'action.gather', name: 'obj.shell' };
        if (o.type === 'tree' && tool === 'axe' && !this.isDepleted(o)) return { action: 'action.use' };
        if (o.type === 'rock' && tool === 'pick') return { action: 'action.use' };
        return null;
      }
      case 'plot': {
        const p = Farm.getPlot(this.st, t.tx, t.ty);
        if (p && Farm.isHarvestable(p)) return { action: 'action.harvest' };
        return tool || selectedStack(this.st) ? { action: 'action.use' } : null;
      }
      case 'water':
        return tool === 'rod' ? { action: 'action.fish' } : null;
      case 'tile':
        return tool === 'hoe' && isTillable(this.island, t.tx, t.ty) ? { action: 'action.use' } : selectedStack(this.st) && getItem(selectedStack(this.st)!.id).plants && Farm.getPlot(this.st, t.tx, t.ty)?.tilled ? { action: 'action.use' } : null;
    }
  }

  /* ------------------------------------------------------------ input handling */
  private onPointer(p: Phaser.Input.Pointer): void {
    if (Controls.modal || this.mode !== 'play') return;
    if (Controls.overHud(p.x, p.y)) return;
    if (p.wasTouch && Controls.isTouchDevice()) return; // touch uses the on-screen buttons
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const tx = Math.floor(wp.x / TILE);
    const ty = Math.floor(wp.y / TILE);
    const pt = this.playerTile;
    const dx = tx - pt.x;
    const dy = ty - pt.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 2) return;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : dy < 0 ? 'up' : this.facing;
    this.clickTarget = { tx, ty };
    this.smartAct();
    this.clickTarget = null;
  }

  private handleAction(a: Action): void {
    if (this.mode !== 'play') return;
    // Panel open: only a few actions apply.
    if (Controls.modal) {
      if (a === 'inventory' || a === 'journal') this.ui.hasModal() && (a === 'inventory' ? this.ui.openInventory() : this.ui.openJournal());
      else if (a === 'interact') this.ui.modalConfirm();
      else if (a.startsWith('hotbar') && a.length === 7) this.ui.modalNumber(parseInt(a.slice(6), 10));
      return;
    }
    if (a === 'pause') {
      if (this.fishing) this.cancelFishing(true);
      this.ui.openPause();
      return;
    }
    switch (a) {
      case 'interact':
        this.smartAct();
        break;
      case 'use':
        if (this.fishing) this.reel();
        else this.useSelected();
        break;
      case 'inventory':
        this.ui.openInventory();
        break;
      case 'journal':
        this.ui.openJournal();
        break;
      case 'map':
        this.ui.openPause();
        break;
      case 'eat': {
        const sel = this.st.inventory.selected;
        if (eatSlot(this.st, sel)) {
          Audio.sfx('eat');
          this.st.stats['ate'] = (this.st.stats['ate'] ?? 0) + 1;
        } else bus.emit('toast', { key: 'toast.nothingToEat', tone: 'warn' });
        break;
      }
      case 'hotbarNext':
        this.selectSlot((this.st.inventory.selected + 1) % 8);
        break;
      case 'hotbarPrev':
        this.selectSlot((this.st.inventory.selected + 7) % 8);
        break;
      default:
        if (a.startsWith('hotbar')) this.selectSlot(parseInt(a.slice(6), 10) - 1);
    }
  }

  selectSlot(i: number): void {
    if (i < 0 || i > 7) return;
    this.st.inventory.selected = i;
    Audio.sfx('ui');
    bus.emit('inventory:changed');
  }

  /** Context-sensitive: interact with what is in front, else use the selected item. Also drives the touch "A" button. */
  smartAct(): void {
    if (this.fishing) {
      this.reel();
      return;
    }
    const t = this.findTarget();
    if (t.type === 'npc') return this.talkTo(t.npc);
    if (t.type === 'door') return this.useDoor(t.b);
    if (t.type === 'object') {
      const o = t.o;
      if (o.type === 'stone') return this.touchStone();
      if (o.type === 'workbench') return this.ui.openCraft('workbench');
      if (o.type === 'campfire') return this.ui.openCraft('campfire');
      if (o.type === 'bush' && !this.isDepleted(o)) return this.gatherBush(o);
      if (o.type === 'shell' && !this.isDepleted(o)) return this.gatherShell(o);
    }
    if (t.type === 'plot') {
      const p = Farm.getPlot(this.st, t.tx, t.ty);
      if (p && Farm.isHarvestable(p)) return this.harvestPlot(t.tx, t.ty);
    }
    this.useSelected();
  }

  /* ------------------------------------------------------------ actions */
  private swing(): void {
    this.swingT = 0.22;
  }

  private tired(): void {
    bus.emit('toast', { key: 'toast.tooTired', tone: 'warn' });
    Audio.sfx('error');
  }

  private pay(base: number, skill: 'farming' | 'foraging' | 'mining' | 'fishing'): boolean {
    const ok = spendEnergy(this.st, base, energyDiscount(this.st.player.skills[skill].level), Session.difficulty);
    if (!ok) this.tired();
    return ok;
  }

  private gain(id: string, qty: number, q = 0): boolean {
    if (!canFit(this.st, id, qty, q)) {
      bus.emit('toast', { key: 'toast.noSpace', tone: 'warn' });
      Audio.sfx('error');
      return false;
    }
    addItem(this.st, id, qty, q);
    bus.emit('toast', { key: 'toast.got', params: { qty, item: `item.${id}.name` }, tone: 'info' });
    return true;
  }

  useSelected(): void {
    const sel = selectedStack(this.st);
    if (!sel) {
      bus.emit('toast', { key: 'toast.nothingHere' });
      return;
    }
    const def = getItem(sel.id);
    const t = this.findTarget();
    const { tx, ty } = this.targetTile();

    if (def.tool === 'hoe') {
      if (t.type === 'plot' || t.type === 'tile') {
        const r = Farm.till(this.st, tx, ty, isTillable(this.island, tx, ty));
        if (!r.ok) return this.farmFail(r.reason);
        if (!this.pay(2, 'farming')) return this.revertTill(tx, ty);
        this.swing();
        Audio.sfx('dig');
        bumpStat(this.st, 'tilled');
        addXp(this.st, 'farming', 1);
      } else bus.emit('toast', { key: 'toast.notTillable', tone: 'warn' });
      return;
    }
    if (def.tool === 'can') {
      if (t.type !== 'plot') return void bus.emit('toast', { key: 'toast.notTilled', tone: 'warn' });
      const r = Farm.water(this.st, tx, ty);
      if (!r.ok) return this.farmFail(r.reason);
      if (!this.pay(1, 'farming')) {
        const p = Farm.getPlot(this.st, tx, ty);
        if (p) p.watered = false;
        return;
      }
      this.swing();
      Audio.sfx('water');
      bumpStat(this.st, 'watered');
      return;
    }
    if (def.tool === 'axe') {
      if (t.type === 'object' && t.o.type === 'tree' && !this.isDepleted(t.o)) return this.hitTree(t.o);
      return void bus.emit('toast', { key: 'toast.nothingHere' });
    }
    if (def.tool === 'pick') {
      if (t.type === 'object' && t.o.type === 'rock' && !this.isDepleted(t.o)) return this.hitRock(t.o);
      return void bus.emit('toast', { key: 'toast.nothingHere' });
    }
    if (def.tool === 'rod') return this.castRod();
    if (def.plants) {
      if (t.type !== 'plot' && t.type !== 'tile') return void bus.emit('toast', { key: 'toast.notTilled', tone: 'warn' });
      const r = Farm.plant(this.st, tx, ty, sel.id);
      if (!r.ok) return this.farmFail(r.reason);
      if (!this.pay(1, 'farming')) return void Farm.removeCrop(this.st, tx, ty), void (this.st.stats['planted'] -= 1);
      this.swing();
      this.st.inventory.slots[this.st.inventory.selected]!.qty -= 1;
      if (this.st.inventory.slots[this.st.inventory.selected]!.qty <= 0) this.st.inventory.slots[this.st.inventory.selected] = null;
      Audio.sfx('plant');
      bumpStat(this.st, 'planted', 0);
      bus.emit('inventory:changed');
      addXp(this.st, 'farming', 1);
      return;
    }
    if (sel.id === 'fertilizer') {
      if (t.type !== 'plot') return void bus.emit('toast', { key: 'toast.notTilled', tone: 'warn' });
      const r = Farm.fertilize(this.st, tx, ty);
      if (!r.ok) return this.farmFail(r.reason);
      this.st.inventory.slots[this.st.inventory.selected]!.qty -= 1;
      if (this.st.inventory.slots[this.st.inventory.selected]!.qty <= 0) this.st.inventory.slots[this.st.inventory.selected] = null;
      Audio.sfx('plant');
      bus.emit('inventory:changed');
      bus.emit('toast', { key: 'toast.fertilized', tone: 'good' });
      return;
    }
    if (def.energy !== undefined || def.hunger !== undefined || def.health !== undefined) {
      if (eatSlot(this.st, this.st.inventory.selected)) Audio.sfx('eat');
      return;
    }
    bus.emit('toast', { key: 'toast.nothingHere' });
  }

  private revertTill(tx: number, ty: number): void {
    delete this.st.farm.plots[Farm.plotKey(tx, ty)];
    this.farmDirty = true;
    bus.emit('farm:changed');
  }

  private farmFail(reason: string): void {
    const map: Record<string, string> = {
      notTillable: 'toast.notTillable',
      alreadyTilled: 'toast.alreadyTilled',
      notTilled: 'toast.notTilled',
      occupied: 'toast.occupied',
      wrongSeason: 'toast.wrongSeason',
      notReady: 'toast.notReady',
      alreadyWatered: 'toast.alreadyWatered',
      alreadyFertilized: 'toast.alreadyFertilized',
      unknownSeed: 'toast.nothingHere'
    };
    bus.emit('toast', { key: map[reason] ?? 'toast.nothingHere', tone: 'warn' });
    Audio.sfx('error');
  }

  private harvestPlot(tx: number, ty: number): void {
    const probe = Farm.getPlot(this.st, tx, ty);
    if (!probe?.crop) return;
    const crop = CROPS[probe.crop];
    if (!canFit(this.st, crop.harvest, 1)) return void bus.emit('toast', { key: 'toast.noSpace', tone: 'warn' });
    const r = Farm.harvest(this.st, tx, ty);
    if (!r.ok) return this.farmFail(r.reason);
    this.swing();
    addItem(this.st, r.result.item, r.result.qty, r.result.quality);
    Audio.sfx('harvest');
    addXp(this.st, 'farming', 6 + r.result.qty * 2);
    bus.emit('toast', { key: 'toast.got', params: { qty: r.result.qty, item: `item.${r.result.item}.name` }, tone: 'good' });
    this.st.stats[`harvested:${r.result.item}`] = (this.st.stats[`harvested:${r.result.item}`] ?? 0) + r.result.qty;
    bumpStat(this.st, 'harvested', 0);
    this.spawnBurst(tx * TILE + 16, ty * TILE + 12, 0xffe27a);
  }

  private hitTree(o: WorldObject): void {
    if (!this.pay(3, 'foraging')) return;
    this.swing();
    Audio.sfx('chop');
    const hp = (this.st.world.damage[o.id] ?? 0) + 1;
    this.st.world.damage[o.id] = hp;
    const s = this.objSprites.get(o.id)!;
    this.tweens.add({ targets: s, angle: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 1 });
    this.spawnBurst(o.tx * TILE + 16, o.ty * TILE - 20, 0x7fc15a, 4, 'leaf');
    const needed = Math.max(2, 4 - Math.floor(this.st.player.skills.foraging.level / 4));
    if (hp >= needed) {
      delete this.st.world.damage[o.id];
      this.st.world.depleted[o.id] = this.st.time.day + 6;
      this.refreshObject(o);
      const qty = 3 + (Math.random() < 0.4 ? 1 : 0);
      if (this.gain('wood', qty)) bumpStat(this.st, 'gathered:wood', 0);
      addXp(this.st, 'foraging', 5);
      bus.emit('toast', { key: 'toast.treeDown', tone: 'info' });
      checkQuests(this.st);
    }
  }

  private hitRock(o: WorldObject): void {
    if (!this.pay(3, 'mining')) return;
    this.swing();
    Audio.sfx('mine');
    const hp = (this.st.world.damage[o.id] ?? 0) + 1;
    this.st.world.damage[o.id] = hp;
    this.spawnBurst(o.tx * TILE + 16, o.ty * TILE + 8, 0xc4c4cc, 4);
    if (hp >= 3) {
      delete this.st.world.damage[o.id];
      this.st.world.depleted[o.id] = this.st.time.day + 5;
      this.refreshObject(o);
      const lvl = this.st.player.skills.mining.level;
      this.gain('stone', 1 + Math.floor(Math.random() * 2));
      if (Math.random() < 0.18 + lvl * 0.02) this.gain('copper_ore', 1);
      if (lvl >= 2 && Math.random() < 0.04 + lvl * 0.005) this.gain('crystal_shard', 1);
      addXp(this.st, 'mining', 6);
      checkQuests(this.st);
    }
  }

  private gatherBush(o: WorldObject): void {
    this.swing();
    this.st.world.depleted[o.id] = this.st.time.day + 3;
    this.refreshObject(o);
    Audio.sfx('pickup');
    this.gain('wild_berry', 2 + (Math.random() < 0.3 ? 1 : 0));
    if (Math.random() < 0.4) this.gain('fiber', 1);
    addXp(this.st, 'foraging', 3);
    checkQuests(this.st);
  }

  private gatherShell(o: WorldObject): void {
    if (!canFit(this.st, 'seashell', 1)) return void bus.emit('toast', { key: 'toast.noSpace', tone: 'warn' });
    this.st.world.depleted[o.id] = this.st.time.day + 2;
    this.refreshObject(o);
    Audio.sfx('pickup');
    this.gain('seashell', 1);
    addXp(this.st, 'foraging', 2);
    checkQuests(this.st);
  }

  private touchStone(): void {
    if (discover(this.st, 'lore.ancient_stone')) {
      Audio.sfx('discover');
      this.spawnBurst(this.px, this.py - 30, 0x78e6dc, 14);
      checkQuests(this.st);
    } else bus.emit('toast', { key: 'toast.stoneAgain' });
  }

  private useDoor(b: Building): void {
    if (b.id === 'cabin') {
      if (this.st.time.minutes < 17 * 60) return void bus.emit('toast', { key: 'toast.cantSleepYet' });
      this.ui.openConfirm('sleep.prompt', 'sleep.yes', 'sleep.no', () => void this.sleep(false));
      return;
    }
    if (b.id === 'shop') return void bus.emit('toast', { key: 'shop.closed' });
    bus.emit('toast', { key: 'toast.locked' });
  }

  private talkTo(n: NpcEntity): void {
    const conv = pickConversation(this.st, n.id);
    this.ui.openDialogue(n.id, conv.node);
  }

  /* ------------------------------------------------------------ fishing */
  private castRod(): void {
    const t = this.playerTile;
    const v = FACE_VEC[this.facing];
    let wx = -1;
    let wy = -1;
    for (let i = 1; i <= 3; i++) {
      const x = t.x + v.x * i;
      const y = t.y + v.y * i;
      if (!inBounds(x, y)) break;
      if (this.island.terrain[idx(x, y)] === T.Water) {
        wx = x;
        wy = y;
        break;
      }
      if (this.blockedTile(x, y)) break;
    }
    if (wx < 0) return void bus.emit('toast', { key: 'toast.fishNeedWater', tone: 'warn' });
    if (!this.pay(3, 'fishing')) return;
    this.swing();
    Audio.sfx('cast');
    const d = dateFromDay(this.st.time.day);
    const rng = new Rng((Date.now() ^ (this.st.time.minutes * 7919)) >>> 0);
    const lvl = this.st.player.skills.fishing.level;
    const fish = rollFish(rng, { season: d.season, weather: this.st.weather.today, hour: Math.floor(this.st.time.minutes / 60) % 24, level: lvl });
    const bobber = this.add.image(wx * TILE + 16, wy * TILE + 16, 'dot').setScale(1.6).setTint(0xd9473f).setDepth(wy * TILE + 40);
    this.tweens.add({ targets: bobber, y: bobber.y + 3, duration: 600, yoyo: true, repeat: -1 });
    this.fishing = { phase: 'wait', timer: 1.4 + rng.next() * Math.max(1.2, 3.4 - lvl * 0.15), fish, window: 0.9 + lvl * 0.06, bobber, tx: wx, ty: wy };
    bus.emit('toast', { key: 'fishing.waiting' });
  }

  private updateFishing(dt: number): void {
    const f = this.fishing;
    if (!f) return;
    f.timer -= dt;
    if (f.timer > 0) return;
    if (f.phase === 'wait') {
      if (!f.fish) {
        bus.emit('toast', { key: 'toast.fishNone' });
        return this.cancelFishing(false);
      }
      f.phase = 'bite';
      f.timer = f.window;
      Audio.sfx('bite');
      this.spawnBurst(f.bobber.x, f.bobber.y, 0xffffff, 6);
      this.exclaim = this.add.image(this.px, this.py - 52, 'exclaim').setDepth(this.py + 2000);
      bus.emit('toast', { key: 'fishing.bite', tone: 'good' });
    } else {
      bus.emit('toast', { key: 'toast.fishEscaped', tone: 'warn' });
      this.cancelFishing(false);
    }
  }
  private exclaim?: Phaser.GameObjects.Image;

  private reel(): void {
    const f = this.fishing;
    if (!f) return;
    if (f.phase === 'bite' && f.fish) {
      const rng = new Rng((Date.now() >>> 0) ^ 0x5bd1e995);
      const q = fishQuality(rng, this.st.player.skills.fishing.level);
      const id = f.fish;
      if (!canFit(this.st, id, 1, q)) {
        bus.emit('toast', { key: 'toast.noSpace', tone: 'warn' });
      } else {
        addItem(this.st, id, 1, q);
        Audio.sfx('splash');
        this.st.stats['fished'] = (this.st.stats['fished'] ?? 0) + 1;
        this.st.stats[`caught:${id}`] = (this.st.stats[`caught:${id}`] ?? 0) + 1;
        addXp(this.st, 'fishing', id === 'glow_eel' ? 20 : id === 'silver_bass' ? 10 : 5);
        bus.emit('toast', { key: 'toast.fishCaught', params: { fish: `item.${id}.name` }, tone: 'good' });
        this.spawnBurst(f.bobber.x, f.bobber.y, 0x9ad8ff, 10);
        checkQuests(this.st);
      }
    }
    this.cancelFishing(false);
  }

  private cancelFishing(silent: boolean): void {
    if (!this.fishing) return;
    this.tweens.killTweensOf(this.fishing.bobber);
    this.fishing.bobber.destroy();
    this.exclaim?.destroy();
    this.exclaim = undefined;
    this.fishing = null;
    void silent;
  }

  /* ------------------------------------------------------------ sleeping / new day */
  async sleep(passedOut: boolean): Promise<void> {
    if (this.mode === 'sleeping') return;
    this.mode = 'sleeping';
    this.cancelFishing(true);
    Controls.pushModal();
    Audio.sfx('sleep');
    this.ui.fade(1, 900);
    if (passedOut) bus.emit('toast', { key: 'toast.passedOut', tone: 'warn' });
    await new Promise((r) => this.time.delayedCall(1100, r));

    const prevSeason = dateFromDay(this.st.time.day).seasonIndex;
    const info = startNewDay(this.st, Session.difficulty, passedOut);
    this.st.weather.tomorrow = weatherForDay(this.st.meta.seed, this.st.time.day + 1);
    // wake at the cabin door
    const cabin = this.island.buildings.find((b) => b.id === 'cabin')!;
    this.px = cabin.doorX * TILE + TILE / 2;
    this.py = (cabin.doorY + 2) * TILE - 2;
    this.facing = 'down';
    this.st.player.x = this.px;
    this.st.player.y = this.py;
    this.bedtimeWarned = false;
    this.refreshWorldForDay();
    this.snapNpcs();
    this.cameras.main.centerOn(this.px, this.py);

    await Session.saveOnSleep();
    this.lastAutosave = this.time.now;

    const d = dateFromDay(this.st.time.day);
    this.ui.fade(0, 900);
    await new Promise((r) => this.time.delayedCall(700, r));
    bus.emit('toast', { key: 'toast.newDay', params: { day: d.dayOfSeason, season: `season.${d.season}` }, tone: 'info' });
    const fest = festivalOn(this.st.time.day);
    if (fest) bus.emit('toast', { key: 'toast.festival', params: { festival: `festival.${fest.id}` }, tone: 'good' });
    if (info.withered > 0 && d.seasonIndex !== prevSeason) bus.emit('toast', { key: 'toast.cropsWithered', params: { n: info.withered }, tone: 'warn' });
    if (this.st.weather.today === 'rain' || this.st.weather.today === 'storm') bus.emit('toast', { key: 'toast.rainWatered', tone: 'info' });
    this.mode = 'play';
    Controls.popModal();
    void DAYS_PER_SEASON;
    void DAY_END_MIN;
  }

  /* ------------------------------------------------------------ fx helpers */
  private spawnBurst(x: number, y: number, tint: number, n = 8, tex = 'dot'): void {
    if (Settings.data.reducedMotion) n = Math.min(n, 3);
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, tex).setTint(tint).setDepth(950000).setScale(0.8 + Math.random() * 0.8);
      const a = Math.random() * Math.PI * 2;
      const d = 10 + Math.random() * 20;
      this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 8, alpha: 0, duration: 450 + Math.random() * 250, onComplete: () => s.destroy() });
    }
  }

  /** Called by UIScene when the player picks Quit to Title or loads a different game. */
  stopPlaying(): void {
    Session.end();
    this.cleanup();
  }
}
