import { safeStringify } from './utils';

interface ConsoleEntry {
  level: string;
  message: string;
  timestamp: number;
}

const MAX_ENTRIES = 200;
let buffer: ConsoleEntry[] = [];
const SENTINEL_KEY = '__RN_DEV_BRIDGE_CONSOLE_PATCHED__';

export function installConsolePatch(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[SENTINEL_KEY]) return;
  if (typeof globalThis.console === 'undefined') return;
  g[SENTINEL_KEY] = true;

  const levels = ['log', 'warn', 'error', 'info', 'debug'] as const;
  for (const level of levels) {
    const original = (globalThis.console as unknown as Record<string, unknown>)[level];
    if (typeof original !== 'function') continue;

    (globalThis.console as unknown as Record<string, (...args: unknown[]) => void>)[level] = (
      ...args: unknown[]
    ) => {
      buffer.push({
        level,
        message: args.map((a) => (typeof a === 'string' ? a : safeStringify(a, 2000))).join(' '),
        timestamp: Date.now(),
      });
      if (buffer.length > MAX_ENTRIES) {
        buffer = buffer.slice(-MAX_ENTRIES);
      }
      (original as (...args: unknown[]) => void).apply(globalThis.console, args);
    };
  }
}

export function getConsole(opts?: { level?: string; limit?: number }): string {
  const level = opts?.level ?? 'all';
  const limit = opts?.limit ?? 50;

  let filtered = buffer;
  if (level !== 'all') {
    filtered = buffer.filter((e) => e.level === level);
  }

  const entries = filtered.slice(-limit);
  return JSON.stringify({ entries, total: filtered.length, shown: entries.length });
}

export function clearConsole(): string {
  buffer = [];
  return JSON.stringify({ cleared: true });
}
