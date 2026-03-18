import { safeStringify } from './utils';
const MAX_ERRORS = 50;
let errors = [];
let installed = false;
export function installErrorTracking() {
    if (installed)
        return;
    installed = true;
    const g = globalThis;
    if (typeof g.ErrorUtils === 'object' && g.ErrorUtils !== null) {
        const eu = g.ErrorUtils;
        const prev = eu.getGlobalHandler();
        eu.setGlobalHandler((error, isFatal) => {
            var _a;
            errors.push({
                message: `${isFatal ? '[FATAL] ' : ''}${error.message}`,
                stack: (_a = error.stack) !== null && _a !== void 0 ? _a : null,
                timestamp: Date.now(),
                type: 'exception',
            });
            if (errors.length > MAX_ERRORS)
                errors = errors.slice(-MAX_ERRORS);
            prev(error, isFatal);
        });
    }
    if (typeof g.HermesInternal === 'object' && g.HermesInternal !== null) {
        const hermes = g.HermesInternal;
        if (typeof hermes.enablePromiseRejectionTracker === 'function') {
            hermes.enablePromiseRejectionTracker({
                allRejections: true,
                onUnhandled: (_id, reason) => {
                    var _a;
                    const msg = reason instanceof Error ? reason.message : safeStringify(reason, 500);
                    const stack = reason instanceof Error ? ((_a = reason.stack) !== null && _a !== void 0 ? _a : null) : null;
                    errors.push({ message: msg, stack, timestamp: Date.now(), type: 'rejection' });
                    if (errors.length > MAX_ERRORS)
                        errors = errors.slice(-MAX_ERRORS);
                },
            });
        }
    }
}
export function getErrors() {
    return JSON.stringify(errors);
}
export function clearErrors() {
    errors = [];
    return JSON.stringify({ cleared: true });
}
