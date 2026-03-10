# rn-device-control — Device Lifecycle and State Extraction

Commands for controlling iOS Simulator and Android Emulator, taking screenshots,
reading UI state, and managing device settings. All commands run via bash.

---

## iOS Simulator (simctl)

### Boot and Manage Devices

```bash
# List all available simulators
xcrun simctl list devices

# List only booted simulators
xcrun simctl list devices booted

# Boot a specific simulator by name or UDID
xcrun simctl boot "iPhone 16 Pro"
xcrun simctl boot <UDID>

# Shutdown a simulator
xcrun simctl shutdown booted

# Install an app (.app bundle)
xcrun simctl install booted /path/to/YourApp.app

# Uninstall an app
xcrun simctl uninstall booted com.example.app

# Launch an app
xcrun simctl launch booted com.example.app

# Terminate a running app
xcrun simctl terminate booted com.example.app

# Erase all content (reset to factory)
xcrun simctl erase booted
```

### Deep Links

```bash
# Open a deep link in the booted simulator
xcrun simctl openurl booted "myapp://home"
xcrun simctl openurl booted "myapp://product/123"
xcrun simctl openurl booted "myapp://checkout"
```

Deep links are the fastest and most deterministic way to navigate to a specific
screen. Prefer them over Maestro navigation flows when the app has them set up.

### Screenshots (prefer JPEG — 2x faster, good enough for AI analysis)

```bash
# JPEG — recommended (80ms, ~200KB)
xcrun simctl io booted screenshot --type=jpeg /tmp/rn-screenshot.jpg

# PNG — slower (150ms, ~800KB), avoid for testing loops
xcrun simctl io booted screenshot --type=png /tmp/rn-screenshot.png
```

JPEG is 2x faster and produces files 4x smaller than PNG. Vision models
internally compress and downscale images anyway — pixel-perfect PNGs are
wasted I/O. Always use JPEG for iOS testing.

### Native Log Streaming (for crash investigation)

```bash
# Stream error-level logs from a specific app process
# Replace "YourApp" with the actual binary name (not the bundle ID).
# Find binary name: ls $(xcrun simctl get_app_container booted com.example.app)
xcrun simctl spawn booted log stream \
  --predicate 'processImagePath ENDSWITH "/YourApp" AND logType == error'

# Grab a log snapshot from last 1 minute
xcrun simctl spawn booted log show \
  --predicate 'processImagePath ENDSWITH "/YourApp"' \
  --last 1m
```

**Note:** `processImagePath` matches the Mach-O binary name, not the bundle
ID. Use `ENDSWITH "/BinaryName"` for precision — `contains` may match
system processes with similar substrings.

Use these when cdp_error_log is empty but the app has crashed or behaves
unexpectedly — the problem is native, not JavaScript.

### Device Settings

```bash
# Change device language and locale (requires restart)
xcrun simctl spawn booted defaults write -g AppleLanguages '("fr")'
xcrun simctl spawn booted defaults write -g AppleLocale fr_FR

# Grant permissions programmatically
xcrun simctl privacy booted grant camera com.example.app
xcrun simctl privacy booted grant location com.example.app
xcrun simctl privacy booted grant photos com.example.app
xcrun simctl privacy booted revoke camera com.example.app
xcrun simctl privacy booted reset all com.example.app

# Push notification payload testing
xcrun simctl push booted com.example.app payload.json
```

### iOS Limitations

There is no built-in CLI equivalent to Android's `uiautomator dump` on iOS.
Options for UI hierarchy:
- Maestro's internal hierarchy (used automatically during test execution)
- CDP: Walk the React fiber tree for testID-tagged elements (via MCP server)

On iOS, rely on Maestro for UI assertions and CDP for app introspection.

---

## Android Emulator / Device (adb)

### Device Management

```bash
# List connected devices and emulators
adb devices

# Install an APK
adb install /path/to/app.apk
adb install -r /path/to/app.apk  # -r to reinstall without uninstalling

# Uninstall an app
adb uninstall com.example.app

# Launch an activity
adb shell am start -n com.example.app/.MainActivity

# Force stop an app
adb shell am force-stop com.example.app

# Clear app data (full reset)
adb shell pm clear com.example.app
```

### Deep Links

```bash
# Open a deep link on Android
adb shell am start -a android.intent.action.VIEW -d "myapp://home"
adb shell am start -a android.intent.action.VIEW -d "myapp://product/123"
```

### Screenshots (prefer exec-out — skips device storage round-trip)

