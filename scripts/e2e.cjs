// Real-browser check of the first loop. Usage: node scripts/e2e.cjs http://localhost:4173/
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4173/';
const results = [];
const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 680 } });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  p.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
  const click = async (label) => {
    const pos = await p.evaluate((label) => {
      const g = window.__game;
      for (const s of g.scene.getScenes(true)) {
        const find = (list) => { for (const o of list) { if (o.type === 'Text' && o.text === label) { const m = o.getWorldTransformMatrix(); const cam = s.cameras.main; const r = g.canvas.getBoundingClientRect(); return { x: r.left + (m.tx + o.displayWidth * (0.5 - o.originX)) * cam.zoom, y: r.top + (m.ty + o.displayHeight * (0.5 - o.originY)) * cam.zoom }; } if (o.list) { const r = find(o.list); if (r) return r; } } };
        const r = find(s.children.list); if (r) return r;
      }
      return null;
    }, label);
    if (!pos) throw new Error('no text ' + label);
    await p.mouse.click(pos.x, pos.y);
    await p.waitForTimeout(500);
  };
  const active = () => p.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
  const st = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__session.state)));
  await p.goto(url); await p.waitForTimeout(2000);
  ok('menu shows', (await active()).includes('Menu'));
  await click('New Game'); await p.waitForTimeout(500);
  await p.fill('input', 'Aria');
  await click('Begin the journey'); await p.waitForTimeout(3000);
  ok('game starts', (await active()).includes('Game'));
  // intro dialogue: advance with Space until closed
  const modalOpen = () => p.evaluate(() => !!window.__game.scene.getScene('UI')?.modal);
  for (let i = 0; i < 40 && !(await modalOpen()); i++) await p.waitForTimeout(250);
  ok('intro dialogue opens', await modalOpen());
  for (let i = 0; i < 12 && (await modalOpen()); i++) { await p.keyboard.press('Space'); await p.waitForTimeout(450); }
  ok('intro dialogue closes', !(await p.evaluate(() => !!window.__game.scene.getScene('UI')?.modal)));
  let s0 = await st();
  ok('name kept', s0.player.name === 'Aria');
  // walk right/down
  await p.keyboard.down('d'); await p.waitForTimeout(2500); await p.keyboard.up('d');
  let s1 = await st();
  ok('player moves', s1.player.x > s0.player.x + 15, `${Math.round(s0.player.x)}→${Math.round(s1.player.x)}`);
  // till + plant in farm area: teleport onto farm tile via state (test shortcut), face down, use hoe
  await p.evaluate(() => { const g = window.__game.scene.getScene('Game'); g.px = 25 * 32 + 16; g.py = 24 * 32 + 16; g.facing = 'down'; });
  await p.waitForTimeout(300);
  await p.keyboard.press('1'); await p.keyboard.press('f'); await p.waitForTimeout(800);
  let s2 = await st();
  ok('hoe tills soil', Object.keys(s2.farm.plots).length === 1, JSON.stringify(Object.values(s2.farm.plots)[0] || {}));
  const slot = s2.inventory.slots.findIndex((x) => x && x.id === 'seed_turnip');
  await p.keyboard.press(String(slot + 1)); await p.keyboard.press('f'); await p.waitForTimeout(800);
  let s3 = await st();
  const plot = Object.values(s3.farm.plots)[0];
  ok('seed planted', !!plot && !!plot.crop, JSON.stringify(plot));
  ok('seed consumed', (s3.inventory.slots[slot]?.qty ?? 0) === 5);
  // water
  await p.keyboard.press('2'); await p.keyboard.press('f'); await p.waitForTimeout(800);
  ok('watered', Object.values((await st()).farm.plots)[0].watered === true);
  const t0 = (await st()).time.minutes;
  await p.waitForTimeout(4000);
  ok('time passes', (await st()).time.minutes !== t0 || (await st()).time.day > 1);
  // manual save through Session, then reload page and continue
  const saved = await p.evaluate(() => window.__session.saveManual());
  ok('manual save ok', saved === true);
  const before = await st();
  await p.reload(); await p.waitForTimeout(2500);
  await click('Continue'); await p.waitForTimeout(3000);
  ok('continue loads game', (await active()).includes('Game'));
  const after = await st();
  ok('plot restored', JSON.stringify(after.farm.plots) === JSON.stringify(before.farm.plots));
  ok('inventory restored', JSON.stringify(after.inventory.slots) === JSON.stringify(before.inventory.slots));
  ok('name restored', after.player.name === 'Aria');
  await p.screenshot({ path: '/tmp/e2e_after.png' });
  // offline check (service worker)
  await p.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  const swOk = await p.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration()));
  ok('service worker registered', swOk);
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(3000);
  ok('offline reload boots', (await active()).includes('Menu'));
  ok('no console errors', logs.length === 0, logs.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await b.close();
})().catch((e) => { console.log(results.join('\n')); console.log('ABORT', e.message); process.exit(1); });
