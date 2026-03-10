import type { CDPClient } from '../cdp-client.js';
import { textResult, errorResult, withConnection } from '../utils.js';

type DevAction = 'reload' | 'toggleInspector' | 'togglePerfMonitor' | 'dismissRedBox';

const ACTION_EXPRESSIONS: Record<DevAction, string> = {
  reload: 'require("react-native").DevSettings.reload()',
  toggleInspector: 'require("react-native").DevSettings.toggleElementInspector()',
  togglePerfMonitor: 'require("react-native").DevSettings.togglePerformanceMonitor()',
  dismissRedBox: 'require("react-native/Libraries/LogBox/Data/LogBoxData").clear()',
};

export function createDevSettingsHandler(getClient: () => CDPClient) {
  return withConnection(getClient, async (args: { action: DevAction }, client) => {
    const expression = ACTION_EXPRESSIONS[args.action];

    try {
      const result = await client.evaluate(expression);
      if (result.error) {
        return errorResult(`Dev settings error: ${result.error}`);
      }
    } catch (evalErr) {
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
  });
}
