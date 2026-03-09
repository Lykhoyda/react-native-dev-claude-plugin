import { textResult, errorResult } from '../types.js';
const ACTION_EXPRESSIONS = {
    reload: 'require("react-native").DevSettings.reload()',
    toggleInspector: 'require("react-native").DevSettings.toggleElementInspector()',
    togglePerfMonitor: 'require("react-native").DevSettings.togglePerformanceMonitor()',
    dismissRedBox: 'require("react-native/Libraries/LogBox/Data/LogBoxData").clear()',
};
export function createDevSettingsHandler(getClient) {
    return async (args) => {
        try {
            const client = getClient();
            if (!client.isConnected) {
                return errorResult('Not connected. Call cdp_status first to connect.');
            }
            if (!client.helpersInjected) {
                return errorResult('Helpers not injected. Call cdp_status to initialize.');
            }
            const expression = ACTION_EXPRESSIONS[args.action];
            try {
                const result = await client.evaluate(expression);
                if (result.error) {
                    return errorResult(`Dev settings error: ${result.error}`);
                }
            }
            catch (evalErr) {
                const msg = evalErr instanceof Error ? evalErr.message : String(evalErr);
                const isDisconnect = msg.includes('WebSocket closed') || msg.includes('WebSocket not connected');
                if (args.action === 'reload' && isDisconnect) {
                    return textResult(JSON.stringify({
                        action: args.action,
                        executed: true,
                        note: 'Connection will close — use cdp_status to reconnect.',
                    }));
                }
                throw evalErr;
            }
            return textResult(JSON.stringify({
                action: args.action,
                executed: true,
            }));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(message);
        }
    };
}
