/**
 * Dialogue graph. Every `text` is an i18n key; no player-visible English lives in code.
 * A node shows its text, then either its choices or a single "continue" to `next`.
 */
export interface DialogueEffect {
  /** Friendship points to add to the speaking NPC. */
  friendship?: number;
  /** Quest to start. */
  startQuest?: string;
  /** Flag to set. */
  flag?: string;
  /** Open this NPC's shop. */
  openShop?: boolean;
  /** Open gift picker. */
  gift?: boolean;
  /** Give item(s) to the player. */
  give?: Array<{ id: string; qty: number }>;
  /** Mark a discovery / lore entry. */
  discover?: string;
}

export interface DialogueChoice {
  text: string;
  next?: string; // undefined => ends conversation
  effect?: DialogueEffect;
  /** Show only if flag is set (or unset if prefixed with !). */
  requires?: string;
}

export interface DialogueNode {
  text: string;
  speaker: string; // npc id or 'narrator'
  next?: string;
  choices?: DialogueChoice[];
  effect?: DialogueEffect;
}

export const DIALOGUE: Record<string, DialogueNode> = {
  // ------------------------------------------------------------------ Mira
  'mira.event.first': {
    speaker: 'mira',
    text: 'dlg.mira.first.1',
    next: 'mira.event.first.2'
  },
  'mira.event.first.2': {
    speaker: 'mira',
    text: 'dlg.mira.first.2',
    choices: [
      { text: 'dlg.mira.first.c1', next: 'mira.event.first.kind', effect: { friendship: 20 } },
      { text: 'dlg.mira.first.c2', next: 'mira.event.first.joke', effect: { friendship: 10 } },
      { text: 'dlg.mira.first.c3', next: 'mira.event.first.quiet' }
    ]
  },
  'mira.event.first.kind': { speaker: 'mira', text: 'dlg.mira.first.kind', next: 'mira.event.first.end' },
  'mira.event.first.joke': { speaker: 'mira', text: 'dlg.mira.first.joke', next: 'mira.event.first.end' },
  'mira.event.first.quiet': { speaker: 'mira', text: 'dlg.mira.first.quiet', next: 'mira.event.first.end' },
  'mira.event.first.end': {
    speaker: 'mira',
    text: 'dlg.mira.first.end',
    effect: { startQuest: 'ch1_find_mira_help', give: [{ id: 'seashell', qty: 1 }], discover: 'lore.shipwreck' }
  },
  'mira.greet.stranger': { speaker: 'mira', text: 'dlg.mira.greet.stranger', choices: miraMenu() },
  'mira.greet.acquaintance': { speaker: 'mira', text: 'dlg.mira.greet.acquaintance', choices: miraMenu() },
  'mira.greet.tide': { speaker: 'mira', text: 'dlg.mira.greet.tide', choices: miraMenu() },
  'mira.greet.friend': { speaker: 'mira', text: 'dlg.mira.greet.friend', choices: miraMenu() },
  'mira.greet.lighthouse': { speaker: 'mira', text: 'dlg.mira.greet.lighthouse', choices: miraMenu() },
  'mira.greet.close': { speaker: 'mira', text: 'dlg.mira.greet.close', choices: miraMenu() },
  'mira.about': { speaker: 'mira', text: 'dlg.mira.about.1', next: 'mira.about.2' },
  'mira.about.2': { speaker: 'mira', text: 'dlg.mira.about.2', effect: { discover: 'lore.archipelago' } },
  'mira.event.lighthouse': {
    speaker: 'mira',
    text: 'dlg.mira.lighthouse.1',
    next: 'mira.event.lighthouse.2'
  },
  'mira.event.lighthouse.2': {
    speaker: 'mira',
    text: 'dlg.mira.lighthouse.2',
    effect: { discover: 'lore.lighthouse', flag: 'lighthouse_secret' }
  },

  // ------------------------------------------------------------------ Bram
  'bram.event.first': { speaker: 'bram', text: 'dlg.bram.first.1', next: 'bram.event.first.2' },
  'bram.event.first.2': {
    speaker: 'bram',
    text: 'dlg.bram.first.2',
    choices: [
      { text: 'dlg.bram.first.c1', next: 'bram.event.first.work', effect: { friendship: 15 } },
      { text: 'dlg.bram.first.c2', next: 'bram.event.first.grumble', effect: { friendship: 5 } }
    ]
  },
  'bram.event.first.work': { speaker: 'bram', text: 'dlg.bram.first.work', next: 'bram.event.first.end' },
  'bram.event.first.grumble': { speaker: 'bram', text: 'dlg.bram.first.grumble', next: 'bram.event.first.end' },
  'bram.event.first.end': {
    speaker: 'bram',
    text: 'dlg.bram.first.end',
    effect: { give: [{ id: 'seed_turnip', qty: 4 }], flag: 'met_bram' }
  },
  'bram.greet.stranger': { speaker: 'bram', text: 'dlg.bram.greet.stranger', choices: bramMenu() },
  'bram.greet.acquaintance': { speaker: 'bram', text: 'dlg.bram.greet.acquaintance', choices: bramMenu() },
  'bram.greet.weather': { speaker: 'bram', text: 'dlg.bram.greet.weather', choices: bramMenu() },
  'bram.greet.friend': { speaker: 'bram', text: 'dlg.bram.greet.friend', choices: bramMenu() },
  'bram.greet.close': { speaker: 'bram', text: 'dlg.bram.greet.close', choices: bramMenu() },
  'bram.about': { speaker: 'bram', text: 'dlg.bram.about.1', effect: { discover: 'lore.farming' } },
  'bram.event.ship': { speaker: 'bram', text: 'dlg.bram.ship.1', next: 'bram.event.ship.2' },
  'bram.event.ship.2': { speaker: 'bram', text: 'dlg.bram.ship.2', effect: { discover: 'lore.ruins', flag: 'bram_ship' } },

  // ------------------------------------------------------------------ gift outcomes (spoken after gift)
  'gift.love': { speaker: 'npc', text: 'dlg.gift.love' },
  'gift.like': { speaker: 'npc', text: 'dlg.gift.like' },
  'gift.neutral': { speaker: 'npc', text: 'dlg.gift.neutral' },
  'gift.hate': { speaker: 'npc', text: 'dlg.gift.hate' },
  'gift.already': { speaker: 'npc', text: 'dlg.gift.already' },
  'gift.nothing': { speaker: 'npc', text: 'dlg.gift.nothing' },

  // ------------------------------------------------------------------ narrator beats
  'intro.wake': { speaker: 'narrator', text: 'dlg.intro.wake.1', next: 'intro.wake.2' },
  'intro.wake.2': { speaker: 'narrator', text: 'dlg.intro.wake.2', effect: { startQuest: 'ch1_washed_ashore', flag: 'intro_done' } }
};

function miraMenu(): DialogueChoice[] {
  return [
    { text: 'dlg.menu.chat', next: 'mira.about', effect: { friendship: 0 } },
    { text: 'dlg.menu.gift', effect: { gift: true } },
    { text: 'dlg.menu.bye' }
  ];
}

function bramMenu(): DialogueChoice[] {
  return [
    { text: 'dlg.menu.shop', effect: { openShop: true } },
    { text: 'dlg.menu.chat', next: 'bram.about' },
    { text: 'dlg.menu.gift', effect: { gift: true } },
    { text: 'dlg.menu.bye' }
  ];
}
