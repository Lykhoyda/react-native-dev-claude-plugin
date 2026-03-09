# Architectural Decisions

## 2026-03-09: Initial Implementation

### D1: Use 127.0.0.1 instead of localhost for Metro discovery
Node 18+ defaults to IPv6 for `localhost`, which can fail if Metro only binds IPv4. Using `127.0.0.1` directly avoids DNS resolution ambiguity.

### D2: Filter ring buffers before applying limit
Gemini review identified that applying `getLast(limit)` before filtering discards relevant entries. Now we filter the entire buffer first, then slice to limit.

### D3: Reject all pending CDP promises on WebSocket close
When the WebSocket closes (reload or crash), pending `Runtime.evaluate` calls would hang until their 5s timeout. Now we immediately reject them on close to prevent cascading delays.

### D4: Capture text nodes (tag 6) in fiber tree walker
React Fiber text nodes have `tag === 6` and store their text in `memoizedProps` as a string. Without capturing these, the agent cannot read any screen text. Added early return for text nodes in the `walk()` function.

### D5: Extract accessibilityLabel alongside testID
Many RN apps use `accessibilityLabel` for e2e testing. The fiber tree walker now captures `testID`, `accessibilityLabel`, and `nativeID`.

### D6: Catch expected errors in reload()
`DevSettings.reload()` kills the JS bundle, closing the WebSocket. The `evaluate()` call throws because the WS closes. Wrapping in try/catch prevents aborting the reconnect sequence.

### D7: MCP server uses zod schemas from @modelcontextprotocol/sdk
The SDK v1.12+ uses zod for tool parameter validation. All tool definitions use `z.string()`, `z.number()`, `z.boolean()`, `z.enum()` with `.default()` and `.optional()`.

### D8: Single CDPClient instance, mutable global
The MCP server uses a single `let client` that can be reassigned when the user overrides the Metro port. Previous client is disconnected before replacement.

## 2026-03-09: Codex Review Fixes

### D9: disposed flag prevents reconnect on disconnect()
When a CDPClient is discarded (e.g., port override), `disconnect()` sets `disposed = true` and removes all WS listeners. The reconnect handler checks `disposed` before attempting reconnection, preventing a discarded client from stealing Hermes' single CDP session.

### D10: Clear event handlers before re-setup on reconnect
`setup()` now calls `this.eventHandlers.clear()` before `setupEventHandlers()` to prevent duplicate console/network/Debugger.paused handlers from accumulating across reconnects.

### D11: errorCount uses JSON.parse to count actual errors
`__RN_AGENT.getErrors()` returns a JSON string. Previously `.length` counted string characters. Now uses `JSON.parse(__RN_AGENT.getErrors()).length` for correct error count.

### D12: cdp_dev_settings uses correct RN APIs
`toggleInspector` now calls `DevSettings.toggleElementInspector()`. `dismissRedBox` now calls `LogBox.clearAllLogs()` instead of `ignoreLogs("")`. `togglePerfMonitor` calls `DevSettings.toggleFpsMonitor()`.

### D13: prepare script auto-builds on npm install
Added `"prepare": "tsc"` to package.json so `npm install` automatically compiles TypeScript to dist/.

### D14: hasErrorOverlay walks siblings for complete RedBox detection
The RedBox detection function now checks both child and sibling fibers, catching error overlays that are siblings of the main tree root.

## 2026-03-09: Phase 1 Rebuild (Gemini + Codex Review)

### D15: Clean architecture with tools/ directory
Tool handlers live in separate `src/tools/*.ts` files using a factory pattern (`createStatusHandler(getClient)`). This keeps `index.ts` under 60 lines and makes Phases 2-3 purely additive (new file + 2 lines in index).

### D16: connectWs settled guard prevents reconnection race
WebSocket `close` event fires even if `open` never did (e.g., ECONNREFUSED). A `settled` boolean prevents the `close` handler from triggering `handleClose` (and its reconnect loop) when the connection was never established. Only the active `this.ws` triggers reconnect.

### D17: 1006 close code triggers reconnect
React Native bundle reloads commonly produce WebSocket close code 1006 (abnormal). The original architecture blocked reconnect on 1006, but both Gemini and Codex identified this as a critical flaw. Now 1006 triggers the same reconnect path as 1001.

