import type { CDPClient } from '../cdp-client.js';
import { textResult, errorResult } from '../types.js';

export function createNetworkLogHandler(getClient: () => CDPClient) {
  return async (args: { limit: number; filter?: string; clear: boolean }) => {
    try {
      const client = getClient();
      if (!client.isConnected) {
        return errorResult('Not connected. Call cdp_status first to connect.');
      }
      if (!client.helpersInjected) {
        return errorResult('Helpers not injected. Call cdp_status to initialize.');
      }

      if (args.clear) {
        client.networkBuffer.clear();
        return textResult(JSON.stringify({ cleared: true }));
      }

      const limit = Math.min(Math.max(args.limit, 1), 100);

      let entries = args.filter !== undefined
        ? client.networkBuffer.filter(e => e.url.includes(args.filter!))
        : client.networkBuffer.getLast(limit);

      if (args.filter !== undefined && entries.length > limit) {
        entries = entries.slice(-limit);
      }

      return textResult(JSON.stringify({
        mode: client.networkMode,
        count: entries.length,
        requests: entries,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  };
}
