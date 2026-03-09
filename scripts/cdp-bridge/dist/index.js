import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CDPClient } from './cdp-client.js';
import { createStatusHandler } from './tools/status.js';
import { createEvaluateHandler } from './tools/evaluate.js';
import { createReloadHandler } from './tools/reload.js';
import { createComponentTreeHandler } from './tools/component-tree.js';
import { createNavigationStateHandler } from './tools/navigation-state.js';
import { createErrorLogHandler } from './tools/error-log.js';
import { createNetworkLogHandler } from './tools/network-log.js';
import { createConsoleLogHandler } from './tools/console-log.js';
import { createStoreStateHandler } from './tools/store-state.js';
import { createDevSettingsHandler } from './tools/dev-settings.js';
let client = new CDPClient();
const getClient = () => client;
const setClient = (c) => { client = c; };
const createClient = (port) => new CDPClient(port);
const server = new McpServer({
    name: 'rn-dev-agent-cdp',
    version: '0.1.0',
});
server.tool('cdp_status', 'Get full environment status. Auto-connects if not connected. Returns Metro status, CDP connection, app info, capabilities, active errors, and RedBox/paused state. Call this FIRST before any testing.', { metroPort: z.number().optional().describe('Override Metro port (default: auto-detect 8081/8082/19000/19006)') }, createStatusHandler(getClient, setClient, createClient));
server.tool('cdp_evaluate', 'Execute arbitrary JavaScript in Hermes runtime. Has 5-second timeout. Use for one-off checks not covered by other tools. Prefer specific tools over raw evaluate.', {
    expression: z.string().describe('JavaScript expression to evaluate'),
    awaitPromise: z.boolean().default(false).describe('Wait for promise resolution'),
}, createEvaluateHandler(getClient));
server.tool('cdp_reload', 'Trigger a full reload of the app. Auto-reconnects to the new Hermes target (waits up to 15s). Returns when app is ready for queries again.', {
    full: z.boolean().default(true).describe('Always performs a full reload via DevSettings.reload()'),
}, createReloadHandler(getClient));
server.tool('cdp_component_tree', 'Get React component tree. Returns components with props, state, testIDs. Use filter to scope to a specific subtree — NEVER request full tree unless necessary (saves tokens). Detects RedBox and warns.', {
    filter: z.string().optional().describe('Component name or testID to scope query (e.g. "CartBadge", "product-list")'),
    depth: z.number().int().min(1).max(6).default(3).describe('Max depth (default 3, max 6)'),
}, createComponentTreeHandler(getClient));
server.tool('cdp_navigation_state', 'Get current navigation state: active route, params, stack history, nested navigators, active tab. Works with React Navigation and Expo Router.', {}, createNavigationStateHandler(getClient));
server.tool('cdp_error_log', 'Get unhandled JS errors and promise rejections. Hooked into ErrorUtils and Hermes rejection tracker. If empty but app crashed, the error is NATIVE — use bash logcat/simctl log instead.', {
    clear: z.boolean().default(false).describe('Clear all captured errors instead of reading them'),
}, createErrorLogHandler(getClient));
server.tool('cdp_network_log', 'Get recent network requests. Shows method, URL, status, duration. On RN 0.83+ uses CDP Network domain. On older versions uses injected fetch/XHR hooks (auto-detected).', {
    limit: z.number().int().min(1).max(100).default(20).describe('Max entries to return (default 20, max 100)'),
    filter: z.string().optional().describe('Filter by URL substring (e.g. "/api/cart")'),
    clear: z.boolean().default(false).describe('Clear network buffer instead of reading'),
}, createNetworkLogHandler(getClient));
server.tool('cdp_console_log', 'Get recent console output. Buffered in ring buffer so logs from between agent calls are preserved.', {
    level: z.enum(['all', 'log', 'warn', 'error', 'info', 'debug']).default('all').describe('Filter by log level'),
    limit: z.number().int().min(1).max(200).default(50).describe('Max entries to return (default 50, max 200)'),
    clear: z.boolean().default(false).describe('Clear console buffer instead of reading'),
}, createConsoleLogHandler(getClient));
server.tool('cdp_store_state', 'Read app store state (Redux, Zustand). Use path to query specific slice (e.g. "cart.items", "auth.user.name"). Redux auto-detected via fiber Provider. Zustand requires: if (__DEV__) global.__ZUSTAND_STORES__ = { store }', {
    path: z.string().optional().describe('Dot-path into store state (e.g. "cart.items")'),
}, createStoreStateHandler(getClient));
server.tool('cdp_dev_settings', 'Control React Native dev settings programmatically (no visual dev menu needed). For reload with auto-reconnect, use cdp_reload instead.', {
    action: z.enum(['reload', 'toggleInspector', 'togglePerfMonitor', 'dismissRedBox'])
        .describe('Dev menu action to execute'),
}, createDevSettingsHandler(getClient));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error('MCP server fatal error:', err);
    process.exit(1);
});
