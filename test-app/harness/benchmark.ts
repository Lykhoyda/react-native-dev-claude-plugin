import { McpTestClient } from './lib/mcp-client.js';
import type { ToolCallResult } from './lib/mcp-client.js';

interface BenchmarkResult {
  tool: string;
  step: string;
  durationMs: number;
  status: 'ok' | 'warn' | 'fail';
  dataSize: number;
  notes: string;
}

const results: BenchmarkResult[] = [];

async function bench(
  client: McpTestClient,
  tool: string,
  step: string,
  args: Record<string, unknown> = {},
): Promise<{ raw: ToolCallResult; parsed: unknown; ms: number }> {
  const start = Date.now();
  let raw: ToolCallResult;
  let status: 'ok' | 'warn' | 'fail' = 'ok';
  let notes = '';

  try {
    raw = await client.callTool(tool, args);
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ tool, step, durationMs: ms, status: 'fail', dataSize: 0, notes: `THREW: ${msg}` });
    console.log(`  ❌ ${step} (${tool}) — ${ms}ms — THREW: ${msg}`);
    throw err;
  }

  const ms = Date.now() - start;
  const text = raw.content.map(c => c.text ?? '').join('');
  const dataSize = text.length;

  // Check envelope
  let parsed: unknown;
  try {
    const envelope = JSON.parse(text);
    if (envelope && typeof envelope === 'object') {
      if ('ok' in envelope) {
        if (envelope.ok === false) {
          status = 'fail';
          notes = `error: ${envelope.error ?? 'unknown'}`;
        } else if (envelope.meta?.warning) {
          status = 'warn';
          notes = `warning: ${envelope.meta.warning}`;
        }
        parsed = envelope.ok ? envelope.data : envelope;
      } else {
        // No envelope — inconsistency!
        status = 'warn';
        notes = 'MISSING ENVELOPE — raw JSON returned';
        parsed = envelope;
      }
    } else {
      parsed = envelope;
    }
  } catch {
    status = 'warn';
    notes = 'NON-JSON response';
    parsed = text;
  }

  results.push({ tool, step, durationMs: ms, status, dataSize, notes });

  const icon = status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : '❌';
  console.log(`  ${icon} ${step} (${tool}) — ${ms}ms — ${dataSize} bytes${notes ? ' — ' + notes : ''}`);

  return { raw, parsed, ms };
}

