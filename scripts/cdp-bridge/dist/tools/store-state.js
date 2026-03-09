import { textResult, errorResult } from '../types.js';
export function createStoreStateHandler(getClient) {
    return async (args) => {
        try {
            const client = getClient();
            if (!client.isConnected) {
                return errorResult('Not connected. Call cdp_status first to connect.');
            }
            if (!client.helpersInjected) {
                return errorResult('Helpers not injected. Call cdp_status to initialize.');
            }
            const pathArg = args.path !== undefined ? JSON.stringify(args.path) : '';
            const expression = args.path !== undefined
                ? `__RN_AGENT.getStoreState(${pathArg})`
                : '__RN_AGENT.getStoreState()';
            const result = await client.evaluate(expression);
            if (result.error) {
                return errorResult(`Store state error: ${result.error}`);
            }
            if (typeof result.value !== 'string') {
                return errorResult('Unexpected response from getStoreState — expected JSON string');
            }
            const raw = result.value;
            if (raw.endsWith('...[TRUNCATED]')) {
                return textResult(JSON.stringify({
                    warning: 'TRUNCATED',
                    message: 'Store state exceeds 30KB. Use a path parameter to query a specific slice.',
                    partial: raw,
                }));
            }
            let parsed;
            try {
                parsed = JSON.parse(raw);
            }
            catch {
                return textResult(raw);
            }
            if (parsed !== null && typeof parsed === 'object' && 'error' in parsed) {
                const obj = parsed;
                return errorResult(`Store state error: ${obj.error}`);
            }
            return textResult(raw);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(message);
        }
    };
}
