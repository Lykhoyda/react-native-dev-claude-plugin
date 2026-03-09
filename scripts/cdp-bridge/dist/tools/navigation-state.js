import { textResult, errorResult } from '../types.js';
export function createNavigationStateHandler(getClient) {
    return async () => {
        try {
            const client = getClient();
            if (!client.isConnected) {
                return errorResult('Not connected. Call cdp_status first to connect.');
            }
            if (!client.helpersInjected) {
                return errorResult('Helpers not injected. Call cdp_status to initialize.');
            }
            const result = await client.evaluate('__RN_AGENT.getNavState()');
            if (result.error) {
                return errorResult(`Navigation state error: ${result.error}`);
            }
            if (typeof result.value !== 'string') {
                return errorResult('Unexpected response from getNavState — expected JSON string');
            }
            const parsed = JSON.parse(result.value);
            const obj = parsed;
            if (obj.error) {
                return errorResult(`Navigation state error: ${obj.error}`);
            }
            return textResult(result.value);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(message);
        }
    };
}
