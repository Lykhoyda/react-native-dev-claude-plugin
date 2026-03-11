import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CDP_BRIDGE_PATH = resolve(__dirname, '..', '..', '..', '..', 'scripts', 'cdp-bridge', 'dist', 'index.js');

export interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export class McpTestClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client({ name: 'test-harness', version: '1.0.0' }, {});
  }

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: 'node',
      args: [CDP_BRIDGE_PATH],
    });
    await this.client.connect(this.transport);
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    const result = await this.client.callTool({ name, arguments: args });
    return result as ToolCallResult;
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  static parseResult(result: ToolCallResult): unknown {
    const text = result.content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('');
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
