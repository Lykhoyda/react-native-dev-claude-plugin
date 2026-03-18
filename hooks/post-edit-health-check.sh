#!/bin/bash
# post-edit-health-check.sh — PostToolUse hook for Edit/Write/MultiEdit
# Checks for app crashes and compilation errors after RN source file edits.
# Uses last-write-wins debounce: only the most recent edit triggers the check.
#
# Skips when: file is outside an RN project, no simulator booted, Metro not
# running, or app not installed. Downgraded from blocking error to warning
# for "no Hermes target" to avoid interrupting non-RN workflows (GH issue #1).

set -uo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

# Bail if we couldn't parse the file path
if [[ -z "$file_path" ]]; then
  exit 0
fi

# Only check React Native source files (not .d.ts, test files, or config)
if [[ ! "$file_path" =~ \.(tsx?|jsx?)$ ]]; then
  exit 0
fi
if [[ "$file_path" =~ \.(d\.ts)$ ]]; then
  exit 0
fi
if [[ "$file_path" =~ (__tests__|\.test\.|\.spec\.|\.config\.) ]]; then
  exit 0
fi

# --- Guard: only run if the edited file is inside a React Native project ---
# Walk up from the file to find a package.json with react-native dependency
file_dir=$(dirname "$file_path")
is_rn_project=false
check_dir="$file_dir"
for _ in 1 2 3 4 5 6 7 8; do
  if [[ -f "$check_dir/package.json" ]]; then
    if grep -q '"react-native"' "$check_dir/package.json" 2>/dev/null; then
      is_rn_project=true
      break
    fi
  fi
  if [[ "$check_dir" == "/" || "$check_dir" == "." ]]; then
    break
  fi
  check_dir=$(dirname "$check_dir")
done

if [[ "$is_rn_project" != "true" ]]; then
  exit 0  # Not inside an RN project — skip entirely
fi

# --- Guard: check if an iOS simulator is booted ---
if command -v xcrun &>/dev/null; then
  booted=$(xcrun simctl list devices booted 2>/dev/null | grep -c "(Booted)" || echo "0")
  if [[ "$booted" == "0" ]]; then
    exit 0  # No simulator booted — skip
  fi
fi

# --- Guard: check if Metro is running before starting the poll ---
METRO_PORT="${METRO_PORT:-8081}"
metro_status=$(curl -sf --max-time 1 "http://127.0.0.1:$METRO_PORT/status" 2>/dev/null || echo "")
if [[ "$metro_status" != "packager-status:running" ]]; then
  exit 0  # Metro not running — not in a dev session, skip
fi

# Last-write-wins debounce:
# Write a unique token, sleep, then only proceed if our token is still current.
LOCKFILE="${TMPDIR:-/tmp}/rn-dev-agent-health-check.token"
token="$$-$(date +%s%N 2>/dev/null || date +%s)"
echo "$token" > "$LOCKFILE" 2>/dev/null || exit 0

# Bounded poll: check up to 3s, exit early if Metro + targets are ready
max_wait=3
waited=0

while [ "$waited" -lt "$max_wait" ]; do
  sleep 1
  waited=$((waited + 1))

  # Check if a newer edit superseded us
  current_token=$(cat "$LOCKFILE" 2>/dev/null || echo "")
  if [[ "$current_token" != "$token" ]]; then
    exit 0  # Newer edit took over, let it do the check
  fi

  # Check Metro
  metro_status=$(curl -sf --max-time 2 "http://127.0.0.1:$METRO_PORT/status" 2>/dev/null || echo "")
  if [[ "$metro_status" != "packager-status:running" ]]; then
    continue  # Metro might be rebundling, keep waiting
  fi

  # Check debug targets
  targets=$(curl -sf --max-time 2 "http://127.0.0.1:$METRO_PORT/json" 2>/dev/null || echo "[]")
  target_count=$(echo "$targets" | jq 'length' 2>/dev/null || echo "0")

  if [[ "$target_count" != "0" ]]; then
    # Targets exist — verify at least one is Hermes/RN
    has_hermes=$(echo "$targets" | jq '[.[] | select(.title | test("Hermes|React Native"; "i"))] | length' 2>/dev/null || echo "0")
    if [[ "$has_hermes" != "0" ]]; then
      exit 0  # All healthy
    fi
  fi
done

# Final token check before reporting
current_token=$(cat "$LOCKFILE" 2>/dev/null || echo "")
if [[ "$current_token" != "$token" ]]; then
  exit 0
fi

# If we got here, Metro is running but no Hermes targets found.
# This could mean: app crashed, app uninstalled, or app not started.
# Downgrade to non-blocking warning (exit 0 with stderr message) instead
# of blocking error (exit 2) to avoid interrupting workflows. (GH #1)
targets=$(curl -sf --max-time 2 "http://127.0.0.1:$METRO_PORT/json" 2>/dev/null || echo "[]")
target_count=$(echo "$targets" | jq 'length' 2>/dev/null || echo "0")

if [[ "$target_count" == "0" ]]; then
  echo "Post-edit health check: No Hermes debug targets found after editing $(basename "$file_path"). The app may have crashed or is not running. Run cdp_status to check." >&2
  exit 0
fi

has_hermes=$(echo "$targets" | jq '[.[] | select(.title | test("Hermes|React Native"; "i"))] | length' 2>/dev/null || echo "0")
if [[ "$has_hermes" == "0" ]]; then
  echo "Post-edit health check: Debug targets found but none are Hermes/React Native after editing $(basename "$file_path"). Run cdp_status to verify." >&2
  exit 0
fi

exit 0
