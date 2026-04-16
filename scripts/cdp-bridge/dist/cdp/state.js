import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CDP_ACTIVE_FLAG = join(tmpdir(), 'rn-dev-agent-cdp-active');
const CDP_SESSION_FILE = join(tmpdir(), 'rn-dev-agent-cdp-session.json');
const RESET_DEFAULTS = {
    _state: 'disconnected',
    _helpersInjected: false,
    _bridgeDetected: false,
    _bridgeVersion: null,
    _connectedTarget: null,
    _logDomainEnabled: false,
    _profilerAvailable: false,
    _heapProfilerAvailable: false,
};
export function resetState(s) {
    Object.assign(s, RESET_DEFAULTS);
    s._scripts.clear();
}
export function setActiveFlag(port, target) {
    try {
        writeFileSync(CDP_ACTIVE_FLAG, String(process.pid));
    }
    catch { /* best-effort */ }
    try {
        writeFileSync(CDP_SESSION_FILE, JSON.stringify({
            port,
            platform: target?.platform ?? null,
            target: target?.title ?? null,
            pid: process.pid,
            connectedAt: new Date().toISOString(),
        }));
    }
    catch { /* best-effort */ }
}
export function clearActiveFlag() {
    try {
        unlinkSync(CDP_ACTIVE_FLAG);
    }
    catch { /* may not exist */ }
    try {
        unlinkSync(CDP_SESSION_FILE);
    }
    catch { /* may not exist */ }
}
export function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
