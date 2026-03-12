import type { CDPClient } from '../cdp-client.js';
import { okResult, failResult, withConnection } from '../utils.js';

export function createConsoleLogHandler(getClient: () => CDPClient) {
  return withConnection(getClient, async (args: { level: string; limit: number; clear: boolean }, client) => {
    if (args.clear) {
      const clearResult = await client.evaluate('__RN_AGENT.clearConsole()');
      if (clearResult.error) {
        return failResult(`Failed to clear console: ${clearResult.error}`);
      }
      return okResult({ cleared: true });
    }

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const level = args.level ?? 'all';

    const result = await client.evaluate(
      `__RN_AGENT.getConsole(${JSON.stringify({ level, limit })})`,
    );

    if (result.error) {
      return failResult(`Console log error: ${result.error}`);
    }

    if (typeof result.value !== 'string') {
      return failResult('Unexpected response from getConsole — expected JSON string');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.value);
    } catch {
      return failResult(`Failed to parse console response: ${result.value.slice(0, 200)}`);
    }

    if (!Array.isArray(parsed)) {
      return failResult('Unexpected response from getConsole — expected array');
    }

    return okResult({ count: parsed.length, entries: parsed });
  });
}
