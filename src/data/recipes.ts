export type StationId = 'workbench' | 'campfire';

export interface RecipeDef {
  id: string;
  station: StationId;
  output: { id: string; qty: number };
  inputs: Array<{ id: string; qty: number }>;
  /** Energy cost to make it. */
  energy: number;
}

export const RECIPES: RecipeDef[] = [
  { id: 'fertilizer', station: 'workbench', output: { id: 'fertilizer', qty: 2 }, inputs: [{ id: 'fiber', qty: 3 }, { id: 'wood', qty: 1 }], energy: 2 },
  { id: 'turnip_stew', station: 'campfire', output: { id: 'turnip_stew', qty: 1 }, inputs: [{ id: 'turnip', qty: 2 }, { id: 'wild_berry', qty: 1 }], energy: 1 },
  { id: 'bread', station: 'campfire', output: { id: 'bread', qty: 1 }, inputs: [{ id: 'turnip', qty: 1 }, { id: 'fiber', qty: 1 }], energy: 1 }
];

export function recipesFor(station: StationId): RecipeDef[] {
  return RECIPES.filter((r) => r.station === station);
}
