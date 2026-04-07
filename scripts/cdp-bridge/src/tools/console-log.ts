import type { CDPClient } from '../cdp-client.js';
import { okResult, failResult, withConnection } from '../utils.js';

export function createConsoleLogHandler(getClient: () => CDPClient) {
  return withConnection(getClient, async (args: { level: string; limit: number; clear: boolean }, client) => {
    if (args.clear) {
      const clearResult = await client.evaluate(client.helperExpr('clearConsole()'));
      if (clearResult.error) {
        return failResult(`Failed to clear console: ${clearResult.error}`);
      }
      return okResult({ cleared: true });
    }

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const level = args.level ?? 'all';

    const opts = JSON.stringify({ level, limit });
    const result = await client.evaluate(client.helperExpr(`getConsole(${opts})`));

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

    let entries: unknown[];
    if (Array.isArray(parsed)) {
      entries = parsed;
    } else if (parsed && typeof parsed === 'object' && 'entries' in parsed && Array.isArray((parsed as { entries: unknown[] }).entries)) {
      entries = (parsed as { entries: unknown[] }).entries;
    } else {
      return failResult('Unexpected response from getConsole — expected array or { entries }');
    }

    return okResult({ count: entries.length, entries });
  });
}
