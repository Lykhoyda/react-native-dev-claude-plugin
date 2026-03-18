import type { NavRef } from './types';
export declare function registerNavRef(ref: NavRef): void;
export declare function getNavState(): string;
export declare function navigateTo(screen: string, params?: unknown): string;
