import { textResult, errorResult } from '../types.js';
export function createEvaluateHandler(getClient) {
    return async (args) => {
        try {
            const client = getClient();
            if (!client.isConnected) {
                return errorResult('Not connected. Call cdp_status first to connect.');
            }
            const result = await client.evaluate(args.expression, args.awaitPromise);
            if (result.error) {
                return errorResult(`Evaluation error: ${result.error}`);
            }
            const text = typeof result.value === 'string'
                ? result.value
                : JSON.stringify(result.value, null, 2);
            return textResult(text ?? 'undefined');
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(message);
        }
    };
}
