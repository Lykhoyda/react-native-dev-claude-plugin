import { McpTestClient } from './lib/mcp-client.js';

async function main(): Promise<void> {
  const client = new McpTestClient();
  await client.connect();

  try {
    // Must connect first
    console.log('=== CONNECT ===');
    const statusResult0 = await client.callTool('cdp_status', {});
    console.log('Status:', statusResult0.content.map(c => c.text ?? '').join(''));

    // Issue 1: Console log returned 0 entries after navigating to Notifications
    console.log('\n=== DIAGNOSE: Console Log Empty ===');

    // First, trigger some console logs via evaluate
    await client.callTool('cdp_evaluate', {
      expression: `(function() { console.log('DIAG_LOG'); console.warn('DIAG_WARN'); console.error('DIAG_ERROR'); return 'logged'; })()`
    });

    // Wait for events to propagate
    await new Promise(r => setTimeout(r, 500));

    const consoleResult = await client.callTool('cdp_console_log', {});
    const consoleText = consoleResult.content.map(c => c.text ?? '').join('');
    console.log('Console result:', consoleText);

    // Check with limit
    const consoleLimited = await client.callTool('cdp_console_log', { limit: 50 });
    const consoleLimitedText = consoleLimited.content.map(c => c.text ?? '').join('');
    console.log('Console (limit 50):', consoleLimitedText);

    // Issue 2: cdp_interact returns failResult when onPress throws
    console.log('\n=== DIAGNOSE: Interact + Throwing Handler ===');

    // Navigate to ErrorLab
    await client.callTool('cdp_evaluate', {
      expression: `(function() { globalThis.__NAV_REF__.navigate('ErrorLab'); return 'nav'; })()`
    });
    await new Promise(r => setTimeout(r, 500));

    const throwResult = await client.callTool('cdp_interact', {
      action: 'press', testID: 'error-lab-throw'
    });
    const throwText = throwResult.content.map(c => c.text ?? '').join('');
    console.log('Interact throw result:', throwText);
    console.log('isError flag:', throwResult.isError);

    // Issue 3: dismissRedBox when no RedBox active
    console.log('\n=== DIAGNOSE: dismissRedBox No RedBox ===');

    // Navigate away from ErrorLab first
    await client.callTool('cdp_evaluate', {
      expression: `(function() { globalThis.__NAV_REF__.navigate('HomeTab'); return 'nav'; })()`
    });
    await new Promise(r => setTimeout(r, 500));

    const dismissResult = await client.callTool('cdp_dev_settings', {
      action: 'dismissRedBox'
    });
    const dismissText = dismissResult.content.map(c => c.text ?? '').join('');
    console.log('Dismiss result:', dismissText);

    // Check network log shape
    console.log('\n=== DIAGNOSE: Network Log Shape ===');
    const netResult = await client.callTool('cdp_network_log', {});
    const netText = netResult.content.map(c => c.text ?? '').join('');
    console.log('Network result:', netText);

    // Check error log shape after the throw
    console.log('\n=== DIAGNOSE: Error Log Shape ===');
    const errResult = await client.callTool('cdp_error_log', {});
    const errText = errResult.content.map(c => c.text ?? '').join('');
    console.log('Error result:', errText);

    // Check status shape
    console.log('\n=== DIAGNOSE: Status Shape ===');
    const statusResult = await client.callTool('cdp_status', {});
    const statusText = statusResult.content.map(c => c.text ?? '').join('');
    console.log('Status result:', statusText);

  } finally {
    await client.close().catch(() => {});
  }
}

main().catch(err => {
  console.error('Diagnose error:', err);
  process.exit(1);
});
