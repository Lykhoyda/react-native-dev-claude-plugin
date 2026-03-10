# rn-debugging — CDP Usage, Error Identification, and Connection Troubleshooting

How to diagnose problems in React Native apps using the CDP MCP server,
native device logs, and bash tools.

---

## CDP vs Bash Decision Table

| What you need to know | Tool | Command / MCP call |
|----------------------|------|--------------------|
| Is Metro running? | MCP | `cdp_status` |
| Is app showing a crash (JS)? | MCP | `cdp_error_log` |
| Is app showing a crash (native)? | bash | `adb logcat -b crash` / `xcrun simctl spawn booted log stream` |
| What screen is the user on? | MCP | `cdp_navigation_state` |
| What does the component render? | MCP | `cdp_component_tree(filter="MyComponent")` |
| What is in the store? | MCP | `cdp_store_state(path="cart.items")` |
| What API calls were made? | MCP | `cdp_network_log(limit=10)` |
| What did console.log output? | MCP | `cdp_console_log(level="all")` |
| Did the JS engine pause? | MCP | `cdp_status` (reports isPaused) |
| Is there a RedBox overlay? | MCP | `cdp_component_tree` (auto-detects and warns) |
| Dismiss RedBox / toggle inspector | MCP | `cdp_dev_settings(action="dismissRedBox")` |
| Is Metro bundler alive? | bash | `curl localhost:8081/status` |
| Is a specific element on screen? | Maestro | `assertVisible: "element"` |
| What are all UI elements' positions? | bash | `adb shell uiautomator dump` (Android only) |
| Arbitrary runtime value | MCP | `cdp_evaluate(expression="...")` |

**Key rule: If `cdp_error_log` is empty but the app is visibly broken, the
problem is native.** CDP only sees JavaScript. Native crashes, OOM errors, and
framework panics are invisible to CDP — always check native logs as fallback.

---

## Error Types Matrix

| Error Type | Where to Find It | Tool |
|-----------|------------------|------|
| JS runtime error (throw, TypeError) | `cdp_error_log` | MCP |
| Unhandled promise rejection | `cdp_error_log` | MCP |
| Uncaught error overlay (RedBox) | `cdp_component_tree` (APP_HAS_REDBOX warning) | MCP |
| `console.error()` call | `cdp_console_log(level="error")` | MCP |
| Metro bundle syntax error | `curl localhost:8081/status` | bash |
| Native crash (iOS) | `xcrun simctl spawn booted log stream --predicate 'processImagePath ENDSWITH "/YourApp" AND logType == error'` | bash |
| Native crash (Android) | `adb logcat -b crash` | bash |
| RN framework error (Android) | `adb logcat -s ReactNative:E ReactNativeJS:E --pid=$(adb shell pidof com.example.app \| awk '{print $1}')` | bash |
| Network failure | `cdp_network_log` (look for status=0 or missing status) | MCP |

---

## Environment Status Check (Always First)

Before any testing or debugging, call `cdp_status`. It returns:

```json
{
  "metro": { "running": true, "port": 8081 },
  "cdp": { "connected": true, "device": "iPhone 16 Pro", "pageId": 3 },
  "app": {
    "platform": "ios", "dev": true, "hermes": true,
    "rnVersion": "0.83.1",
    "dimensions": { "width": 393, "height": 852 },
    "hasRedBox": false, "isPaused": false, "errorCount": 0
  },
  "capabilities": {
    "networkDomain": true, "fiberTree": true, "networkFallback": false
  }
}
```

Decision tree:
- `metro.running = false` → start Metro: `npx expo start` or `npx react-native start`
- `app.hasRedBox = true` → read `cdp_error_log`, fix the error, then `cdp_reload`
- `app.isPaused = true` → `cdp_reload` (auto-reconnects after reload)
- `app.errorCount > 0` → check `cdp_error_log` before continuing
- `capabilities.networkDomain = false` → network logging uses injected hooks (RN < 0.83)
- `capabilities.fiberTree = false` → release build or non-Hermes engine

---

## Connection Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| Metro not found | Dev server not running | `npx expo start` or `npx react-native start` |
| No Hermes target | App not loaded | Open simulator, wait for app bundle, retry |
| Error code 1006 | Another debugger connected | Close React Native DevTools, Flipper, or Chrome DevTools |
| Evaluate timeout (5s) | JS thread blocked or paused | Search for `debugger;` statements; check for long sync ops |
| "hook not available" | Release build or JSC engine | Only works in `__DEV__` mode with Hermes |
| `APP_HAS_REDBOX` | Error overlay showing | Read `cdp_error_log`, fix code, `cdp_reload` |
| "No store found" | Zustand not exposed | Add `if (__DEV__) global.__ZUSTAND_STORES__ = { ... }` |
| All CDP calls fail | Zombie Hermes target | Reload app and reconnect with `cdp_status` |

