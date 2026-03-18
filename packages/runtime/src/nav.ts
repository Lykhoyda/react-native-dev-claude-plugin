import type { NavRef } from './types';
import { safeStringify } from './utils';

let _navRef: NavRef | null = null;

export function registerNavRef(ref: NavRef): void {
  _navRef = ref;
}

function getRef(): NavRef | null {
  if (_navRef) return _navRef;
  const g = globalThis as Record<string, unknown>;
  if (g.__NAV_REF__ && typeof (g.__NAV_REF__ as NavRef).getRootState === 'function') {
    return g.__NAV_REF__ as NavRef;
  }
  return null;
}

function simplifyState(state: unknown): unknown {
  if (!state || typeof state !== 'object') return null;
  const s = state as { routes?: unknown[]; index?: number };
  if (!Array.isArray(s.routes) || typeof s.index !== 'number') return null;

  const route = s.routes[s.index] as { name?: string; params?: unknown; state?: unknown } | undefined;
  if (!route) return null;

  const result: Record<string, unknown> = {
    routeName: route.name,
    params: route.params ?? {},
    stack: (s.routes as Array<{ name: string }>).map((r) => r.name),
    index: s.index,
  };
  if (route.state) {
    result.nested = simplifyState(route.state);
  }
  return result;
}

export function getNavState(): string {
  const ref = getRef();
  if (!ref) {
    return JSON.stringify({ error: 'No navigation ref registered. Call registerNavRef() or set globalThis.__NAV_REF__' });
  }
  try {
    const rootState = ref.getRootState();
    if (!rootState) {
      return JSON.stringify({ error: 'Navigation state not ready' });
    }
    const simplified = simplifyState(rootState);
    return safeStringify(simplified);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ error: `Navigation state error: ${msg}` });
  }
}

export function navigateTo(screen: string, params?: unknown): string {
  const ref = getRef();
  if (!ref) {
    return JSON.stringify({ error: 'No navigation ref registered' });
  }
  try {
    const rootState = ref.getRootState() as {
      routes: Array<{ name: string; state?: unknown }>;
      index: number;
    } | null;
    if (!rootState) {
      return JSON.stringify({ error: 'Navigation state not ready' });
    }

    function findPath(
      navState: { routes: Array<{ name: string; state?: unknown }>; index: number },
      target: string,
      path: Array<{ name: string; index: number }>,
    ): Array<{ name: string; index: number }> | null {
      for (let i = 0; i < navState.routes.length; i++) {
        const route = navState.routes[i];
        if (route.name === target) {
          return [...path, { name: route.name, index: i }];
        }
        if (route.state && typeof route.state === 'object') {
          const nested = route.state as typeof navState;
          if (Array.isArray(nested.routes)) {
            const found = findPath(nested, target, [...path, { name: route.name, index: i }]);
            if (found) return found;
          }
        }
      }
      return null;
    }

    const targetPath = findPath(rootState, screen, []);
    if (!targetPath || targetPath.length === 0) {
      ref.navigate(screen, params as never);
      return JSON.stringify({ navigated: true, screen, method: 'direct' });
    }

    if (targetPath.length === 1) {
      ref.navigate(screen, params as never);
    } else {
      let navParams: unknown = params;
      for (let i = targetPath.length - 1; i > 0; i--) {
        navParams = { screen: targetPath[i].name, params: navParams };
      }
      ref.navigate(targetPath[0].name, navParams as never);
    }
    return JSON.stringify({ navigated: true, screen, path: targetPath.map((p) => p.name) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ error: `Navigate failed: ${msg}` });
  }
}
