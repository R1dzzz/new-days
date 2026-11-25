import Phaser from 'phaser';
import { Audio } from '../audio/AudioManager';
import { Settings } from '../core/Settings';
import { Quality } from '../core/Quality';
import { Controls } from '../input/Controls';
import { makeCharacterTexture } from '../art/TextureFactory';
import { DEFAULT_APPEARANCE } from '../core/GameState';

/** Living title backdrop: sky matches the real clock, drifting clouds, birds, a bobbing boat, a pulsing lighthouse. */
export class MenuScene extends Phaser.Scene {
  private sea1!: Phaser.GameObjects.TileSprite;
  private sea2!: Phaser.GameObjects.TileSprite;
  private clouds: Phaser.GameObjects.Image[] = [];
  private birds: Phaser.GameObjects.Image[] = [];
  private boat!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  private night = false;
  private traveller!: Phaser.GameObjects.Sprite;
  private layout: Array<() => void> = [];

  constructor() {
    super('Menu');
  }

  create(): void {
    Controls.resetModals();
    this.layout = [];
    this.clouds = [];
    this.birds = [];
    const hour = new Date().getHours();
    this.night = hour >= 20 || hour < 5;
    const dusk = (hour >= 17 && hour < 20) || (hour >= 5 && hour < 7);
    const skyKey = this.night ? 'sky_night' : dusk ? 'sky_dusk' : 'sky_day';
    const weather = Math.random() < 0.25 ? 'rain' : 'clear';
    const w = () => this.scale.width;
    const h = () => this.scale.height;

    const sky = this.add.image(0, 0, skyKey).setOrigin(0).setDepth(0);
    this.layout.push(() => sky.setDisplaySize(w(), h() * 0.72));

    if (this.night) {
      for (let i = 0; i < 70; i++) {
        const star = this.add.image(Math.random() * 2400, Math.random() * 500, 'dot').setScale(0.3 + Math.random() * 0.4).setAlpha(0.4 + Math.random() * 0.6).setDepth(1);
        if (!Settings.data.reducedMotion) this.tweens.add({ targets: star, alpha: 0.2, duration: 900 + Math.random() * 1800, yoyo: true, repeat: -1 });
      }
      this.add.circle(0, 0, 34, 0xf6f1da).setDepth(1).setName('moon');
    } else this.add.circle(0, 0, 40, dusk ? 0xffc27a : 0xfff0b0).setDepth(1).setName('sun');

    for (let i = 0; i < 6; i++) {
      const c = this.add.image(Math.random() * 1600, 40 + Math.random() * 200, `cloud_${i % 3}`).setAlpha(this.night ? 0.35 : 0.9).setScale(0.8 + Math.random() * 0.9).setDepth(2);
      this.clouds.push(c);
    }

    const far = this.add.image(0, 0, 'isle_far').setOrigin(0.5, 1).setDepth(3).setAlpha(this.night ? 0.7 : 1);
    const near = this.add.image(0, 0, 'isle_near').setOrigin(0.5, 1).setDepth(5);
    if (this.night) near.setTint(0x6a7aa8);
    this.sea1 = this.add.tileSprite(0, 0, 10, 10, 'water_base').setOrigin(0, 0).setDepth(4);
    this.sea2 = this.add.tileSprite(0, 0, 10, 10, 'water_hi').setOrigin(0, 0).setDepth(6).setAlpha(0.7);
    if (this.night) this.sea1.setTint(0x6a7aa8);
    this.boat = this.add.image(0, 0, 'boat').setOrigin(0.5, 0.9).setDepth(7);
    this.glow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(8).setVisible(this.night || dusk).setAlpha(0.85);

    // a traveller standing on a dune, looking out to sea
    makeCharacterTexture(this, 'menu', DEFAULT_APPEARANCE);
    this.traveller = this.add.sprite(0, 0, 'char_menu', 2 * 6).setDepth(9);

    const frame = Quality.profile.sway ? 2 : 1;
    for (let i = 0; i < 4 * frame; i++) this.birds.push(this.add.image(Math.random() * 1200, 90 + Math.random() * 140, 'birds', 0).setDepth(3).setVisible(!this.night));

    if (weather === 'rain' && !Settings.data.reducedMotion) {
      this.rain = this.add.particles(0, 0, 'rain', { x: { min: 0, max: 2400 }, y: -20, lifespan: 1000, speedY: 700, speedX: -80, frequency: 14, quantity: 2, alpha: 0.5, rotate: 8 }).setDepth(20);
    }

    const place = () => {
      const W = w();
      const H = h();
      const horizon = H * 0.62;
      this.cameras.main.setBackgroundColor(this.night ? '#0e1330' : '#7cc4e8');
      const sun = this.children.getByName('sun') as Phaser.GameObjects.Arc | null;
      const moon = this.children.getByName('moon') as Phaser.GameObjects.Arc | null;
      (sun ?? moon)?.setPosition(W * 0.1, H * 0.2);
      far.setPosition(W * 0.28, horizon + 6).setScale(Math.max(0.6, W / 1100));
      const ns = Math.max(0.8, W / 1000);
      near.setPosition(W * 0.76, horizon + 38 * ns).setScale(ns);
      this.glow.setPosition(near.x - near.displayWidth * 0.2, near.y - near.displayHeight * 0.62).setScale(ns * 1.2);
      this.sea1.setPosition(0, horizon).setSize(W, H - horizon);
      this.sea2.setPosition(0, horizon).setSize(W, H - horizon);
      this.boat.setPosition(W * 0.42, horizon + 50).setScale(Math.max(0.8, W / 1100));
      this.traveller.setPosition(W * 0.14, H * 0.84).setScale(Math.max(2, H / 260)).setOrigin(0.5, 44 / 48);
      const sand = this.children.getByName('dune') as Phaser.GameObjects.Ellipse | null;
      sand?.setPosition(W * 0.14, H * 0.845).setSize(W * 0.34, H * 0.1);
    };
    this.add.ellipse(0, 0, 10, 10, 0xe6cf9a).setDepth(8).setName('dune').setStrokeStyle(3, 0xcdb27a);
    place();
    this.scale.on('resize', place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', place));
    this.layout.forEach((f) => f());
    this.scale.on('resize', () => this.layout.forEach((f) => f()));

    Audio.setMood({ place: 'menu', hour, weather: weather === 'rain' ? 'rain' : 'sunny' });
    this.scene.launch('MenuUI');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop('MenuUI'));
  }

  update(time: number, dms: number): void {
    const dt = dms / 1000;
    const calm = Settings.data.reducedMotion ? 0.25 : 1;
    this.sea1.tilePositionX += 10 * dt * calm;
    this.sea2.tilePositionX -= 16 * dt * calm;
    this.sea2.tilePositionY += 4 * dt * calm;
    const W = this.scale.width;
    for (const [i, c] of this.clouds.entries()) {
      c.x += (6 + i * 2) * dt * calm;
      if (c.x > W + 220) c.x = -220;
    }
    for (const [i, b] of this.birds.entries()) {
      b.x += (46 + i * 7) * dt * calm;
      b.y += Math.sin(time / 600 + i) * 0.2;
      b.setFrame(Math.floor(time / (200 + i * 15)) % 2);
      if (b.x > W + 40) {
        b.x = -40;
        b.y = 70 + Math.random() * 150;
      }
    }
    this.boat.y += Math.sin(time / 700) * 0.12 * calm;
    this.boat.setAngle(Math.sin(time / 900) * 1.4 * calm);
    if (this.glow.visible) this.glow.setAlpha(0.6 + Math.sin(time / 400) * 0.25);
  }
}
