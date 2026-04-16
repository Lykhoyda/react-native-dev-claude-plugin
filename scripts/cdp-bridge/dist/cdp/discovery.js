import { execFileSync } from 'node:child_process';
import { logger } from '../logger.js';
export const DISCOVERY_TIMEOUT_MS = 1500;
export const USER_METRO_PORT = process.env.RN_METRO_PORT ? parseInt(process.env.RN_METRO_PORT, 10) : null;
export const DEFAULT_PORTS = [
    ...(USER_METRO_PORT && !isNaN(USER_METRO_PORT) ? [USER_METRO_PORT] : []),
    8081, 8082, 19000, 19006,
];
export async function discoverMetroPort(ports, timeout) {
    for (const p of ports) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        try {
            const resp = await fetch(`http://127.0.0.1:${p}/status`, { signal: ctrl.signal });
            const text = await resp.text();
            if (text.includes('packager-status:running')) {
                return p;
            }
        }
        catch {
            // Port not available, continue scanning
        }
        finally {
            clearTimeout(timer);
        }
    }
    return null;
}
export async function fetchTargets(port, timeout) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
        const resp = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: ctrl.signal });
        return (await resp.json());
    }
    catch (err) {
        throw new Error(`Failed to list CDP targets on port ${port}: ${err instanceof Error ? err.message : err}`);
    }
    finally {
        clearTimeout(timer);
    }
}
export function filterValidTargets(targets) {
    return targets
        .filter(t => !!t.webSocketDebuggerUrl && !t.title?.includes('Experimental') &&
        (t.vm === 'Hermes' || t.title?.includes('React Native') || t.description?.includes('React Native')))
        .map(t => ({
        ...t,
        webSocketDebuggerUrl: t.webSocketDebuggerUrl
            ?.replace(/\[::1\]/g, '127.0.0.1')
            ?.replace(/\[::\]/g, '127.0.0.1'),
    }));
}
export function inferPlatforms(targets) {
    let androidPackages = null;
    try {
        const out = execFileSync('adb', ['shell', 'pm', 'list', 'packages'], {
            timeout: 3000,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        androidPackages = new Set(out.split('\n')
            .map(line => line.replace('package:', '').trim())
            .filter(Boolean));
    }
    catch {
        // adb not available or no device — all targets treated as iOS
    }
    for (const t of targets) {
        if (androidPackages?.has(t.description ?? '')) {
            t.platform = 'android';
        }
        else {
            t.platform = 'ios';
        }
    }
}
export function selectTarget(validTargets, platformFilter) {
    let filteredTargets = validTargets;
    let warning;
    if (platformFilter) {
        const pf = platformFilter.toLowerCase();
        let platformMatched = validTargets.filter(t => t.platform === pf);
        if (platformMatched.length === 0) {
            platformMatched = validTargets.filter(t => {
                const haystack = `${t.title ?? ''} ${t.description ?? ''} ${t.vm ?? ''}`.toLowerCase();
                return haystack.includes(pf);
            });
        }
        if (platformMatched.length > 0) {
            filteredTargets = platformMatched;
        }
        else {
            warning = `Platform filter "${platformFilter}" matched no targets (available: ${validTargets.map(t => `${t.description || t.id} [${t.platform ?? '?'}]`).join(', ')}). Connecting to best available target.`;
        }
    }
    const sorted = [...filteredTargets].sort((a, b) => {
        const aPage = parseInt(a.id?.split('-')[1] ?? '0', 10);
        const bPage = parseInt(b.id?.split('-')[1] ?? '0', 10);
        return bPage - aPage;
    });
    return { targets: sorted, warning };
}
export async function discover(currentPort, platformFilter) {
    const ports = [...new Set([currentPort, ...DEFAULT_PORTS])];
    logger.debug('CDP', `Discovering Metro on ports: ${ports.join(', ')}${platformFilter ? ` (platform: ${platformFilter})` : ''}`);
    const metroPort = await discoverMetroPort(ports, DISCOVERY_TIMEOUT_MS);
    if (!metroPort) {
        throw new Error('Metro not found on ports ' + ports.join(', ') +
            '. Is the dev server running? Try: npx expo start or npx react-native start');
    }
    logger.info('CDP', `Metro found on port ${metroPort}`);
    const raw = await fetchTargets(metroPort, DISCOVERY_TIMEOUT_MS * 2);
    const validTargets = filterValidTargets(raw).filter(t => {
        try {
            const { hostname } = new URL(t.webSocketDebuggerUrl);
            return hostname === '127.0.0.1' || hostname === 'localhost';
        }
        catch {
            return false;
        }
    });
    if (validTargets.length === 0) {
        throw new Error('No Hermes debug target found. Is the app running? Is Hermes enabled?');
    }
    inferPlatforms(validTargets);
    const { targets: sorted, warning } = selectTarget(validTargets, platformFilter);
    logger.debug('CDP', `Found ${sorted.length} valid target(s): ${sorted.map(t => `${t.id} (${t.title}, platform=${t.platform ?? '?'})`).join(', ')}`);
    return { port: metroPort, targets: sorted, warning };
}
export async function discoverForList(currentPort, portHint) {
    const ports = [...new Set([portHint ?? currentPort, ...DEFAULT_PORTS])];
    const metroPort = await discoverMetroPort(ports, DISCOVERY_TIMEOUT_MS);
    if (!metroPort) {
        throw new Error('Metro not found on ports ' + ports.join(', '));
    }
    const raw = await fetchTargets(metroPort, DISCOVERY_TIMEOUT_MS * 2);
    const targets = filterValidTargets(raw);
    inferPlatforms(targets);
    return { port: metroPort, targets };
}
