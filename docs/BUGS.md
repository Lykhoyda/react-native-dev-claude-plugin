# Known Bugs & Issues

## Open

### B1: Network.enable may silently succeed on RN < 0.83
**Severity:** Medium
**Description:** Hermes accepts `Network.enable` without error on older RN versions, but doesn't emit events for JS fetch/XHR traffic. The bridge sets `networkMode = "cdp"` and skips the fallback hook, resulting in empty network logs.
**Workaround:** The fetch/XHR hook fallback (`NETWORK_HOOK_SCRIPT`) exists but is only injected when `Network.enable` throws. May need to always inject both and merge results.
**Status:** Open — needs testing with RN < 0.83

### B2: waitForReact timeout may be too short for cold starts
**Severity:** Low
**Description:** `REACT_READY_TIMEOUT_MS` is 8000ms. First Metro bundle can take 30-60s. If timeout fires, helpers inject into a non-ready environment.
**Workaround:** User can call `cdp_status` again after app finishes loading.
**Status:** Open — consider increasing to 30s or making configurable

### B3: Navigation state fallback relies on brittle internal fiber state
**Severity:** Medium
**Description:** The React Navigation fiber walk fallback accesses `memoizedState.memoizedState[0]` which is an internal implementation detail. May break across RN/React Navigation versions.
**Workaround:** Primary paths (Expo Router global + React Navigation DevTools) are stable. Fiber fallback is last resort.
**Status:** Open — monitor across React Navigation versions

### B4: Store detection does not cover Jotai
**Severity:** Medium
**Description:** Architecture docs mention Jotai support but only Redux (auto-detect + global) and Zustand (explicit global) are implemented.
**Workaround:** Use `cdp_evaluate` to manually query Jotai atoms.
**Status:** Open — add Jotai support in future iteration

### B5: cdp_evaluate is an unrestricted JS execution surface
**Severity:** Medium (by design)
**Description:** Any agent prompt reaching cdp_evaluate can read app state, mutate runtime, or exfiltrate data. This is intentional for a local dev tool but should be documented.
**Workaround:** Only used in trusted local dev environments. Documented in README troubleshooting.
**Status:** Accepted risk — document clearly

## Resolved

### B6: Disconnected client could steal CDP session via reconnect (CRITICAL)
**Fixed:** Added `disposed` flag to CDPClient. `disconnect()` sets it and removes WS listeners. Reconnect handler checks `disposed` before attempting.

### B7: Event handlers duplicated on each reconnect (HIGH)
**Fixed:** `setup()` now calls `eventHandlers.clear()` before `setupEventHandlers()`.

### B8: errorCount reported string length instead of error count (HIGH)
**Fixed:** Changed to `JSON.parse(__RN_AGENT.getErrors()).length`.

### B9: cdp_dev_settings actions were incorrect (HIGH)
**Fixed:** Updated to use correct RN DevSettings APIs.

### B10: No auto-build on npm install (HIGH)
**Fixed:** Added `"prepare": "tsc"` to package.json.
