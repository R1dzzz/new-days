type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  t: number;
  level: Level;
  scope: string;
  msg: string;
}

const MAX_ENTRIES = 200;
const ring: LogEntry[] = [];

function push(level: Level, scope: string, msg: string, extra?: unknown): void {
  const entry: LogEntry = { t: Date.now(), level, scope, msg };
  ring.push(entry);
  if (ring.length > MAX_ENTRIES) ring.shift();
  const fn = level === 'debug' ? console.debug : level === 'info' ? console.info : level === 'warn' ? console.warn : console.error;
  if (extra !== undefined) fn(`[${scope}] ${msg}`, extra);
  else fn(`[${scope}] ${msg}`);
}

export const Log = {
  debug: (scope: string, msg: string, extra?: unknown) => push('debug', scope, msg, extra),
  info: (scope: string, msg: string, extra?: unknown) => push('info', scope, msg, extra),
  warn: (scope: string, msg: string, extra?: unknown) => push('warn', scope, msg, extra),
  error: (scope: string, msg: string, extra?: unknown) => push('error', scope, msg, extra),
  /** Recent log lines, newest last. Useful for a bug-report dump. */
  recent: (): readonly LogEntry[] => ring,
  dump: (): string =>
    ring.map((e) => `${new Date(e.t).toISOString()} ${e.level.toUpperCase()} [${e.scope}] ${e.msg}`).join('\n')
};
