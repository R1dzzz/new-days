import { Settings } from './Settings';
import { Log } from './Logger';

export type Level = 'low' | 'medium' | 'high';

export interface QualityProfile {
  /** Particle multiplier for weather. */
  weather: number;
  /** Draw additive light glows & night lighting detail. */
  glows: boolean;
  /** Sway trees/bushes in the wind. */
  sway: boolean;
  /** Animate the second water layer. */
  waterLayers: number;
  ambientLeaves: boolean;
}

const PROFILES: Record<Level, QualityProfile> = {
  low: { weather: 0.35, glows: false, sway: false, waterLayers: 1, ambientLeaves: false },
  medium: { weather: 0.7, glows: true, sway: true, waterLayers: 2, ambientLeaves: false },
  high: { weather: 1, glows: true, sway: true, waterLayers: 2, ambientLeaves: true }
};

const ORDER: Level[] = ['low', 'medium', 'high'];

/**
 * "Auto" starts at a guess from the device, then steps DOWN if the frame rate stays poor.
 * It never steps back up on its own within a session, to avoid flip-flopping.
 */
class QualityImpl {
  private autoLevel: Level = 'high';
  private slowFor = 0;
  private samples = 0;

  init(): void {
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    this.autoLevel = mem <= 2 || cores <= 2 ? 'low' : mobile || mem <= 4 ? 'medium' : 'high';
    Log.info('quality', `Auto starts at "${this.autoLevel}" (mem=${mem}, cores=${cores}, mobile=${mobile})`);
  }

  get level(): Level {
    const q = Settings.data.quality;
    return q === 'auto' ? this.autoLevel : q;
  }

  get profile(): QualityProfile {
    const p = { ...PROFILES[this.level] };
    if (Settings.data.reducedMotion) {
      p.sway = false;
      p.ambientLeaves = false;
      p.weather = Math.min(p.weather, 0.5);
    }
    return p;
  }

  /** Feed the actual FPS once per second. */
  sampleFps(fps: number): void {
    if (Settings.data.quality !== 'auto') return;
    if (fps < 40) this.slowFor++;
    else this.slowFor = Math.max(0, this.slowFor - 1);
    this.samples++;
    if (this.slowFor >= 4) {
      this.slowFor = 0;
      const i = ORDER.indexOf(this.autoLevel);
      if (i > 0) {
        this.autoLevel = ORDER[i - 1];
        Log.warn('quality', `Low FPS (${fps.toFixed(0)}); auto quality lowered to "${this.autoLevel}"`);
        window.dispatchEvent(new CustomEvent('quality-changed'));
      }
    }
  }
}

export const Quality = new QualityImpl();