### D18: Timer cleanup in Metro discovery via finally block
`clearTimeout(timer)` moved to a `finally` block in the port scanning loop. If `fetch` rejects before the timeout fires, the timer is still cleaned up, preventing dangling timers.

### D19: Connection generation tracking for reload verification
`CDPClient` tracks a `_connectionGeneration` counter incremented on each successful `autoConnect`. The reload tool compares generation before/after to verify it reconnected to a NEW session, not the stale one.

### D20: Network hook fallback wired to networkBuffer
Console messages prefixed with `__RN_NET__:` are parsed in `handleMessage` and routed to `_networkBuffer` as proper `NetworkEntry` objects. This connects the RN < 0.83 fetch/XHR hook fallback to the same buffer used by CDP Network domain events.

### D21: Helper injection errors are checked and logged
`setup()` now inspects `EvaluateResult.error` after injecting helpers and network hooks. Failures are logged via `console.error` so the developer can diagnose injection failures.

### D22: textResult/errorResult helpers for MCP response typing
TypeScript requires `type: 'text' as const` for MCP SDK compatibility. Helper functions `textResult()` and `errorResult()` in `types.ts` provide correctly typed response builders, preventing the `string is not assignable to "text"` error across all tool handlers.

## 2026-03-09: Phase 2 Review Fixes (Gemini + Codex)

### D23: clearErrors evaluate result must be checked
`__RN_AGENT.clearErrors()` can fail if helpers were evicted by a reload. The tool now checks `clearResult.error` before reporting success, preventing false positives.

### D24: Tool handlers parse helper return shapes
Injected helpers return different JSON shapes: `{error}`, `{warning, message}`, `{tree, totalNodes}`. Tool handlers now parse the JSON and route `{error}` to `errorResult()` and `{warning: 'APP_HAS_REDBOX'}` to a structured warning, instead of passing raw JSON through blindly.

### D25: Filter check uses !== undefined instead of truthiness
`args.filter ? ... : 'undefined'` would treat an empty string `""` as falsy and pass `undefined` to the helper. Changed to `args.filter !== undefined` so empty strings are correctly forwarded.

### D26: Error log validates Array.isArray before .length
`JSON.parse(result.value)` could return a non-array if the helper is corrupted or returns an error object. Added `Array.isArray(parsed)` guard before accessing `.length`.

### D27: Depth schema uses .int().min(1).max(6)
Zod schema for `cdp_component_tree` depth parameter now enforces integer constraint and min/max bounds at the validation layer, preventing fractional or out-of-range values from reaching the helper.

### D28: awaitPromise not needed for synchronous helpers
All injected helper functions (`getTree`, `getNavState`, `getErrors`, `clearErrors`) are synchronous — they use `JSON.stringify` and return strings immediately. Adding `awaitPromise: true` would add unnecessary overhead. This was flagged as HIGH by Gemini but determined to be a false positive after code review.

## 2026-03-09: Phase 3 Data Layer (Gemini + Codex Review)

### D29: Console log level alias mapping (warn → warning)
CDP `Runtime.consoleAPICalled` uses `"warning"` as the type string for `console.warn()`, but the MCP schema exposes `"warn"` for user-friendliness. A `LEVEL_ALIASES` map normalizes `"warn"` → `"warning"` before filtering. Both Gemini and Codex flagged this independently.

### D30: Internal __RN_NET__ messages filtered from console output
When `networkMode === 'hook'`, the fetch/XHR monkey-patches emit `__RN_NET__:` prefixed console messages for internal transport. These are now filtered out before returning console entries to prevent internal telemetry from polluting user-facing logs.

### D31: Store state handles truncated JSON and null values
`safeStringify()` in injected helpers truncates JSON >30KB with `...[TRUNCATED]`, producing invalid JSON. The store-state handler now detects the truncation marker and returns a structured warning instead of crashing. Additionally, `JSON.parse` of `"null"` is handled safely — the error shape check now verifies `parsed !== null && typeof parsed === 'object'` before accessing `.error`.

### D32: dismissRedBox uses LogBoxData.clear()
`LogBox` module has no `.dismiss()` method. Changed to `require("react-native/Libraries/LogBox/Data/LogBoxData").clear()` which properly clears the LogBox overlay UI.

