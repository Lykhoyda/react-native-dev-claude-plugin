import { safeStringify } from './utils';
const MAX_ENTRIES = 200;
let buffer = [];
let installed = false;
export function installConsolePatch() {
    if (installed)
        return;
    if (typeof globalThis.console === 'undefined')
        return;
    installed = true;
    const levels = ['log', 'warn', 'error', 'info', 'debug'];
    for (const level of levels) {
        const original = globalThis.console[level];
        if (typeof original !== 'function')
            continue;
        globalThis.console[level] = (...args) => {
            buffer.push({
                level,
                message: args.map((a) => (typeof a === 'string' ? a : safeStringify(a, 2000))).join(' '),
                timestamp: Date.now(),
            });
            if (buffer.length > MAX_ENTRIES) {
                buffer = buffer.slice(-MAX_ENTRIES);
            }
            original.apply(globalThis.console, args);
        };
    }
}
export function getConsole(opts) {
    var _a, _b;
    const level = (_a = opts === null || opts === void 0 ? void 0 : opts.level) !== null && _a !== void 0 ? _a : 'all';
    const limit = (_b = opts === null || opts === void 0 ? void 0 : opts.limit) !== null && _b !== void 0 ? _b : 50;
    let filtered = buffer;
    if (level !== 'all') {
        filtered = buffer.filter((e) => e.level === level);
    }
    const entries = filtered.slice(-limit);
    return JSON.stringify({ entries, total: filtered.length, shown: entries.length });
}
export function clearConsole() {
    buffer = [];
    return JSON.stringify({ cleared: true });
}
