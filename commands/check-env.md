---
command: check-env
description: Check that the React Native development environment is ready for testing -- Metro running, app loaded, CDP connected, no active errors.
---

Check the full environment status before testing or debugging.

## Usage

```
/rn-dev-agent:check-env
```

## What This Does

Runs a single `cdp_status` call and reports on:

- **Metro**: Is the dev server running? Which port?
- **CDP**: Is the bridge connected to Hermes? Which device/page?
- **App**: Platform (iOS/Android), RN version, Hermes enabled, screen dimensions
- **Capabilities**: Is CDP Network domain available? Is fiber tree accessible?
- **Errors**: Active error count, RedBox showing, debugger paused?

## Common Issues and Fixes

| Status | Meaning | Fix |
|--------|---------|-----|
| Metro not found | Dev server isn't running | `npx expo start` or `npx react-native start` |
| No Hermes target | App isn't loaded or not using Hermes | Open the app on the simulator |
| CDP code 1006 | Another debugger has the session | Close React Native DevTools, Flipper, Chrome DevTools |
| hasRedBox: true | App is showing an error | Run `/rn-dev-agent:debug-screen` |
| isPaused: true | Debugger paused on breakpoint | Remove `debugger;` statements or use `cdp_reload` |
| fiberTree: false | Release build or non-Hermes engine | Only works in `__DEV__` builds with Hermes |

## Use This Before Every Test Session

Run `check-env` to confirm the environment is clean before starting a
`test-feature` or `debug-screen` session.
