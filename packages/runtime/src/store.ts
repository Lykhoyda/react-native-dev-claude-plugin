import type { StoreRegistration } from './types';
import { safeStringify, resolvePath } from './utils';

const stores = new Map<string, StoreRegistration>();
let autoDetected = false;

export function registerStore(reg: StoreRegistration): void {
  stores.set(reg.name, reg);
}

function autoDetectStores(): void {
  if (autoDetected) return;
  autoDetected = true;

  const g = globalThis as Record<string, unknown>;

  if (g.__REDUX_STORE__ && typeof (g.__REDUX_STORE__ as { getState: () => unknown }).getState === 'function') {
    const rs = g.__REDUX_STORE__ as { getState: () => unknown; dispatch?: (action: unknown) => void };
    if (!stores.has('redux')) {
      stores.set('redux', { name: 'redux', type: 'redux', getState: () => rs.getState(), dispatch: rs.dispatch?.bind(rs) });
    }
  }

  if (g.__ZUSTAND_STORES__ && typeof g.__ZUSTAND_STORES__ === 'object') {
    const zs = g.__ZUSTAND_STORES__ as Record<string, { getState: () => unknown }>;
    for (const [key, store] of Object.entries(zs)) {
      if (!stores.has(`zustand:${key}`) && typeof store.getState === 'function') {
        stores.set(`zustand:${key}`, { name: key, type: 'zustand', getState: () => store.getState() });
      }
    }
  }
}

export function getStoreState(path?: string, type?: string): string {
  autoDetectStores();

  if (stores.size === 0) {
    return JSON.stringify({ error: 'No stores registered. Call registerStore() or expose __REDUX_STORE__/__ZUSTAND_STORES__' });
  }

  const results: Record<string, unknown> = {};

  for (const [key, reg] of stores) {
    if (type && reg.type !== type) continue;

    try {
      let state = reg.getState();
      if (path) {
        state = resolvePath(state, path);
      }
      results[key] = state;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results[key] = { __agent_error: msg };
    }
  }

  const keys = Object.keys(results);
  if (keys.length === 0) {
    return JSON.stringify({ error: `No stores of type '${type}' found` });
  }
  if (keys.length === 1) {
    return safeStringify({ type: stores.get(keys[0])!.type, state: results[keys[0]] });
  }
  return safeStringify({ stores: results });
}

export function dispatchAction(opts: { action: string; payload?: unknown; readPath?: string }): string {
  autoDetectStores();

  let reduxStore: StoreRegistration | undefined;
  for (const reg of stores.values()) {
    if (reg.type === 'redux' && reg.dispatch) {
      reduxStore = reg;
      break;
    }
  }

  if (!reduxStore || !reduxStore.dispatch) {
    return JSON.stringify({ error: 'No Redux store with dispatch found' });
  }

  try {
    reduxStore.dispatch({ type: opts.action, payload: opts.payload });
    if (opts.readPath) {
      const state = resolvePath(reduxStore.getState(), opts.readPath);
      return safeStringify({ dispatched: true, action: opts.action, state });
    }
    return JSON.stringify({ dispatched: true, action: opts.action });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ error: `Dispatch failed: ${msg}` });
  }
}
