/**
 * Tiny typed event bus. Gameplay logic emits events; rendering/UI subscribe.
 * This is what keeps simulation code free of Phaser dependencies.
 */
export interface GameEvents {
  'time:minute': { day: number; minutes: number };
  'time:newDay': { day: number; season: number; year: number };
  'time:season': { season: number; year: number };
  'weather:changed': { weather: string };
  'inventory:changed': undefined;
  'player:stats': undefined;
  'player:levelUp': { skill: string; level: number };
  'farm:changed': undefined;
  'quest:updated': { id: string };
  'quest:completed': { id: string };
  'friendship:changed': { npc: string; points: number };
  'toast': { key: string; params?: Record<string, string | number>; tone?: 'info' | 'good' | 'warn' };
  'save:done': { slot: number; auto: boolean };
  'save:failed': { reason: string };
  'discovery': { id: string };
  'settings:changed': undefined;
  'language:changed': { lang: string };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event as string);
    if (!set) {
      set = new Set();
      this.handlers.set(event as string, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    this.handlers.get(event as string)?.delete(handler);
  }

  emit<K extends keyof GameEvents>(
    event: K,
    ...args: GameEvents[K] extends undefined ? [] : [GameEvents[K]]
  ): void {
    const set = this.handlers.get(event as string);
    if (!set) return;
    for (const h of [...set]) {
      try {
        h(args[0] as GameEvents[K]);
      } catch (err) {
        // A broken listener must never break the simulation, but it must never be silent either.
        console.error(`[EventBus] handler for "${String(event)}" threw`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const bus = new EventBus();
