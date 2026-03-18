import { safeStringify } from './utils';

interface ErrorEntry {
  message: string;
  stack: string | null;
  timestamp: number;
  type: 'exception' | 'rejection';
}

const MAX_ERRORS = 50;
let errors: ErrorEntry[] = [];
let installed = false;

export function installErrorTracking(): void {
  if (installed) return;
  installed = true;

  const g = globalThis as Record<string, unknown>;

  if (typeof g.ErrorUtils === 'object' && g.ErrorUtils !== null) {
    const eu = g.ErrorUtils as {
      getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
      setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
    const prev = eu.getGlobalHandler();
    eu.setGlobalHandler((error: Error, isFatal?: boolean) => {
      errors.push({
        message: `${isFatal ? '[FATAL] ' : ''}${error.message}`,
        stack: error.stack ?? null,
        timestamp: Date.now(),
        type: 'exception',
      });
      if (errors.length > MAX_ERRORS) errors = errors.slice(-MAX_ERRORS);
      prev(error, isFatal);
    });
  }

  if (typeof g.HermesInternal === 'object' && g.HermesInternal !== null) {
    const hermes = g.HermesInternal as {
      enablePromiseRejectionTracker?: (opts: {
        allRejections: boolean;
        onUnhandled: (id: number, reason: unknown) => void;
      }) => void;
    };
    if (typeof hermes.enablePromiseRejectionTracker === 'function') {
      hermes.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id: number, reason: unknown) => {
          const msg = reason instanceof Error ? reason.message : safeStringify(reason, 500);
          const stack = reason instanceof Error ? (reason.stack ?? null) : null;
          errors.push({ message: msg, stack, timestamp: Date.now(), type: 'rejection' });
          if (errors.length > MAX_ERRORS) errors = errors.slice(-MAX_ERRORS);
        },
      });
    }
  }
}

export function getErrors(): string {
  return JSON.stringify(errors);
}

export function clearErrors(): string {
  errors = [];
  return JSON.stringify({ cleared: true });
}
