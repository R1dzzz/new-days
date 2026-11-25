# The Lost Traveler

Cozy 2D top-down fantasy farming / life-sim for the browser. Phaser 3 + TypeScript + Vite, IndexedDB saves, installable PWA, English / Bahasa Indonesia / 日本語. All art is drawn procedurally at runtime and all audio is synthesised in the browser: **no third-party assets are bundled**, so there is nothing to license.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # typecheck + production build into dist/ + service-worker precache list
npm run preview -- --port 4173
node scripts/e2e.cjs http://localhost:4173/   # real-browser check of the first loop (needs Playwright + Chromium)
```
Deploy: upload `dist/` to any static host (HTTPS needed for the service worker). `base` is `./`, so sub-folders work.

## Controls
WASD / arrows move · E or Space interact · F or Enter use selected tool · 1–8 / wheel hotbar · I or Tab inventory · J journal · Q eat · Esc pause. Touch devices get a joystick and buttons. All keys are rebindable in Settings.

## What is actually implemented (and verified)

| Area | Status |
|---|---|
| Title screen (living backdrop, clock-based sky), new game, character creation (name, skin, hair, outfit, slot choice, overwrite confirm) | Done, verified in browser |
| Island (64×48, deterministic), cabin, shop, lighthouse, hut, standing stone, shells, berry bushes, trees, rocks | Done |
| Day/night, calendar (4 seasons), weather (sun/cloud/rain/storm/fog/snow), lighting & particles | Done |
| Farming: till, water, plant, grow, harvest, quality, fertilizer | Done; till/plant/water verified in browser, growth/harvest covered by unit tests |
| Gathering: chop, mine, forage, fishing, skills with XP | Done (unit tests for systems; fishing only manually written, not browser-tested) |
| Inventory, hotbar, sorting, eating, shop buy/sell, crafting (workbench, campfire) | Done |
| NPCs Mira & Bram: schedules, dialogue, friendship, gifts, shelter from rain | Done |
| Quests (main chapter 1 chain + side quest), journal, discovery/lore | Done |
| Save/load: 3 slots + auto-save, checksum, validation, backup recovery, export/import, sleep-to-save | Done; save/restore verified in browser |
| Settings: language, volumes, UI scale, camera zoom, quality presets, reduced motion, high contrast, colour-blind filters, key rebinding | Done (colour-blind filters are CSS/SVG based; visually not audited per mode) |
| Procedural audio + adaptive music | Implemented; **not listened to** in this environment (headless), so mixing quality is unverified |
| PWA | Service worker registered and an offline reload boots to the title screen in headless Chromium |

## Not implemented
Combat, enemies, dungeons/bosses, ship/sailing and other islands, animals/pets, building/furniture placement, map screen (key is bound but there is no map), equipment/armour, mining areas, multiplayer. Nothing in the UI pretends otherwise; features that do not exist have no buttons.

## Test results actually observed
- `npm test`: 84 / 84 passing (calendar, inventory, farming, save, i18n parity, gameplay systems, world reachability, content integrity).
- `npm run build`: passes with strict TypeScript.
- `scripts/e2e.cjs` in headless Chromium: menu → create character → intro → walk → till → plant → water → time passes → save → reload → Continue → farm/inventory/name restored → service worker registered → offline reload boots → no console errors. 19 checks, all PASS.

## Known limitations / honest notes
- Headless software rendering runs at ~6 FPS, so movement/timing checks were loose; real-device performance, touch controls and gamepad were **not** tested.
- Only Chromium was tested. Safari/Firefox untested. Mobile layouts untested beyond a desktop window.
- Translations (id, ja) were machine-written and have not been reviewed by native speakers.
- The art is intentionally simple procedural art; replace textures by key in `src/art/TextureFactory.ts`.
- Balance (prices, growth time, energy costs) is a first pass and has not been playtested for hours.

## Architecture
`src/core` state, time, save, settings · `src/systems` pure game rules (tested without Phaser) · `src/data` items/crops/NPCs/dialogue/quests · `src/world` island generator + pathfinding · `src/art` procedural drawing · `src/scenes` Phaser scenes (Boot, Menu, MenuUI, Create, Game, UI, FX) · `src/ui` widgets and panels · `src/i18n` locales · `tests/` vitest · `scripts/` SW generator and browser e2e.
