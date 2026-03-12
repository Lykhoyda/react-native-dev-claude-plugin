import { okResult, failResult, withConnection } from '../utils.js';
const RELOAD_WAIT_MS = 15000;
const POLL_INTERVAL_MS = 500;
export function createReloadHandler(getClient) {
    return withConnection(getClient, async (_args, client) => {
        const genBefore = client.connectionGeneration;
        try {
            const result = await client.evaluate('(function() { var ds = typeof __turboModuleProxy === "function" ? __turboModuleProxy("DevSettings") : null; if (!ds) try { ds = require("react-native").DevSettings; } catch(e) {} if (ds && ds.reload) ds.reload(); else throw new Error("DevSettings not available"); })()');
            if (result.error) {
                return failResult(`Reload failed: ${result.error}`);
            }
        }
        catch (evalErr) {
            const msg = evalErr instanceof Error ? evalErr.message : String(evalErr);
            const isExpectedDisconnect = msg.includes('WebSocket closed') ||
                msg.includes('WebSocket not connected') ||
                msg.includes('timeout');
            if (!isExpectedDisconnect) {
                return failResult(`Reload failed unexpectedly: ${msg}`);
            }
        }
        const start = Date.now();
        while (Date.now() - start < RELOAD_WAIT_MS) {
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
            if (client.isConnected && client.helpersInjected && client.connectionGeneration > genBefore) {
                return okResult({ reloaded: true, type: 'full', reconnected: true });
            }
            if (client.isConnected && client.connectionGeneration === genBefore) {
                const check = await client.evaluate('typeof globalThis.__RN_AGENT');
                if (check.value === 'undefined') {
                    const ok = await client.reinjectHelpers();
                    if (ok) {
                        return okResult({ reloaded: true, type: 'full', reconnected: true }, { meta: { note: 'Bridgeless reload — WS stayed open, helpers re-injected.' } });
                    }
                }
            }
        }
        if (client.isConnected && !client.helpersInjected) {
            await client.reinjectHelpers();
        }
        if (!client.isConnected) {
            return okResult({ reloaded: true, type: 'full', reconnected: false }, { meta: { warning: 'Reload triggered but reconnection timed out. Call cdp_status to check state.' } });
        }
        return okResult({ reloaded: true, type: 'full', reconnected: true });
    });
}
