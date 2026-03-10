import type { CDPClient } from '../cdp-client.js';
import { textResult, errorResult, withConnection } from '../utils.js';

export function createEvaluateHandler(getClient: () => CDPClient) {
  return withConnection(getClient, async (args: { expression: string; awaitPromise: boolean }, client) => {
    const result = await client.evaluate(args.expression, args.awaitPromise);

    if (result.error) {
      return errorResult(`Evaluation error: ${result.error}`);
    }

    const text = typeof result.value === 'string'
      ? result.value
      : JSON.stringify(result.value, null, 2);

    return textResult(text ?? 'undefined');
  });
}
