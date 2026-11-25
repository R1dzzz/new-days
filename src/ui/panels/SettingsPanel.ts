import { Settings, type ActionKey, DEFAULT_KEYS } from '../../core/Settings';
import { Controls, keyLabel } from '../../input/Controls';
import { Audio } from '../../audio/AudioManager';
import { LANGUAGES, t } from '../../i18n/I18n';
import { Modal, type UiHost } from '../Modal';
import { addText, makeButton, makeSelector, makeSlider, makeToggle } from '../Widgets';

type Tab = 'general' | 'access' | 'controls';

export class SettingsPanel extends Modal {
  private tab: Tab = 'general';
  private rebinding: ActionKey | null = null;

  constructor(host: UiHost, onClose?: () => void) {
    super(host, { w: 620, h: 420, title: t('panel.settings'), onClose });
    this.build();
  }

  close(silent = false): void {
    Controls.captureKey = null;
    super.close(silent);
  }

  private row(i: number, label: string): number {
    const y = 56 + i * 44;
    this.body.add(addText(this.host.sc, 26, y + 8, label, 14, undefined, { bold: true, wrap: 230 }));
    return y;
  }

  protected build(): void {
    const s = this.host.sc;
    const D = Settings.data;
    const tabs: Tab[] = ['general', 'access', 'controls'];
    const names: Record<Tab, string> = { general: t('panel.settings'), access: t('settings.reducedMotion').split(' ')[0] === '' ? '' : this.accessLabel(), controls: t('settings.keys') };
    tabs.forEach((k, i) => this.body.add(makeButton(s, 170 + i * 124, 10, 120, 30, names[k], () => ((this.tab = k), this.rebuild()), { primary: this.tab === k, size: 12 })));
    const sx = 270;
    const sw = this.pw - sx - 40;
    const pct = (v: number) => addText(s, this.pw - 30, 0, '', 12);
    void pct;

    if (this.tab === 'general') {
      let y = this.row(0, t('settings.language'));
      this.body.add(makeSelector(s, sx, y, sw, LANGUAGES.map((l) => ({ value: l.code, label: l.label })), D.language, (v) => Settings.set('language', v)));
      y = this.row(1, t('settings.music'));
      this.body.add(makeSlider(s, sx, y + 17, sw, D.musicVolume, (v) => (Settings.set('musicVolume', v), Audio.applySettings())));
      y = this.row(2, t('settings.sfx'));
      this.body.add(makeSlider(s, sx, y + 17, sw, D.sfxVolume, (v) => (Settings.set('sfxVolume', v), Audio.applySettings())));
      y = this.row(3, t('settings.ambience'));
      this.body.add(makeSlider(s, sx, y + 17, sw, D.ambienceVolume, (v) => (Settings.set('ambienceVolume', v), Audio.applySettings())));
      y = this.row(4, t('settings.mute'));
      this.body.add(makeToggle(s, sx, y, D.muted, (v) => (Settings.set('muted', v), Audio.applySettings()), t('common.on'), t('common.off')));
      y = this.row(5, t('settings.quality'));
      this.body.add(makeSelector(s, sx, y, sw, (['auto', 'low', 'medium', 'high'] as const).map((q) => ({ value: q, label: t(`settings.quality.${q}`) })), D.quality, (v) => Settings.set('quality', v)));
      y = this.row(6, t('settings.difficulty'));
      this.body.add(makeSelector(s, sx, y, sw, (['relaxed', 'normal', 'hard'] as const).map((q) => ({ value: q, label: t(`settings.difficulty.${q}`) })), D.difficulty, (v) => Settings.set('difficulty', v)));
    } else if (this.tab === 'access') {
      let y = this.row(0, t('settings.textScale'));
      this.body.add(makeSlider(s, sx, y + 17, sw, D.textScale, (v) => Settings.set('textScale', Math.round(v * 10) / 10), 0.8, 1.6));
      y = this.row(1, t('settings.uiScale'));
      this.body.add(makeSlider(s, sx, y + 17, sw, D.uiScale, (v) => Settings.set('uiScale', Math.round(v * 10) / 10), 0.8, 1.6));
      y = this.row(2, t('settings.reducedMotion'));
      this.body.add(makeToggle(s, sx, y, D.reducedMotion, (v) => Settings.set('reducedMotion', v), t('common.on'), t('common.off')));
      y = this.row(3, t('settings.screenShake'));
      this.body.add(makeToggle(s, sx, y, D.screenShake, (v) => Settings.set('screenShake', v), t('common.on'), t('common.off')));
      y = this.row(4, t('settings.colorMode'));
      this.body.add(makeSelector(s, sx, y, sw, (['none', 'protanopia', 'deuteranopia', 'tritanopia'] as const).map((q) => ({ value: q, label: t(`settings.colorMode.${q}`) })), D.colorMode, (v) => Settings.set('colorMode', v)));
      y = this.row(5, t('settings.highContrast'));
      this.body.add(makeToggle(s, sx, y, D.highContrast, (v) => Settings.set('highContrast', v), t('common.on'), t('common.off')));
      y = this.row(6, t('settings.subtitleBg'));
      this.body.add(makeToggle(s, sx, y, D.subtitleBackground, (v) => Settings.set('subtitleBackground', v), t('common.on'), t('common.off')));
      y = this.row(7, t('settings.cameraZoom'));
      this.body.add(makeSlider(s, sx, y + 17, sw, D.cameraZoom, (v) => Settings.set('cameraZoom', Math.round(v * 20) / 20), 0.75, 2));
    } else {
      let y = this.row(0, t('settings.touch'));
      this.body.add(makeSelector(s, sx, y, sw, (['auto', 'on', 'off'] as const).map((q) => ({ value: q, label: t(`settings.touch.${q}`) })), D.touchControls, (v) => Settings.set('touchControls', v)));
      const actions = Object.keys(DEFAULT_KEYS) as ActionKey[];
      actions.forEach((a, i) => {
        const col = i % 2;
        const rw = Math.floor(i / 2);
        const x = 24 + col * (this.pw / 2 - 12);
        const yy = 100 + rw * 44;
        this.body.add(addText(s, x, yy + 8, t(`key.${a}`), 12, undefined, { wrap: 100 }));
        const label = this.rebinding === a ? t('settings.rebindHint') : D.keys[a].map(keyLabel).join(' / ');
        this.body.add(makeButton(s, x + 104, yy, this.pw / 2 - 150, 34, label, () => this.startRebind(a), { size: 12, primary: this.rebinding === a }));
      });
      this.body.add(makeButton(s, this.pw - 200, this.ph - 48, 176, 34, t('settings.reset'), () => (Settings.reset(), (this.rebinding = null)), { size: 13 }));
    }
  }

  private accessLabel(): string {
    return { en: 'Accessibility', id: 'Aksesibilitas', ja: 'アクセシビリティ' }[Settings.data.language];
  }

  private startRebind(a: ActionKey): void {
    this.rebinding = a;
    Controls.captureKey = (name) => {
      this.rebinding = null;
      if (name !== 'ESC') {
        // remove this key from other actions to avoid conflicts
        const keys = { ...Settings.data.keys };
        for (const k of Object.keys(keys) as ActionKey[]) if (k !== a) keys[k] = keys[k].filter((n) => n !== name).length ? keys[k].filter((n) => n !== name) : DEFAULT_KEYS[k].filter((n) => n !== name);
        keys[a] = [name];
        Settings.set('keys', keys);
      } else this.rebuild();
    };
    this.rebuild();
  }
}
