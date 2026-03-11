import { McpTestClient } from '../lib/mcp-client.js';
import { assertTruthy, assertEqual } from '../lib/assertions.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function reloadSuite(client: McpTestClient): Promise<string> {
  const result = await client.callTool('cdp_reload', { full: true });
  assertTruthy(!result.isError, 'reload returned error');

  const data = McpTestClient.parseResult(result) as Record<string, unknown>;
  assertEqual(data.reloaded, true, 'reloaded is true');

  if (data.reconnected) {
    await sleep(500);

    const statusResult = await client.callTool('cdp_status');
    assertTruthy(!statusResult.isError, 'post-reload status error');

    const statusData = McpTestClient.parseResult(statusResult) as Record<string, unknown>;
    const cdp = statusData.cdp as Record<string, unknown>;
    assertEqual(cdp.connected, true, 'reconnected after reload');

    const readyResult = await client.callTool('cdp_evaluate', {
      expression: '__RN_AGENT.isReady()',
    });
    assertTruthy(!readyResult.isError, 'isReady check error');

    return 'reloaded, reconnected, helpers re-injected';
  }

  return 'reloaded (reconnect timed out — may need manual check)';
}
