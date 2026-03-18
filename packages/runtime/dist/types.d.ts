export interface NavRef {
    getRootState(): unknown;
    navigate(screen: string, params?: unknown): void;
    dispatch(action: unknown): void;
    getCurrentRoute?(): {
        name: string;
        params?: unknown;
    } | undefined;
}
export interface StoreRegistration {
    name: string;
    type: 'redux' | 'zustand' | 'react-query';
    getState: () => unknown;
    dispatch?: (action: unknown) => void;
}
export interface BridgeAPI {
    __v: number;
    getNavState(): string;
    navigateTo(screen: string, params?: unknown): string;
    getStoreState(path?: string, type?: string): string;
    dispatchAction(opts: {
        action: string;
        payload?: unknown;
        readPath?: string;
    }): string;
    getConsole(opts?: {
        level?: string;
        limit?: number;
    }): string;
    clearConsole(): string;
    getErrors(): string;
    clearErrors(): string;
}