```bash
# Recommended — direct pipe via exec-out (300ms, ~800KB)
adb exec-out screencap -p > /tmp/rn-screenshot.png
```

The `exec-out` approach pipes raw PNG directly to the host, skipping the
write-to-`/sdcard/` + `adb pull` round-trip. PNG output is already
deflate-compressed internally, so wrapping it in gzip yields negligible
size reduction — not worth the added complexity.

### UI Hierarchy Extraction

Android can dump a full structured accessibility tree — far more useful than
screenshots for an LLM to understand screen state.

```bash
# Full UI hierarchy as XML (300-500ms)
# Note: dump to file on device, then pull — /dev/stdout prepends a status message that corrupts XML
adb shell uiautomator dump --compressed /data/local/tmp/uidump.xml && \
  adb exec-out cat /data/local/tmp/uidump.xml && \
  adb shell rm /data/local/tmp/uidump.xml

# Parse to JSON — only interactive and visible elements
adb shell uiautomator dump --compressed /data/local/tmp/uidump.xml && \
  adb exec-out cat /data/local/tmp/uidump.xml | \
  python3 -c "
import xml.etree.ElementTree as ET, json, sys
tree = ET.parse(sys.stdin)
els = [{'text':n.get('text',''),'id':n.get('resource-id',''),
        'desc':n.get('content-desc',''),'bounds':n.get('bounds',''),
        'clickable':n.get('clickable')=='true'}
       for n in tree.iter('node')
       if n.get('text') or n.get('resource-id') or n.get('content-desc')]
json.dump(els, sys.stdout, indent=2)" && \
  adb shell rm /data/local/tmp/uidump.xml
```

Raw dump: ~15-30KB XML, 200+ nodes. After pruning: ~2-3KB JSON, 15-40
elements — about 100 tokens for the LLM.

### Disable Animations (run once before testing)

```bash
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

Restore after testing:
```bash
adb shell settings put global window_animation_scale 1
adb shell settings put global transition_animation_scale 1
adb shell settings put global animator_duration_scale 1
```

### Native Logs (for crash investigation)

```bash
# Stream crash-level logs
adb logcat -b crash

# Stream only React Native errors (filter by PID)
# pidof -s may not exist on all Android versions; use grep fallback:
APP_PID=$(adb shell pidof com.example.app 2>/dev/null | awk '{print $1}') || \
  APP_PID=$(adb shell ps | grep com.example.app | awk '{print $2}')
adb logcat -s ReactNative:E ReactNativeJS:E --pid=$APP_PID

# Clear logcat buffer before a test run
adb logcat -c
```

### Permissions

```bash
# Grant a runtime permission
adb shell pm grant com.example.app android.permission.CAMERA
adb shell pm grant com.example.app android.permission.ACCESS_FINE_LOCATION

# Revoke a runtime permission
adb shell pm revoke com.example.app android.permission.CAMERA
```

### Language and Locale

```bash
adb shell settings put system locale fr_FR
```

---

## Concurrent State Snapshot Script

The `scripts/snapshot_state.sh` script captures screenshot + UI hierarchy
simultaneously, cutting state-check time by ~40%.

```bash
# Usage
bash scripts/snapshot_state.sh [ios|android] [output_dir]

# iOS output: /tmp/rn-dev-agent/screenshot.jpg
# Android output: /tmp/rn-dev-agent/screenshot.png + ui_elements.json
```

On Android, both `screencap` and `uiautomator dump` run as background processes
completing in parallel (~300ms total instead of ~800ms sequential).

---

## Benchmark Reference

| Operation | Command | Time | Size |
|-----------|---------|------|------|
| iOS screenshot (JPEG) | `xcrun simctl io booted screenshot --type=jpeg` | 80ms | 200KB |
| iOS screenshot (PNG) | `xcrun simctl io booted screenshot --type=png` | 150ms | 800KB |
| Android screenshot (exec-out) | `adb exec-out screencap -p >` | 300ms | 800KB |
| Android UI hierarchy | `adb shell uiautomator dump --compressed` | 300-500ms | 15-30KB XML |
| Android UI hierarchy (parsed) | above + python3 filter | 350-550ms | 2-3KB JSON |

---

## Expo/EAS Build Integration

Two scripts handle building, installing, and launching Expo apps automatically.

### Decision Table

| Situation | Action |
|-----------|--------|
| App already running + Metro connected | Skip — proceed to testing |
| Metro not running, app not on device | `expo_ensure_running.sh` (local build mode) |
| Want to test a specific EAS build | `eas_resolve_artifact.sh` → `expo_ensure_running.sh --artifact` |
| No `eas.json` in project | Local build only (no EAS path) |

### Script 1: eas_resolve_artifact.sh

Resolves an EAS build artifact through three tiers: local cache → EAS server → manual.

```bash
# Auto-select profile, download artifact
bash scripts/eas_resolve_artifact.sh ios
bash scripts/eas_resolve_artifact.sh android

