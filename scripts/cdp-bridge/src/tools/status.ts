import type { CDPClient } from '../cdp-client.js';
import type { StatusResult } from '../types.js';
import { textResult, errorResult } from '../types.js';

export function createStatusHandler(
  getClient: () => CDPClient,
  setClient: (c: CDPClient) => void,
  createClient: (port: number) => CDPClient,
) {
  return async (args: { metroPort?: number }) => {
    try {
      let client = getClient();

      if (args.metroPort && args.metroPort !== client.metroPort) {
        await client.disconnect();
        client = createClient(args.metroPort);
        setClient(client);
      }

      if (!client.isConnected) {
        await client.autoConnect(args.metroPort);
      }

      let appInfo: Record<string, unknown> | null = null;
      let errorCount = 0;
      let fiberTree = false;
      let hasRedBox = false;

      if (client.helpersInjected) {
        const appResult = await client.evaluate('__RN_AGENT.getAppInfo()');
        if (appResult.value && typeof appResult.value === 'string') {
          try {
            appInfo = JSON.parse(appResult.value);
          } catch {
            appInfo = null;
          }
        }

        const errorResult_ = await client.evaluate('JSON.parse(__RN_AGENT.getErrors()).length');
        if (typeof errorResult_.value === 'number') {
          errorCount = errorResult_.value;
        }

        const readyResult = await client.evaluate('__RN_AGENT.isReady()');
        fiberTree = readyResult.value === true;

        const treeCheck = await client.evaluate('JSON.parse(__RN_AGENT.getTree(1)).warning');
        hasRedBox = treeCheck.value === 'APP_HAS_REDBOX';
      }

      const status: StatusResult = {
        metro: {
          running: true,
          port: client.metroPort,
        },
        cdp: {
          connected: client.isConnected,
          device: client.connectedTarget?.title ?? null,
          pageId: client.connectedTarget?.id ?? null,
        },
        app: {
          platform: (appInfo?.platform as string) ?? null,
          dev: (appInfo?.__DEV__ as boolean) ?? null,
          hermes: (appInfo?.hermes as boolean) ?? null,
          rnVersion: appInfo?.rnVersion ? JSON.stringify(appInfo.rnVersion) : null,
          dimensions: (appInfo?.dimensions as { width: number; height: number }) ?? null,
          hasRedBox,
          isPaused: client.isPaused,
          errorCount,
        },
        capabilities: {
          networkDomain: client.networkMode === 'cdp',
          fiberTree,
          networkFallback: client.networkMode === 'hook',
        },
      };

      return textResult(JSON.stringify(status, null, 2));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  };
}
