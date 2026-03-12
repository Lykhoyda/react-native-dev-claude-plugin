import { McpTestClient } from '../lib/mcp-client.js';
import { assertTruthy, assertShape, assertEqual } from '../lib/assertions.js';

export async function evaluateSuite(client: McpTestClient): Promise<string> {
  const infoResult = await client.callTool('cdp_evaluate', {
    expression: '__RN_AGENT.getAppInfo()',
  });
  assertTruthy(!infoResult.isError, 'getAppInfo returned error');
  const infoData = McpTestClient.parseResult(infoResult) as Record<string, unknown>;
  const info = typeof infoData.value === 'string'
    ? JSON.parse(infoData.value) as Record<string, unknown>
    : infoData.value as Record<string, unknown>;
  assertShape(info, ['platform', 'hermes', '__DEV__'], 'appInfo shape');
  assertEqual(info.hermes, true, 'hermes enabled');
  assertEqual(info.__DEV__, true, 'dev mode');

  const navResult = await client.callTool('cdp_evaluate', {
    expression: 'typeof globalThis.__NAV_REF__',
  });
  assertTruthy(!navResult.isError, '__NAV_REF__ check error');
  const navData = McpTestClient.parseResult(navResult) as Record<string, unknown>;
  assertEqual(navData.value, 'object', '__NAV_REF__ type');

  const storeResult = await client.callTool('cdp_evaluate', {
    expression: 'typeof globalThis.__REDUX_STORE__',
  });
  assertTruthy(!storeResult.isError, '__REDUX_STORE__ check error');
  const storeData = McpTestClient.parseResult(storeResult) as Record<string, unknown>;
  assertEqual(storeData.value, 'object', '__REDUX_STORE__ type');

  return 'getAppInfo valid, globals accessible';
}