### D33: dev-settings reload only succeeds on confirmed disconnect
Previously, any thrown error during `reload` was treated as success. Now the catch clause checks for WebSocket-specific disconnect messages (`WebSocket closed` or `WebSocket not connected`) before reporting success, preventing false positives from timeouts or other transport failures.

### D34: Network hook fallback adds URL/method defaults
`parseNetworkHookMessage` now applies `?? 'GET'` and `?? ''` fallbacks for `method` and `url` fields from hook payloads, preventing `TypeError` when `cdp_network_log` filters by URL on malformed entries.

## 2026-03-09: Phase 4 Skills (Gemini + Codex Review)

### D35: iOS log stream uses predicate, not --level error
macOS `log` command's `--level` flag only accepts `default`, `info`, `debug`. To filter errors, use `--predicate 'logType == error'` instead of the invalid `--level error`.

### D36: Android gzipped screenshot requires -p flag
`screencap` without `-p` outputs raw RGBA buffer, not PNG. Using `screencap -p | gzip -1` ensures valid PNG data goes through the gzip pipe.

### D37: UIAutomator parser includes content-desc for RN elements
In React Native on Android, `accessibilityLabel` and `testID` map to `content-desc` XML attribute. The parser now includes `content-desc` in both extraction and the filter condition.

### D38: Maestro inputText, not typeText
Maestro's command for typing text is `inputText`, not `typeText`. The `scrollUntilVisible` command requires an `element:` wrapper in its YAML structure.

### D39: snapshot_state.sh marked as Phase 6 planned
The script is referenced in skills but not yet created. Skills now clearly mark it as Phase 6 planned work to avoid confusion about missing files.

## 2026-03-09: Phase 5 Agents + Commands (Gemini + Codex Review)

### D40: Debugger data gathering is two-phase, not fully parallel
`cdp_status` must complete first (it auto-connects and initializes helpers) before other CDP tools can be called. Step 2 is now: cdp_status first, then parallel evidence gathering.

### D41: Agent prompts discover app ID dynamically
Agents now instruct to find bundle ID from `app.json`, `app.config.js`, or `android/app/build.gradle` in Step 1, rather than using hardcoded `com.example.app`.

### D42: Tester uses git diff to discover changed files
Step 1 now uses `git diff HEAD~1 --name-only` or `git diff --staged --name-only` to discover which source files were changed, rather than assuming the agent knows.

### D43: hooks/hooks.json deferred to Phase 6
The plugin manifest no longer references `hooks/hooks.json` since the file doesn't exist yet. It will be added in Phase 6 when the SessionStart hook is implemented.

### D44: cdp_connect replaced with cdp_status
The agent prompt referenced a non-existent `cdp_connect` tool. All connection is handled through `cdp_status` which auto-connects.

## 2026-03-09: Phase 6 Review Fixes (Gemini + Codex)

### D45: uiautomator dump to device file instead of /dev/stdout
`adb shell uiautomator dump /dev/stdout` prepends a status message (`UI hierarchy dumped to: /dev/stdout`) to the output, corrupting the XML. Changed to dump to `/data/local/tmp/uidump.xml` on device, then `adb exec-out cat` the file and clean up afterward.

### D46: Python XML parser exits non-zero on failure
Previously the Python parser caught exceptions and wrote `{"error": ...}` (an object) while exiting 0. Downstream code expects an array. Now logs the error to stderr, outputs `[]` (empty array), and exits with code 1 so the shell can detect the failure.

### D47: Trap-based cleanup for background jobs
`set -e` with separate `wait` calls left orphaned processes when the first `wait` failed. Added a `trap cleanup EXIT` that kills and waits all background jobs. Individual `wait` calls now capture exit codes without triggering `set -e` abort, and report warnings for partial failures.

### D48: Multi-device warning for Android
When multiple Android devices/emulators are connected, `adb` commands fail with "more than one device/emulator". The script now counts connected devices and warns the user to set `ANDROID_SERIAL` env var if multiple are detected.

### D49: app.config.ts added to hook detection conditions
Expo projects using TypeScript config files (`app.config.ts`) were not detected by the SessionStart hook. Added `file_exists:app.config.ts` to the OR condition.