# Specify profile explicitly
bash scripts/eas_resolve_artifact.sh ios development
bash scripts/eas_resolve_artifact.sh android preview
```

**Exit codes:**
| Code | Meaning | Agent action |
|------|---------|-------------|
| 0 | Artifact found, JSON with path on stdout | Pass path to `expo_ensure_running.sh --artifact` |
| 1 | General failure | Report error to user |
| 2 | Ambiguous profiles, JSON with list on stdout | Ask user which profile, re-run with choice |
| 3 | EAS CLI not available | Tell user: `npm install -g eas-cli` |
| 4 | No eas.json | Use local build instead |

**Stdout (exit 0):**
```json
{"status":"ok","path":"/tmp/rn-eas-builds/development-ios.tar.gz","source":"cache"}
```

**EAS profile auto-selection rules:**
- iOS: profile must have `"ios": { "simulator": true }` in eas.json
- Android: profile must have `"android": { "buildType": "apk" }` (AAB cannot sideload)
- If exactly one profile matches → use it
- If zero match → fall back to `"development"` profile
- If multiple match → exit 2 with list, agent asks user

### Script 2: expo_ensure_running.sh

Ensures the app is installed, launched, and Metro is running.

```bash
# Local dev build (builds from source, starts Metro)
bash scripts/expo_ensure_running.sh ios
bash scripts/expo_ensure_running.sh android

# Install EAS artifact
bash scripts/expo_ensure_running.sh ios --artifact /tmp/rn-eas-builds/dev-ios.tar.gz
bash scripts/expo_ensure_running.sh android --artifact /tmp/rn-eas-builds/dev-android.apk

# With explicit bundle ID and Metro port
bash scripts/expo_ensure_running.sh ios --bundle-id com.example.app --metro-port 8081
```

**Exit codes:**
| Code | Meaning | Agent action |
|------|---------|-------------|
| 0 | App running, Metro up, JSON on stdout | Proceed to `cdp_status` |
| 1 | No simulator/emulator | Tell user to boot one |
| 2 | Metro failed to start | Check `/tmp/rn-dev-agent/metro.log` |
| 3 | Install failed | Report artifact may be corrupt |
| 4 | Local build failed | Check build log, may need manual fix |

**Stdout (exit 0):**
```json
{"status":"ok","metro_port":8081,"platform":"ios","installed_fresh":true}
```

**Artifact handling:**
- iOS `.tar.gz`: extracts, finds `.app` directory inside, `xcrun simctl install booted`
- iOS `.app`: copies and installs directly
- Android `.apk`: `adb install -r`
- Android `.aab`: rejected (cannot sideload, exit 3)

### Combined Workflow Example

```bash
# Full EAS workflow: resolve artifact, then install and run
RESULT=$(bash scripts/eas_resolve_artifact.sh ios development)
ARTIFACT=$(echo "$RESULT" | jq -r '.path')
bash scripts/expo_ensure_running.sh ios --artifact "$ARTIFACT"

# Simple local build: just build and run
bash scripts/expo_ensure_running.sh android
```

### Metro Start Behavior

Both scripts check ports 8081, 8082, 19000, 19006 (same as the MCP server).
If Metro is not running, `expo_ensure_running.sh` starts it in the background
with output logged to `/tmp/rn-dev-agent/metro.log`. Metro survives after the
script exits — it is not killed on cleanup.

---

## Prerequisites

| Tool | Required | Install |
|------|----------|---------|
| Xcode + Command Line Tools | iOS | Mac App Store |
| xcrun simctl | iOS | Included with Xcode |
| Android SDK (adb) | Android | developer.android.com/studio |
| Python 3 | Android hierarchy parsing | Pre-installed on macOS |
| jq | EAS profile parsing (optional, falls back to node) | `brew install jq` |
| eas-cli | EAS builds (optional) | `npm install -g eas-cli` |
| Expo CLI | Local builds + Metro | Included with Expo projects (`npx expo`) |
