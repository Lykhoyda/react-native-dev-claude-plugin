#!/usr/bin/env bash
set -euo pipefail

PID_PREFIX="/tmp/rn-dev-agent-record"

usage() {
  cat <<'EOF'
Usage: record_proof.sh <subcommand> [args]

Subcommands:
  start <platform> <output-path>   Start background video recording
  stop                             Stop all active recordings
  status                           Show active recordings
  convert-gif <input> <output>     Convert video to GIF (requires ffmpeg)

Platforms: ios, android
EOF
  exit 1
}

pid_file() { echo "${PID_PREFIX}-${1}.pid"; }
path_file() { echo "${PID_PREFIX}-${1}.path"; }

is_alive() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null
}

cmd_start() {
  local platform="${1:-}"
  local output_path="${2:-}"

  [[ -z "$platform" || -z "$output_path" ]] && { echo "Error: start requires <platform> <output-path>" >&2; exit 1; }
  [[ "$platform" != "ios" && "$platform" != "android" ]] && { echo "Error: platform must be ios or android" >&2; exit 1; }

  local pf
  pf="$(pid_file "$platform")"
  if [[ -f "$pf" ]] && is_alive "$(cat "$pf")"; then
    echo "Error: Recording already in progress for $platform (PID $(cat "$pf"))" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$output_path")"
  output_path="$(cd "$(dirname "$output_path")" && pwd)/$(basename "$output_path")"

  if [[ "$platform" == "ios" ]]; then
    if ! xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
      echo "Error: No iOS simulator booted" >&2
      exit 1
    fi
    xcrun simctl io booted recordVideo --force "$output_path" &
    local rec_pid=$!
  else
    if ! adb devices 2>/dev/null | grep -q "device$"; then
      echo "Error: No Android device connected" >&2
      exit 1
    fi
    local device_path="/sdcard/rn-dev-agent-proof-$$.mp4"
    adb shell screenrecord "$device_path" &
    local rec_pid=$!
  fi

  sleep 0.5
  if ! is_alive "$rec_pid"; then
    echo "Error: Recording process died immediately" >&2
    rm -f "$pf" "$(path_file "$platform")" "${PID_PREFIX}-${platform}.device-path"
    exit 1
  fi

  echo "$rec_pid" > "$pf"
  echo "$output_path" > "$(path_file "$platform")"
  [[ "$platform" == "android" ]] && echo "$device_path" > "${PID_PREFIX}-${platform}.device-path"
  echo "Recording started: platform=$platform pid=$rec_pid output=$output_path"
}

cmd_stop() {
  local found=false
  local saved_paths=()

  for pf in "${PID_PREFIX}"-*.pid; do
    [[ -f "$pf" ]] || continue
    found=true

    local platform
    platform="$(basename "$pf" .pid | sed "s/^$(basename "$PID_PREFIX")-//")"
    local pid
    pid="$(cat "$pf")"
    local output_path=""
    local pathf
    pathf="$(path_file "$platform")"
    [[ -f "$pathf" ]] && output_path="$(cat "$pathf")"

    if is_alive "$pid"; then
      kill -INT "$pid" 2>/dev/null || true

      local waited=0
      while is_alive "$pid" && [[ $waited -lt 10 ]]; do
        sleep 0.5
        waited=$((waited + 1))
      done

      if is_alive "$pid"; then
        echo "Warning: Recording process $pid did not stop gracefully, force killing" >&2
        kill -9 "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
        sleep 3
      fi
    fi

    if [[ "$platform" == "android" && -n "$output_path" ]]; then
      local device_pathf="${PID_PREFIX}-${platform}.device-path"
      if [[ -f "$device_pathf" ]]; then
        local device_path
        device_path="$(cat "$device_pathf")"
        sleep 2
        adb pull "$device_path" "$output_path" 2>/dev/null || echo "Warning: Failed to pull recording from device" >&2
        adb shell rm -f "$device_path" 2>/dev/null || true
        rm -f "$device_pathf"
      fi
    fi

    rm -f "$pf" "$pathf"

    if [[ -n "$output_path" && -f "$output_path" ]]; then
      local size
      size="$(wc -c < "$output_path" | tr -d ' ')"
      echo "Saved: $output_path ($size bytes)"
      saved_paths+=("$output_path")
    else
      echo "Warning: Recording for $platform may not have saved correctly" >&2
    fi
  done

  if [[ "$found" == "false" ]]; then
    echo "No active recordings found"
  fi

  for p in "${saved_paths[@]+"${saved_paths[@]}"}"; do
    echo "$p"
  done
}

cmd_status() {
  local found=false
  for pf in "${PID_PREFIX}"-*.pid; do
    [[ -f "$pf" ]] || continue
    found=true
    local platform
    platform="$(basename "$pf" .pid | sed "s/^$(basename "$PID_PREFIX")-//")"
    local pid
    pid="$(cat "$pf")"
    local status="dead"
    is_alive "$pid" && status="recording"
    local pathf
    pathf="$(path_file "$platform")"
    local output=""
    [[ -f "$pathf" ]] && output="$(cat "$pathf")"
    echo "$platform: pid=$pid status=$status output=$output"
  done
  [[ "$found" == "false" ]] && echo "No active recordings"
}

cmd_convert_gif() {
  local input="${1:-}"
  local output="${2:-}"

  [[ -z "$input" || -z "$output" ]] && { echo "Error: convert-gif requires <input> <output>" >&2; exit 1; }
  [[ ! -f "$input" ]] && { echo "Error: Input file not found: $input" >&2; exit 1; }

  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "Warning: ffmpeg not available. Skipping GIF conversion." >&2
    echo "Install: brew install ffmpeg" >&2
    exit 0
  fi

  ffmpeg -i "$input" -vf "fps=10,scale=360:-1:flags=lanczos" -y "$output" 2>/dev/null

  local size
  size="$(wc -c < "$output" | tr -d ' ')"
  echo "GIF created: $output ($size bytes)"
}

case "${1:-}" in
  start)       shift; cmd_start "$@" ;;
  stop)        cmd_stop ;;
  status)      cmd_status ;;
  convert-gif) shift; cmd_convert_gif "$@" ;;
  *)           usage ;;
esac
