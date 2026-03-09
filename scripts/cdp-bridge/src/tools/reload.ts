import type { CDPClient } from '../cdp-client.js';
import { textResult, errorResult } from '../types.js';

const RELOAD_WAIT_MS = 15000;
const POLL_INTERVAL_MS = 500;

export function createReloadHandler(getClient: () => CDPClient) {
  return async (args: { full: boolean }) => {
    try {
      const client = getClient();
      if (!client.isConnected) {
        return errorResult('Not connected. Call cdp_status first to connect.');
      }

      const genBefore = client.connectionGeneration;

      try {
        await client.evaluate(
          'require("react-native").DevSettings.reload()'
        );
      } catch {
        // Expected: WS closes when reload kills the JS bundle (D6)
      }

      const start = Date.now();
      while (Date.now() - start < RELOAD_WAIT_MS) {
        await sleep(POLL_INTERVAL_MS);
        if (client.isConnected && client.helpersInjected && client.connectionGeneration > genBefore) {
          return textResult(JSON.stringify({
            reloaded: true,
            type: 'full',
            reconnected: true,
          }));
        }
      }

      return textResult(JSON.stringify({
        reloaded: true,
        type: 'full',
        reconnected: client.isConnected,
        warning: client.isConnected
          ? undefined
          : 'Reload triggered but reconnection timed out. Call cdp_status to check state.',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
