import type { CDPClient } from './cdp-client.js';

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: true;
};

export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text' as const, text }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: 'text' as const, text }], isError: true as const };
}

export type ToolHandler<T> = (args: T, client: CDPClient) => Promise<ToolResult>;

export function withConnection<T>(
  getClient: () => CDPClient,
  handler: ToolHandler<T>,
  options: { requireHelpers?: boolean } = {},
): (args: T) => Promise<ToolResult> {
  const { requireHelpers = true } = options;

  return async (args: T): Promise<ToolResult> => {
    try {
      const client = getClient();
      if (!client.isConnected) {
        return errorResult('Not connected. Call cdp_status first to connect.');
      }
      if (requireHelpers && !client.helpersInjected) {
        return errorResult('Helpers not injected. Call cdp_status to initialize.');
      }
      return await handler(args, client);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  };
}
