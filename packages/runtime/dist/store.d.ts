import type { StoreRegistration } from './types';
export declare function registerStore(reg: StoreRegistration): void;
export declare function getStoreState(path?: string, type?: string): string;
export declare function dispatchAction(opts: {
    action: string;
    payload?: unknown;
    readPath?: string;
}): string;
