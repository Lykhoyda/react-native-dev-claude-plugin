import { safeStringify, resolvePath } from './utils';
const stores = new Map();
export function registerStore(reg) {
    stores.set(reg.name, reg);
}
function autoDetectStores() {
    var _a;
    const g = globalThis;
    if (g.__REDUX_STORE__ && typeof g.__REDUX_STORE__.getState === 'function') {
        const rs = g.__REDUX_STORE__;
        if (!stores.has('redux')) {
            stores.set('redux', { name: 'redux', type: 'redux', getState: () => rs.getState(), dispatch: (_a = rs.dispatch) === null || _a === void 0 ? void 0 : _a.bind(rs) });
        }
    }
    if (g.__ZUSTAND_STORES__ && typeof g.__ZUSTAND_STORES__ === 'object') {
        const zs = g.__ZUSTAND_STORES__;
        for (const [key, store] of Object.entries(zs)) {
            if (!stores.has(`zustand:${key}`) && typeof store.getState === 'function') {
                stores.set(`zustand:${key}`, { name: key, type: 'zustand', getState: () => store.getState() });
            }
        }
    }
}
export function getStoreState(path, type) {
    autoDetectStores();
    if (stores.size === 0) {
        return JSON.stringify({ error: 'No stores registered. Call registerStore() or expose __REDUX_STORE__/__ZUSTAND_STORES__' });
    }
    const results = {};
    for (const [key, reg] of stores) {
        if (type && reg.type !== type)
            continue;
        try {
            let state = reg.getState();
            if (path) {
                state = resolvePath(state, path);
            }
            results[key] = state;
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            results[key] = { __agent_error: msg };
        }
    }
    const keys = Object.keys(results);
    if (keys.length === 0) {
        return JSON.stringify({ error: `No stores of type '${type}' found` });
    }
    if (keys.length === 1) {
        return safeStringify({ type: stores.get(keys[0]).type, state: results[keys[0]] });
    }
    return safeStringify({ stores: results });
}
export function dispatchAction(opts) {
    autoDetectStores();
    let reduxStore;
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
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return JSON.stringify({ error: `Dispatch failed: ${msg}` });
    }
}
