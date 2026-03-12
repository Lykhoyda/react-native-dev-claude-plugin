import { McpTestClient } from '../lib/mcp-client.js';
import { assertTruthy, assertEqual } from '../lib/assertions.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function interactSuite(client: McpTestClient): Promise<string> {
  const treeResult = await client.callTool('cdp_component_tree', {
    filter: 'home-welcome',
    depth: 2,
  });
  assertTruthy(!treeResult.isError, 'component_tree check failed');

  const pressResult = await client.callTool('cdp_interact', {
    action: 'press',
    testID: 'home-welcome',
  });
  const pressData = McpTestClient.parseResult(pressResult) as Record<string, unknown>;

  if (pressResult.isError) {
    const errorText = JSON.stringify(pressData);
    if (errorText.includes('no onPress') || errorText.includes('not found')) {
      return 'interact tool responds correctly (no onPress on target — expected)';
    }
    assertTruthy(false, `unexpected interact error: ${errorText}`);
  }

  assertEqual(pressData.action, 'press', 'action matches');
  await sleep(300);

  return 'press action dispatched via fiber tree';
}
