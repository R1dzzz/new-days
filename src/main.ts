import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { MenuUIScene } from './scenes/MenuUIScene';
import { CreateScene } from './scenes/CreateScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { FXScene } from './scenes/FXScene';
import { Log } from './core/Logger';
import { Session } from './core/Session';
import { Controls } from './input/Controls';

function showBootError(msg: string): void {
  const el = document.getElementById('boot-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

window.addEventListener('error', (e) => {
  Log.error('window', e.message, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  Log.error('promise', String(e.reason), e.reason);
});

try {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#10151f',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    render: { pixelArt: false, antialias: true, roundPixels: false },
    input: { activePointers: 3 },
    disableContextMenu: true,
    scene: [BootScene, MenuScene, MenuUIScene, CreateScene, GameScene, UIScene, FXScene]
  });
  // Read-only debugging/test hook (used by the automated browser check in scripts/e2e.cjs).
  Object.assign(window, { __game: game, __session: Session, __controls: Controls });
} catch (err) {
  Log.error('main', 'Could not start Phaser', err);
  showBootError('The game could not start: ' + (err as Error).message);
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => Log.warn('pwa', 'Service worker registration failed', err));
  });
}
