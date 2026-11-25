import Phaser from 'phaser';
import { Settings } from '../core/Settings';
import { Quality } from '../core/Quality';
import { applyColorMode } from '../core/ColorFilter';
import { Log } from '../core/Logger';
import { generateAllTextures } from '../art/TextureFactory';
import { FONT_STACK, t } from '../i18n/I18n';
import { bus } from '../core/EventBus';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    Settings.load();
    Quality.init();
    applyColorMode(Settings.data.colorMode);
    bus.on('settings:changed', () => applyColorMode(Settings.data.colorMode));
    const label = this.add
      .text(this.scale.width / 2, this.scale.height / 2, t('misc.loading'), { fontFamily: FONT_STACK, fontSize: '22px', color: '#ffe9c9' })
      .setOrigin(0.5);
    // Let the loading text paint before the (synchronous) procedural art generation.
    this.time.delayedCall(60, () => {
      try {
        generateAllTextures(this);
        label.destroy();
        this.scene.start('Menu');
      } catch (err) {
        Log.error('boot', 'Texture generation failed', err);
        label.setText(t('misc.error'));
        throw err;
      }
    });
  }
}
