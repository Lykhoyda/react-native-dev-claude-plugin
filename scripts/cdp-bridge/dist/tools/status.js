import { textResult, errorResult } from '../types.js';
export function createStatusHandler(getClient, setClient, createClient) {
    return async (args) => {
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
            let appInfo = null;
            let errorCount = 0;
            let fiberTree = false;
            let hasRedBox = false;
            if (client.helpersInjected) {
                const appResult = await client.evaluate('__RN_AGENT.getAppInfo()');
                if (appResult.value && typeof appResult.value === 'string') {
                    try {
                        appInfo = JSON.parse(appResult.value);
                    }
                    catch {
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
            const status = {
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
                    platform: appInfo?.platform ?? null,
                    dev: appInfo?.__DEV__ ?? null,
                    hermes: appInfo?.hermes ?? null,
                    rnVersion: appInfo?.rnVersion ? JSON.stringify(appInfo.rnVersion) : null,
                    dimensions: appInfo?.dimensions ?? null,
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(message);
        }
    };
}
