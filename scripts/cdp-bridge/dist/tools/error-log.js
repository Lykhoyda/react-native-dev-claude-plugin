import { textResult, errorResult } from '../types.js';
export function createErrorLogHandler(getClient) {
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
                const clearResult = await client.evaluate('__RN_AGENT.clearErrors()');
                if (clearResult.error) {
                    return errorResult(`Failed to clear errors: ${clearResult.error}`);
                }
                return textResult(JSON.stringify({ cleared: true }));
            }
            const result = await client.evaluate('__RN_AGENT.getErrors()');
            if (result.error) {
                return errorResult(`Error log error: ${result.error}`);
            }
            if (typeof result.value !== 'string') {
                return errorResult('Unexpected response from getErrors — expected JSON string');
            }
            const parsed = JSON.parse(result.value);
            if (!Array.isArray(parsed)) {
                return errorResult('Unexpected response from getErrors — expected array');
            }
            if (parsed.length === 0) {
                return textResult(JSON.stringify({
                    errors: [],
                    count: 0,
                    hint: 'No JS errors captured. If the app crashed, the error may be native — check: adb logcat -b crash (Android) or xcrun simctl spawn booted log stream (iOS)',
                }));
            }
            return textResult(JSON.stringify({ errors: parsed, count: parsed.length }));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(message);
        }
    };
}