**About code 1006:** Hermes allows only ONE CDP client. Close all debugger UIs
before the MCP server can connect.

**About code 1001:** Normal close triggered by a reload. The MCP server handles
this automatically — no action needed.

---

## Post-Reload Readiness

After `cdp_reload`, the server auto-reconnects and waits for React DevTools
hook (up to 30 seconds). If `cdp_component_tree` returns "No fiber roots"
immediately after reload, wait 2 seconds and retry.

Manual readiness check:
```
cdp_evaluate(expression="typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' && __REACT_DEVTOOLS_GLOBAL_HOOK__.renderers?.size > 0")
```

---

## CDP Technical Constraints

### 5-Second Timeout on All Calls

Every CDP call has a hard 5-second timeout. Common causes of timeout:
- `debugger;` statement in code
- Long synchronous computation
- Unresolved promise with `awaitPromise=true`
- Metro busy bundling

### Single CDP Session

Hermes allows exactly one CDP client at a time. Things that consume a session:
- React Native DevTools (built into RN 0.73+)
- Flipper (older projects)
- Chrome DevTools connected via Metro
- The MCP server itself

### Fiber Tree Limitations

- Only works in `__DEV__` builds with Hermes engine
- Component in fiber tree does NOT mean visible on screen
- Full tree dumps are expensive — always use `filter` parameter

---

## Common Error Patterns

### "Cannot read property X of undefined"
1. `cdp_component_tree` — find which component is rendering
2. `cdp_store_state` — check if data is in the store
3. Look for missing null checks or async data race

### "Invariant Violation: Element type is invalid"
Wrong export or circular import. Check `cdp_console_log(level="error")` for context.

### App Crashes With No CDP Error
Native crash. Check:
```bash
# iOS (use actual binary name — see "Native Log Commands Reference")
xcrun simctl spawn booted log stream \
  --predicate 'processImagePath ENDSWITH "/YourApp" AND logType == error'

# Android
adb logcat -b crash
```

### "[Circular]" or "[TRUNCATED]" in Results
Helpers use WeakSet for circular refs and cap output at 50KB.
Use `path` parameter on `cdp_store_state` to drill into specific keys.

### Network Requests Not Appearing
1. RN < 0.83 — uses injected hooks. Check `cdp_status` → `capabilities.networkFallback`
2. Requests made before MCP connected — buffer only captures from connection time

---

## Native Log Commands Reference

### iOS

```bash
# Stream error logs from app (use ENDSWITH for binary name precision)
xcrun simctl spawn booted log stream \
  --predicate 'processImagePath ENDSWITH "/YourApp" AND logType == error'

# Get logs from last 2 minutes
xcrun simctl spawn booted log show \
  --predicate 'processImagePath ENDSWITH "/YourApp"' --last 2m

# Find the actual binary name for the predicate:
ls $(xcrun simctl get_app_container booted com.example.app)
```

### Android

```bash
# Crash log only
adb logcat -b crash

# React Native errors (pidof without -s for broader compatibility)
APP_PID=$(adb shell pidof com.example.app 2>/dev/null | awk '{print $1}') || \
  APP_PID=$(adb shell ps | grep com.example.app | awk '{print $2}')
adb logcat -s ReactNative:E ReactNativeJS:E --pid=$APP_PID

# Clear buffer before test
adb logcat -c
```

---

## Metro Health Check

```bash
curl localhost:8081/status          # Expected: "packager-status:running"
curl localhost:8081/json/list       # List Hermes debug targets
curl localhost:19000/status         # Expo alternative port
```

The MCP server auto-discovers Metro on ports 8081, 8082, 19000, 19006.
Pass `metroPort` to `cdp_status` for non-standard ports.

---

## Capability Matrix (by RN Version)

| Capability | RN < 0.73 | RN 0.73-0.82 | RN 0.83+ |
|-----------|-----------|--------------|----------|
| CDP connection | Hermes only | Yes | Yes |
| Fiber tree walk | Yes (__DEV__) | Yes | Yes |
| Navigation state | Yes | Yes | Yes |
| Store state | Yes | Yes | Yes |
| Network (CDP domain) | No | No | Yes |
| Network (injected hooks) | Yes (fallback) | Yes (fallback) | Not needed |
| Console capture | Yes | Yes | Yes |
| Error tracking | Yes | Yes | Yes |
