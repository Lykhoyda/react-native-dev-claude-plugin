import { textResult, errorResult } from '../types.js';
const LEVEL_ALIASES = {
    warn: 'warning',
};
const INTERNAL_PREFIX = '__RN_NET__:';
export function createConsoleLogHandler(getClient) {
    return async (args) => {
        try {
            const client = getClient();
            if (!client.isConnected) {
                return errorResult('Not connected. Call cdp_status first to connect.');
            }
            if (!client.helpersInjected) {
                return errorResult('Helpers not injected. Call cdp_status to initialize.');
            }
            if (args.clear) {
                client.consoleBuffer.clear();
                return textResult(JSON.stringify({ cleared: true }));
            }
            const limit = Math.min(Math.max(args.limit, 1), 200);
            const cdpLevel = LEVEL_ALIASES[args.level] ?? args.level;
            let entries = cdpLevel === 'all'
                ? client.consoleBuffer.getLast(limit)
                : client.consoleBuffer.filter(e => e.level === cdpLevel);
            entries = entries.filter(e => !e.text.startsWith(INTERNAL_PREFIX));
            if (entries.length > limit) {
                entries = entries.slice(-limit);
            }
            return textResult(JSON.stringify({
                count: entries.length,
                entries,
            }));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(message);
        }
    };
}
