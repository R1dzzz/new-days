import Phaser from 'phaser';
import { Session } from '../core/Session';
import { Settings } from '../core/Settings';
import { Quality } from '../core/Quality';
import { daylight } from '../core/Calendar';
import { Audio } from '../audio/AudioManager';
import type { GameScene } from './GameScene';

/**
 * Screen-space overlay between the world and the UI: day/night grading, light glows, weather particles, fog, lightning.
 * It only READS game state; nothing here affects simulation.
 */
export class FXScene extends Phaser.Scene {
  private game_!: GameScene;
  private tint!: Phaser.GameObjects.Rectangle;
  private flash!: Phaser.GameObjects.Rectangle;
  private fog!: Phaser.GameObjects.Rectangle;
  private fogClouds: Phaser.GameObjects.Image[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow?: Phaser.GameObjects.Particles.ParticleEmitter;
  private leaves?: Phaser.GameObjects.Particles.ParticleEmitter;
  private currentWeather = '';
  private nextBolt = 0;
  private onQuality = () => this.rebuildWeather();

  constructor() {
    super('FX');
  }

  init(data: { game: GameScene }): void {
    this.game_ = data.game;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.tint = this.add.rectangle(0, 0, w, h, 0x101a44, 0).setOrigin(0).setDepth(1);
    this.fog = this.add.rectangle(0, 0, w, h, 0xdfe8ea, 0).setOrigin(0).setDepth(2);
    this.flash = this.add.rectangle(0, 0, w, h, 0xffffff, 0).setOrigin(0).setDepth(50);
    for (let i = 0; i < 4; i++) {
      this.fogClouds.push(this.add.image(Math.random() * w, h * (0.2 + i * 0.2), `cloud_${i % 3}`).setAlpha(0).setScale(5).setDepth(3));
    }
    this.scale.on('resize', this.onResize, this);
    window.addEventListener('quality-changed', this.onQuality);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      window.removeEventListener('quality-changed', this.onQuality);
    });
    this.rebuildWeather();
  }

  private onResize(): void {
    const { width: w, height: h } = this.scale;
    for (const r of [this.tint, this.fog, this.flash]) r.setSize(w, h);
    this.rebuildWeather();
  }

  private rebuildWeather(): void {
    this.rain?.destroy();
    this.snow?.destroy();
    this.leaves?.destroy();
    this.rain = this.snow = this.leaves = undefined;
    const { width: w } = this.scale;
    const q = Quality.profile.weather;
    this.rain = this.add.particles(0, 0, 'rain', {
      x: { min: -100, max: w + 100 },
      y: -30,
      lifespan: 900,
      speedY: { min: 650, max: 850 },
      speedX: -90,
      angle: 0,
      rotate: 8,
      scale: { min: 0.8, max: 1.3 },
      alpha: { min: 0.35, max: 0.7 },
      frequency: 18,
      quantity: 2,
      emitting: false
    }).setDepth(10);
    this.rain.frequency = Math.max(6, 22 / Math.max(0.2, q));
    this.snow = this.add.particles(0, 0, 'dot', {
      x: { min: -50, max: w + 50 },
      y: -20,
      lifespan: 6000,
      speedY: { min: 40, max: 90 },
      speedX: { min: -25, max: 25 },
      scale: { min: 0.5, max: 1.1 },
      alpha: { min: 0.6, max: 0.95 },
      frequency: 40,
      quantity: 1,
      emitting: false
    }).setDepth(10);
    this.snow.frequency = Math.max(20, 60 / Math.max(0.2, q));
    this.leaves = this.add.particles(0, 0, 'leaf', {
      x: -20,
      y: { min: 0, max: this.scale.height },
      lifespan: 7000,
      speedX: { min: 60, max: 130 },
      speedY: { min: -10, max: 40 },
      rotate: { min: 0, max: 360 },
      alpha: 0.9,
      frequency: 1800,
      emitting: false
    }).setDepth(9);
    this.currentWeather = '';
  }

  update(time: number, dms: number): void {
    const g = this.game_;
    if (!g || !Session.active) return;
    const st = Session.state;
    const w = this.scale.width;
    const h = this.scale.height;
    const dt = dms / 1000;
    const day = daylight(st.time.minutes);
    const weather = st.weather.today;

    // weather particle switches
    if (weather !== this.currentWeather) {
      this.currentWeather = weather;
      const wet = weather === 'rain' || weather === 'storm';
      if (wet) this.rain?.start();
      else this.rain?.stop();
      if (weather === 'snow') this.snow?.start();
      else this.snow?.stop();
      const windy = Quality.profile.ambientLeaves && (weather === 'sunny' || weather === 'cloudy');
      if (windy) this.leaves?.start();
      else this.leaves?.stop();
    }

    // day / night colour grade
    const dusk = st.time.minutes / 60 >= 17 && st.time.minutes / 60 < 20.5;
    const dawn = st.time.minutes / 60 >= 5 && st.time.minutes / 60 < 8;
    let col = 0x101a44;
    if (dusk) col = 0x3a2552;
    if (dawn) col = 0x5a3b52;
    const night = 1 - day;
    const gray = weather === 'rain' || weather === 'storm' ? 0.14 : weather === 'cloudy' ? 0.07 : 0;
    this.tint.setFillStyle(col, Math.min(0.72, night * 0.68 + gray));

    // fog
    const fogA = weather === 'fog' ? 0.38 : 0;
    this.fog.setAlpha(Phaser.Math.Linear(this.fog.alpha, fogA, 0.02));
    this.fogClouds.forEach((c, i) => {
      const target = weather === 'fog' ? 0.22 : 0;
      c.setAlpha(Phaser.Math.Linear(c.alpha, target, 0.02));
      if (target > 0 || c.alpha > 0.01) {
        c.x += (6 + i * 3) * dt * (Settings.data.reducedMotion ? 0.2 : 1);
        if (c.x > w + 300) c.x = -300;
      }
    });

    // lightning
    if (weather === 'storm' && time > this.nextBolt) {
      this.nextBolt = time + 5000 + Math.random() * 11000;
      if (!Settings.data.reducedMotion) {
        this.flash.setAlpha(0.7);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 380, ease: 'Cubic.easeOut' });
      }
      this.time.delayedCall(600 + Math.random() * 900, () => {
        Audio.sfx('thunder');
        if (Settings.data.screenShake && !Settings.data.reducedMotion) g.cameras.main.shake(300, 0.0025);
      });
    }

    // glows for fire / windows / lighthouse lamp, only when it is dim enough
    const cam = g.cameras.main;
    const wantGlow = Quality.profile.glows && night > 0.25;
    const lights = wantGlow ? g.lightSources : [];
    while (this.glows.length < lights.length) this.glows.push(this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(5));
    this.glows.forEach((img, i) => {
      const L = lights[i];
      if (!L) return img.setVisible(false);
      const sx = (L.x - cam.worldView.x) * cam.zoom;
      const sy = (L.y - cam.worldView.y) * cam.zoom;
      const visible = sx > -300 && sx < w + 300 && sy > -300 && sy < h + 300;
      const flicker = L.kind === 'fire' && !Settings.data.reducedMotion ? 0.85 + Math.sin(time / 90 + i) * 0.1 + Math.random() * 0.05 : 1;
      img
        .setVisible(visible)
        .setPosition(sx, sy)
        .setScale(((L.r * 2) / 128) * cam.zoom * flicker)
        .setAlpha(Math.min(0.9, night * (L.kind === 'window' ? 0.65 : 1)));
    });
  }
}
