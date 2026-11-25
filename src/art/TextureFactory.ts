import Phaser from 'phaser';
import { CHAR_COLS, CHAR_H, CHAR_ROWS, CHAR_W, drawCharacterSheet, type Look } from './characterArt';
import { CROP_ORDER, drawBush, drawCabin, drawCampfire, drawCropAtlas, drawDot, drawExclaim, drawGlow, drawHut, drawLeaf, drawLighthouse, drawRaindrop, drawRock, drawShell, drawShop, drawStandingStone, drawStump, drawTalkMark, drawTree, drawWorkbench } from './objectArt';
import { drawCursor, drawIslandTerrain, drawSoil, drawWaterBase, drawWaterHighlights } from './terrainArt';
import { drawIcon } from './iconArt';
import { drawBirds, drawBoat, drawCloud, drawMenuIsland, drawSkyGradient } from './menuArt';
import { ITEMS } from '../data/items';
import { generateIsland, type IslandData } from '../world/WorldData';
import { Log } from '../core/Logger';
import { PAL } from './draw';

/**
 * Single place that turns drawing code into Phaser textures.
 * Every texture is addressed by key, so any entry can be replaced by a loaded image/atlas with the same key
 * (and frame names) without touching gameplay code.
 */
function add(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

export function frameKey(row: number, col: number): number {
  return row * CHAR_COLS + col;
}

/** (Re)generate a character sheet texture: `char_<key>`; frame index = row * CHAR_COLS + col. */
export function makeCharacterTexture(scene: Phaser.Scene, key: string, look: Look): string {
  const tk = `char_${key}`;
  add(scene, tk, drawCharacterSheet(look));
  const tex = scene.textures.get(tk);
  for (let r = 0; r < CHAR_ROWS; r++) for (let c = 0; c < CHAR_COLS; c++) tex.add(frameKey(r, c), 0, c * CHAR_W, r * CHAR_H, CHAR_W, CHAR_H);
  return tk;
}

let island: IslandData | null = null;
export function getIsland(): IslandData {
  if (!island) island = generateIsland();
  return island;
}

export function generateAllTextures(scene: Phaser.Scene): void {
  const t0 = performance.now();
  add(scene, 'water_base', drawWaterBase());
  add(scene, 'water_hi', drawWaterHighlights());
  add(scene, 'terrain', drawIslandTerrain(getIsland()));
  add(scene, 'soil_dry', drawSoil(false));
  add(scene, 'soil_wet', drawSoil(true));
  add(scene, 'cursor', drawCursor());

  for (let v = 0; v < 3; v++) add(scene, `tree_${v}`, drawTree(v));
  add(scene, 'stump', drawStump());
  for (let v = 0; v < 2; v++) add(scene, `rock_${v}`, drawRock(v));
  add(scene, 'bush_berry', drawBush(true));
  add(scene, 'bush_empty', drawBush(false));
  for (let v = 0; v < 2; v++) add(scene, `shell_${v}`, drawShell(v));
  add(scene, 'ancient_stone', drawStandingStone());
  add(scene, 'workbench', drawWorkbench());
  add(scene, 'b_cabin', drawCabin());
  add(scene, 'b_shop', drawShop());
  add(scene, 'b_lighthouse', drawLighthouse());
  add(scene, 'b_hut', drawHut());

  add(scene, 'campfire', drawCampfire());
  const cf = scene.textures.get('campfire');
  for (let i = 0; i < 3; i++) cf.add(i, 0, i * 32, 0, 32, 40);

  add(scene, 'crops', drawCropAtlas());
  const crops = scene.textures.get('crops');
  CROP_ORDER.forEach((id, row) => {
    for (let st = 0; st < 5; st++) crops.add(`${id}_${st}`, 0, st * 32, row * 32, 32, 32);
  });

  for (const id of Object.keys(ITEMS)) add(scene, `icon_${id}`, drawIcon(id));

  add(scene, 'dot', drawDot());
  add(scene, 'rain', drawRaindrop());
  add(scene, 'leaf', drawLeaf());
  add(scene, 'glow', drawGlow());
  add(scene, 'exclaim', drawExclaim());
  add(scene, 'talkmark', drawTalkMark());

  // menu scenery
  add(scene, 'sky_day', drawSkyGradient('#7cc4e8', '#bfe6ee', '#fbe9c3'));
  add(scene, 'sky_dusk', drawSkyGradient('#3a3f7a', '#c9677a', '#f4b36b'));
  add(scene, 'sky_night', drawSkyGradient('#0e1330', '#1f2c5a', '#3a4f86'));
  for (let i = 0; i < 3; i++) add(scene, `cloud_${i}`, drawCloud(i + 1));
  add(scene, 'isle_far', drawMenuIsland(2, '#6d9aa6', '#4f7f8c', false));
  add(scene, 'isle_near', drawMenuIsland(5, PAL.grassDark, '#2f6a38', true));
  add(scene, 'boat', drawBoat());
  add(scene, 'birds', drawBirds());
  const birds = scene.textures.get('birds');
  birds.add(0, 0, 0, 0, 24, 16);
  birds.add(1, 0, 24, 0, 24, 16);

  Log.info('art', `Generated textures in ${(performance.now() - t0).toFixed(0)} ms`);
}
