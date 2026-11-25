import { Settings } from '../core/Settings';
import { Log } from '../core/Logger';

export type SfxName =
  | 'ui' | 'back' | 'coin' | 'chop' | 'mine' | 'dig' | 'water' | 'plant' | 'harvest' | 'pickup'
  | 'cast' | 'bite' | 'splash' | 'level' | 'quest' | 'eat' | 'step' | 'sleep' | 'error' | 'thunder' | 'discover';

export interface Mood {
  place: 'menu' | 'island';
  hour: number;
  weather: string;
  activity: 'idle' | 'fishing' | 'dialogue';
  festival: boolean;
}

const MAJOR = [0, 2, 4, 7, 9];
const MINOR = [0, 3, 5, 7, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const ROOT = 261.63;

function noteFreq(semi: number): number {
  return ROOT * Math.pow(2, semi / 12);
}

interface MusicParams {
  scale: number[];
  tempo: number;
  density: number;
  octave: number;
  vol: number;
}

export function musicParamsFor(m: Mood): MusicParams {
  let p: MusicParams;
  if (m.place === 'menu') p = { scale: MAJOR, tempo: 72, density: 0.5, octave: 0, vol: 1 };
  else if (m.festival) p = { scale: MAJOR, tempo: 112, density: 0.8, octave: 12, vol: 1 };
  else if (m.hour >= 20 || m.hour < 5) p = { scale: MINOR, tempo: 58, density: 0.3, octave: -12, vol: 0.8 };
  else if (m.hour >= 17) p = { scale: LYDIAN, tempo: 66, density: 0.38, octave: 0, vol: 0.9 };
  else if (m.hour < 8) p = { scale: MAJOR, tempo: 70, density: 0.4, octave: 0, vol: 0.9 };
  else p = { scale: MAJOR, tempo: 86, density: 0.55, octave: 0, vol: 1 };
  if (m.weather === 'rain' || m.weather === 'storm' || m.weather === 'fog') {
    p = { ...p, density: p.density * 0.6, tempo: p.tempo * 0.88, octave: p.octave - 12 * (p.octave > -12 ? 1 : 0), vol: p.vol * 0.85 };
  }
  if (m.activity === 'fishing') p = { ...p, density: 0.22, vol: p.vol * 0.7 };
  if (m.activity === 'dialogue') p = { ...p, density: p.density * 0.5, vol: p.vol * 0.6 };
  return p;
}

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private ambGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  private mood: Mood = { place: 'menu', hour: 10, weather: 'sunny', activity: 'idle', festival: false };
  private waves?: GainNode;
  private wind?: GainNode;
  private rain?: GainNode;
  private lastCricket = 0;
  private lastThunder = 0;
  private lastStep = 0;

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (first click/key/touch). Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) {
          Log.warn('audio', 'WebAudio not supported; running silent');
          return;
        }
        this.ctx = new AC();
        this.build();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (err) {
      Log.error('audio', 'Could not start audio', err);
    }
  }

  private build(): void {
    const c = this.ctx!;
    this.master = c.createGain();
    this.musicGain = c.createGain();
    this.sfxGain = c.createGain();
    this.ambGain = c.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.ambGain.connect(this.master);
    this.master.connect(c.destination);

    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    this.waves = this.loopNoise('lowpass', 520, 0.0, 0.7);
    this.wind = this.loopNoise('bandpass', 420, 0.0, 0.6);
    this.rain = this.loopNoise('highpass', 1500, 0.0, 0.5);
    // waves swell via LFO
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(this.waves.gain);
    lfo.start();

    this.applySettings();
    this.nextBeat = c.currentTime + 0.1;
    this.timer = window.setInterval(() => this.tick(), 90);
  }

  private loopNoise(type: BiquadFilterType, freq: number, gain: number, q: number): GainNode {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(this.ambGain);
    src.start();
    return g;
  }

  applySettings(): void {
    if (!this.ctx) return;
    const s = Settings.data;
    const t = this.ctx.currentTime;
    const m = s.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(0.9 * m, t, 0.05);
    this.musicGain.gain.setTargetAtTime(s.musicVolume * 0.5, t, 0.1);
    this.sfxGain.gain.setTargetAtTime(s.sfxVolume * 0.8, t, 0.05);
    this.ambGain.gain.setTargetAtTime(s.ambienceVolume, t, 0.1);
  }

  setMood(m: Partial<Mood>): void {
    this.mood = { ...this.mood, ...m };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const isIsland = this.mood.place === 'island';
    const w = this.mood.weather;
    this.waves?.gain.setTargetAtTime(isIsland ? 0.16 : 0.1, t, 0.8);
    this.wind?.gain.setTargetAtTime(w === 'storm' ? 0.22 : w === 'fog' || w === 'cloudy' ? 0.06 : 0.025, t, 0.8);
    this.rain?.gain.setTargetAtTime(w === 'rain' ? 0.1 : w === 'storm' ? 0.18 : 0, t, 0.6);
  }

  /* ---------------------------------------------------------------- music */
  private tick(): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const p = musicParamsFor(this.mood);
    const beatLen = 60 / p.tempo;
    while (this.nextBeat < c.currentTime + 0.4) {
      this.playBeat(this.nextBeat, p, beatLen);
      this.nextBeat += beatLen;
      this.beat++;
    }
    this.ambientEvents(c.currentTime);
  }

  private playBeat(when: number, p: MusicParams, beatLen: number): void {
    // slow pad every 8 beats, root drifts through a small progression
    if (this.beat % 8 === 0) {
      const prog = [0, 5, 3, 7];
      const root = p.scale[prog[(this.beat / 8) % 4 % p.scale.length] % p.scale.length] + p.octave - 12;
      for (const interval of [0, 7, 12]) this.voice(noteFreq(root + interval), when, beatLen * 8, 'sine', 0.05 * p.vol, 1.2, 2.5);
    }
    if (Math.random() < p.density) {
      const deg = p.scale[Math.floor(Math.random() * p.scale.length)];
      const oct = Math.random() < 0.3 ? 12 : 0;
      const len = beatLen * (Math.random() < 0.3 ? 2 : 1);
      this.voice(noteFreq(deg + p.octave + oct), when, len, 'triangle', 0.11 * p.vol, 0.01, len * 1.6);
    }
  }

  private voice(freq: number, when: number, dur: number, type: OscillatorType, vol: number, attack: number, release: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + release * 0.5);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(when);
    o.stop(when + dur + release);
  }

  private ambientEvents(now: number): void {
    const m = this.mood;
    if (m.place !== 'island') return;
    const night = m.hour >= 20 || m.hour < 5;
    if (night && m.weather !== 'rain' && m.weather !== 'storm' && now - this.lastCricket > 0.55) {
      this.lastCricket = now;
      if (Math.random() < 0.7) for (let i = 0; i < 3; i++) this.tone(4300 + Math.random() * 200, 0.035, 'sine', 0.025, undefined, this.ambGain, i * 0.06);
    }
    if (m.weather === 'storm' && now - this.lastThunder > 9 && Math.random() < 0.02) {
      this.lastThunder = now;
      this.sfx('thunder');
    }
  }

  /* ---------------------------------------------------------------- sfx */
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, dest?: GainNode, delay = 0): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, freq: number, vol: number, type: BiquadFilterType = 'bandpass', delay = 0): void {
    const c = this.ctx;
    if (!c || c.state !== 'running' || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  sfx(name: SfxName): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'ui': this.tone(660, 0.07, 'triangle', 0.25, 880); break;
      case 'back': this.tone(520, 0.08, 'triangle', 0.22, 360); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.12); this.tone(1319, 0.16, 'square', 0.12, undefined, undefined, 0.07); break;
      case 'chop': this.noise(0.1, 900, 0.5); this.tone(150, 0.12, 'square', 0.18, 70); break;
      case 'mine': this.noise(0.08, 2600, 0.4, 'highpass'); this.tone(420, 0.1, 'square', 0.14, 200); break;
      case 'dig': this.noise(0.14, 380, 0.5, 'lowpass'); break;
      case 'water': this.noise(0.35, 1800, 0.25, 'bandpass'); this.tone(500, 0.2, 'sine', 0.06, 900); break;
      case 'plant': this.noise(0.08, 500, 0.35, 'lowpass'); this.tone(330, 0.1, 'sine', 0.15, 440); break;
      case 'harvest': [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.2, undefined, undefined, i * 0.06)); break;
      case 'pickup': this.tone(740, 0.06, 'sine', 0.2, 1100); break;
      case 'cast': this.noise(0.25, 2000, 0.3, 'highpass'); this.tone(300, 0.25, 'sine', 0.1, 700); break;
      case 'bite': this.tone(1200, 0.1, 'square', 0.18); this.tone(1200, 0.1, 'square', 0.18, undefined, undefined, 0.14); break;
      case 'splash': this.noise(0.4, 1200, 0.4, 'bandpass'); break;
      case 'level': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.22, undefined, undefined, i * 0.09)); break;
      case 'quest': [392, 523, 659].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.22, undefined, undefined, i * 0.12)); break;
      case 'discover': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.16, undefined, undefined, i * 0.1)); break;
      case 'eat': this.noise(0.06, 900, 0.3); this.noise(0.06, 900, 0.3, 'bandpass', 0.1); break;
      case 'step': this.noise(0.04, 300, 0.07, 'lowpass'); break;
      case 'sleep': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.16, undefined, undefined, i * 0.22)); break;
      case 'error': this.tone(180, 0.18, 'sawtooth', 0.14, 120); break;
      case 'thunder': this.noise(1.6, 140, 0.9, 'lowpass'); this.noise(0.9, 90, 0.7, 'lowpass', 0.5); break;
    }
  }

  /** Rate-limited footstep. */
  step(): void {
    const now = performance.now();
    if (now - this.lastStep < 260) return;
    this.lastStep = now;
    this.sfx('step');
  }
}

export const Audio = new AudioManagerImpl();
