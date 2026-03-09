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
xcrun simctl spawn booted log stream \
  --predicate 'processImagePath contains "YourApp" AND logType == error'

# Grab a log snapshot
xcrun simctl spawn booted log show \
  --predicate 'processImagePath contains "YourApp"' \
  --last 1m
```

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
# Standard — recommended (300ms, ~800KB)
adb exec-out screencap -p > /tmp/rn-screenshot.png

# Faster with gzip (150ms, ~250KB) — 2x faster than standard
adb exec-out sh -c 'screencap -p | gzip -1' > /tmp/rn-screenshot.png.gz && \
  gunzip -f /tmp/rn-screenshot.png.gz
```

The `exec-out` approach skips writing to `/sdcard/` and pulling the file,
saving one round-trip over USB/emulator bridge.

### UI Hierarchy Extraction

Android can dump a full structured accessibility tree — far more useful than
screenshots for an LLM to understand screen state.

```bash
# Full UI hierarchy as XML (300-500ms)
adb shell uiautomator dump --compressed /dev/stdout

# Parse to JSON — only interactive and visible elements
adb shell uiautomator dump --compressed /dev/stdout | \
  python3 -c "
import xml.etree.ElementTree as ET, json, sys
tree = ET.parse(sys.stdin)
els = [{'text':n.get('text',''),'id':n.get('resource-id',''),
        'desc':n.get('content-desc',''),'bounds':n.get('bounds',''),
        'clickable':n.get('clickable')=='true'}
       for n in tree.iter('node')
       if n.get('text') or n.get('resource-id') or n.get('content-desc')]
json.dump(els, sys.stdout, indent=2)"
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

# Stream only React Native errors
adb logcat -s ReactNative:E ReactNativeJS:E \
  --pid=$(adb shell pidof -s com.example.app)

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

## Concurrent State Snapshot Script (Phase 6)

The `scripts/snapshot_state.sh` script (to be created in Phase 6) will capture
screenshot + UI hierarchy simultaneously, cutting state-check time by ~40%.

```bash
# Planned usage
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
| Android screenshot (gzipped) | `adb exec-out "screencap \| gzip -1"` | 150ms | 250KB |
| Android UI hierarchy | `adb shell uiautomator dump --compressed` | 300-500ms | 15-30KB XML |
| Android UI hierarchy (parsed) | above + python3 filter | 350-550ms | 2-3KB JSON |

---

## Prerequisites

| Tool | Required | Install |
|------|----------|---------|
| Xcode + Command Line Tools | iOS | Mac App Store |
| xcrun simctl | iOS | Included with Xcode |
| Android SDK (adb) | Android | developer.android.com/studio |
| Python 3 | Android hierarchy parsing | Pre-installed on macOS |
