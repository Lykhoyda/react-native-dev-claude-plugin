import { installConsolePatch, getConsole, clearConsole } from './console';
import { installErrorTracking, getErrors, clearErrors } from './errors';
import { getNavState, navigateTo, registerNavRef } from './nav';
import { getStoreState, dispatchAction, registerStore } from './store';
export { registerNavRef, registerStore };
const BRIDGE_VERSION = 1;
export function install() {
    const g = globalThis;
    if (typeof __DEV__ !== 'undefined' && !__DEV__)
        return;
    const existing = g.__RN_DEV_BRIDGE__;
    if (existing && existing.__v === BRIDGE_VERSION)
        return;
    installConsolePatch();
    installErrorTracking();
    const bridge = {
        __v: BRIDGE_VERSION,
        getNavState,
        navigateTo,
        getStoreState,
        dispatchAction,
        getConsole,
        clearConsole,
        getErrors,
        clearErrors,
    };
    g.__RN_DEV_BRIDGE__ = bridge;
}
