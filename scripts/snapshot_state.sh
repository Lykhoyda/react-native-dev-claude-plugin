#!/bin/bash
# snapshot_state.sh — Concurrent screenshot + UI hierarchy capture
# Usage: bash scripts/snapshot_state.sh [ios|android] [output_dir]
#
# iOS output: screenshot.jpg
# Android output: screenshot.png + ui_elements.json

set -euo pipefail

PLATFORM="${1:-auto}"
OUTPUT_DIR="${2:-/tmp/rn-dev-agent}"

mkdir -p "$OUTPUT_DIR"

# Cleanup background jobs on exit to prevent orphaned processes
cleanup() {
  local pids
  pids=$(jobs -p 2>/dev/null) || true
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    wait $pids 2>/dev/null || true
  fi
}
trap cleanup EXIT

detect_platform() {
  if xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
    echo "ios"
  elif adb devices 2>/dev/null | grep -q "device$"; then
    echo "android"
  else
    echo "none"
  fi
}

if [ "$PLATFORM" = "auto" ]; then
  PLATFORM=$(detect_platform)
  if [ "$PLATFORM" = "none" ]; then
    echo "Error: No iOS Simulator or Android device/emulator detected." >&2
    exit 1
  fi
fi

case "$PLATFORM" in
  ios)
    xcrun simctl io booted screenshot --type=jpeg "$OUTPUT_DIR/screenshot.jpg"
    echo "iOS snapshot saved to $OUTPUT_DIR/screenshot.jpg"
    ;;

  android)
    # Check for multiple connected devices
    DEVICE_COUNT=$(adb devices 2>/dev/null | grep -c "device$" || true)
    if [ "$DEVICE_COUNT" -gt 1 ]; then
      echo "Warning: Multiple Android devices detected ($DEVICE_COUNT). Using first device." >&2
      echo "Specify a device with ANDROID_SERIAL env var if needed." >&2
    fi

    # Run screenshot and UI hierarchy dump concurrently
    adb exec-out screencap -p > "$OUTPUT_DIR/screenshot.png" &
    PID_SCREENSHOT=$!

    # Dump UI hierarchy to device file first, then pull it — piping /dev/stdout
    # prepends a status message that corrupts the XML output
    (
      adb shell uiautomator dump --compressed /data/local/tmp/uidump.xml >/dev/null 2>&1
      adb exec-out cat /data/local/tmp/uidump.xml | \
        python3 -c "
import xml.etree.ElementTree as ET, json, sys
try:
    tree = ET.parse(sys.stdin)
    els = [{'text':n.get('text',''),'id':n.get('resource-id',''),
            'desc':n.get('content-desc',''),'bounds':n.get('bounds',''),
            'clickable':n.get('clickable')=='true'}
           for n in tree.iter('node')
           if n.get('text') or n.get('resource-id') or n.get('content-desc')]
    json.dump(els, sys.stdout, indent=2)
except Exception as e:
    print(f'Error parsing UI hierarchy XML: {e}', file=sys.stderr)
    json.dump([], sys.stdout)
    sys.exit(1)
"
      adb shell rm -f /data/local/tmp/uidump.xml 2>/dev/null || true
    ) > "$OUTPUT_DIR/ui_elements.json" &
    PID_HIERARCHY=$!

    # Wait for both jobs — capture exit codes individually
    SCREENSHOT_OK=0
    HIERARCHY_OK=0
    wait $PID_SCREENSHOT || SCREENSHOT_OK=$?
    wait $PID_HIERARCHY || HIERARCHY_OK=$?

    if [ "$SCREENSHOT_OK" -ne 0 ]; then
      echo "Warning: Screenshot capture failed (exit $SCREENSHOT_OK)." >&2
    fi
    if [ "$HIERARCHY_OK" -ne 0 ]; then
      echo "Warning: UI hierarchy dump failed (exit $HIERARCHY_OK)." >&2
    fi

    echo "Android snapshot saved to $OUTPUT_DIR/"
    echo "  screenshot.png + ui_elements.json"

    # Exit with error only if both failed
    if [ "$SCREENSHOT_OK" -ne 0 ] && [ "$HIERARCHY_OK" -ne 0 ]; then
      exit 1
    fi
    ;;

  *)
    echo "Error: Unknown platform '$PLATFORM'. Use 'ios' or 'android'." >&2
    exit 1
    ;;
esac