async function main(): Promise<void> {
  console.log('🔧 CDP Bridge Benchmark — Full 11-Tool Experiment\n');
  console.log('Connecting to MCP server...');
  const client = new McpTestClient();

  try {
    await client.connect();
    console.log('Connected.\n');

    // ═══════════════════════════════════════════
    // PHASE 1: Environment Check
    // ═══════════════════════════════════════════
    console.log('═══ PHASE 1: Environment Check ═══');
    const { parsed: statusData } = await bench(client, 'cdp_status', '1.1 Health check');
    console.log(`     Target: ${(statusData as Record<string, unknown>)?.target ?? 'unknown'}`);

    // ═══════════════════════════════════════════
    // PHASE 2: Read App State (Home screen)
    // ═══════════════════════════════════════════
    console.log('\n═══ PHASE 2: Read App State ═══');

    await bench(client, 'cdp_evaluate', '2.1 Get app info',
      { expression: '__RN_AGENT.getAppInfo()' });

    await bench(client, 'cdp_component_tree', '2.2 Full tree (depth 4)',
      { depth: 4 });

    await bench(client, 'cdp_component_tree', '2.3 Filter: home-welcome',
      { filter: 'home-welcome', depth: 10 });

    await bench(client, 'cdp_navigation_state', '2.4 Nav state (Home tab)');

    await bench(client, 'cdp_store_state', '2.5 Full store');

    await bench(client, 'cdp_store_state', '2.6 Store path: user',
      { path: 'user' });

    // ═══════════════════════════════════════════
    // PHASE 3: Navigate to Feed & Trigger Network
    // ═══════════════════════════════════════════
    console.log('\n═══ PHASE 3: Navigate + Network ═══');

    await bench(client, 'cdp_evaluate', '3.1 Navigate to Feed',
      { expression: `(function() { globalThis.__NAV_REF__.navigate('HomeTab', { screen: 'Feed' }); return 'navigated'; })()` });

    // Wait for navigation + network
    await new Promise(r => setTimeout(r, 2000));

    await bench(client, 'cdp_navigation_state', '3.2 Nav state (Feed)');

    await bench(client, 'cdp_network_log', '3.3 Network log');

    await bench(client, 'cdp_component_tree', '3.4 Feed tree',
      { filter: 'feed', depth: 5 });

    await bench(client, 'cdp_store_state', '3.5 Store: feed slice',
      { path: 'feed' });

    // ═══════════════════════════════════════════
    // PHASE 4: Interact with UI
    // ═══════════════════════════════════════════
    console.log('\n═══ PHASE 4: UI Interaction ═══');

    // Navigate back to Home first
    await bench(client, 'cdp_evaluate', '4.0 Navigate to Home',
      { expression: `(function() { globalThis.__NAV_REF__.navigate('HomeTab', { screen: 'HomeMain' }); return 'navigated'; })()` });

    await new Promise(r => setTimeout(r, 500));

    await bench(client, 'cdp_interact', '4.1 Press home-feed-btn',
      { action: 'press', testID: 'home-feed-btn' });

    // Navigate to Profile tab
    await bench(client, 'cdp_evaluate', '4.2 Navigate to Profile tab',
      { expression: `(function() { globalThis.__NAV_REF__.navigate('ProfileTab'); return 'navigated'; })()` });

    await new Promise(r => setTimeout(r, 500));

    await bench(client, 'cdp_interact', '4.3 Press profile-update-btn',
      { action: 'press', testID: 'profile-update-btn' });

    await bench(client, 'cdp_store_state', '4.4 Verify name changed',
      { path: 'user.name' });

    // ═══════════════════════════════════════════
    // PHASE 5: Console + Error Logging
    // ═══════════════════════════════════════════
    console.log('\n═══ PHASE 5: Console + Error Logging ═══');

    // Navigate to Notifications (triggers console.log/warn/error on mount)
    await bench(client, 'cdp_evaluate', '5.0 Navigate to Notifications',
      { expression: `(function() { globalThis.__NAV_REF__.navigate('NotificationsTab'); return 'navigated'; })()` });

    await new Promise(r => setTimeout(r, 1000));

    await bench(client, 'cdp_console_log', '5.1 Console log');

    await bench(client, 'cdp_console_log', '5.2 Console log (filtered)',
      { level: 'warn' });

    // Navigate to ErrorLab
    await bench(client, 'cdp_evaluate', '5.3 Navigate to ErrorLab',
      { expression: `(function() { globalThis.__NAV_REF__.navigate('ErrorLab'); return 'navigated'; })()` });

    await new Promise(r => setTimeout(r, 500));

    // Trigger a sync error
    await bench(client, 'cdp_interact', '5.4 Press error-lab-throw',
      { action: 'press', testID: 'error-lab-throw' });

    await new Promise(r => setTimeout(r, 500));

    await bench(client, 'cdp_error_log', '5.5 Error log (with symbolication)');

    // ═══════════════════════════════════════════
    // PHASE 6: Dev Settings
    // ═══════════════════════════════════════════
    console.log('\n═══ PHASE 6: Dev Settings ═══');

    await bench(client, 'cdp_dev_settings', '6.1 Toggle perf monitor',
      { action: 'togglePerfMonitor' });

    await bench(client, 'cdp_dev_settings', '6.2 Dismiss RedBox',
      { action: 'dismissRedBox' });

    // ═══════════════════════════════════════════
    // PHASE 7: Reload (last — resets state)
    // ═══════════════════════════════════════════
    console.log('\n═══ PHASE 7: Reload ═══');

    await bench(client, 'cdp_reload', '7.1 Full reload',
      { full: true });

    // After reload, verify recovery
    await new Promise(r => setTimeout(r, 2000));

    await bench(client, 'cdp_status', '7.2 Post-reload status');

    await bench(client, 'cdp_component_tree', '7.3 Post-reload tree',
      { depth: 3 });

    // ═══════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════');
    console.log('BENCHMARK RESULTS SUMMARY');
    console.log('═══════════════════════════════════════════\n');

    // Tool timing summary
    const toolTimings = new Map<string, { total: number; calls: number; min: number; max: number }>();
    for (const r of results) {
      const existing = toolTimings.get(r.tool) ?? { total: 0, calls: 0, min: Infinity, max: 0 };
      existing.total += r.durationMs;
      existing.calls++;
      existing.min = Math.min(existing.min, r.durationMs);
      existing.max = Math.max(existing.max, r.durationMs);
      toolTimings.set(r.tool, existing);
    }

    console.log('Tool Performance:');
    console.log('─────────────────────────────────────────────────────────');
    console.log('Tool                    Calls  Avg(ms)  Min(ms)  Max(ms)');
    console.log('─────────────────────────────────────────────────────────');
    for (const [tool, t] of [...toolTimings.entries()].sort((a, b) => b[1].total / b[1].calls - a[1].total / a[1].calls)) {
      console.log(
        `${tool.padEnd(24)}${String(t.calls).padStart(5)}  ${String(Math.round(t.total / t.calls)).padStart(7)}  ${String(t.min).padStart(7)}  ${String(t.max).padStart(7)}`
      );
    }

    // Issues found
    const issues = results.filter(r => r.status !== 'ok');
    if (issues.length > 0) {
      console.log('\nIssues Found:');
      console.log('─────────────────────────────────────────────────────────');
      for (const r of issues) {
        console.log(`  ${r.status === 'fail' ? '❌' : '⚠️'} ${r.step}: ${r.notes}`);
      }
    }

    // Overall stats
    const totalMs = results.reduce((s, r) => s + r.durationMs, 0);
    const passed = results.filter(r => r.status === 'ok').length;
    const warned = results.filter(r => r.status === 'warn').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const totalBytes = results.reduce((s, r) => s + r.dataSize, 0);

    console.log(`\nTotal: ${results.length} calls, ${totalMs}ms, ${(totalBytes / 1024).toFixed(1)}KB data`);
    console.log(`Results: ${passed} ok, ${warned} warnings, ${failed} failures`);

    process.exit(failed > 0 ? 1 : 0);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch(err => {
  console.error('Benchmark fatal error:', err);
  process.exit(1);
});
