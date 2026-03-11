import { McpTestClient } from '../lib/mcp-client.js';
import { assertTruthy, assertEqual } from '../lib/assertions.js';

export async function devSettingsSuite(client: McpTestClient): Promise<string> {
  const result = await client.callTool('cdp_dev_settings', { action: 'togglePerfMonitor' });
  assertTruthy(!result.isError, 'dev_settings returned error');

  const data = McpTestClient.parseResult(result) as Record<string, unknown>;
  assertEqual(data.action, 'togglePerfMonitor', 'action matches');
  assertEqual(data.executed, true, 'executed is true');

  await client.callTool('cdp_dev_settings', { action: 'togglePerfMonitor' });

  return 'togglePerfMonitor ok';
}
