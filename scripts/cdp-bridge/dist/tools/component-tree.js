import { textResult, errorResult } from '../types.js';
export function createComponentTreeHandler(getClient) {
    return async (args) => {
        try {
            const client = getClient();
            if (!client.isConnected) {
                return errorResult('Not connected. Call cdp_status first to connect.');
            }
            if (!client.helpersInjected) {
                return errorResult('Helpers not injected. Call cdp_status to initialize.');
            }
            const depth = Math.min(Math.max(args.depth, 1), 6);
            const filterArg = args.filter !== undefined ? JSON.stringify(args.filter) : 'undefined';
            const result = await client.evaluate(`__RN_AGENT.getTree(${depth}, ${filterArg})`);
            if (result.error) {
                return errorResult(`Component tree error: ${result.error}`);
            }
            if (typeof result.value !== 'string') {
                return errorResult('Unexpected response from getTree — expected JSON string');
            }
            const parsed = JSON.parse(result.value);
            const obj = parsed;
            if (obj.error) {
                return errorResult(`Component tree error: ${obj.error}`);
            }
            if (obj.warning === 'APP_HAS_REDBOX') {
                return textResult(JSON.stringify({
                    warning: 'APP_HAS_REDBOX',
                    message: obj.message ?? 'App is showing an error screen. Use cdp_error_log to read the error, fix the code, then cdp_reload.',
                }));
            }
            return textResult(result.value);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(message);
        }
    };
}
