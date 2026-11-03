#!/usr/bin/env bash
# Run inside xvfb-run + dbus-run-session. Own only this test's Openbox process.
set -euo pipefail
if [[ $# -eq 0 ]]; then
  echo 'usage: run-linux-desktop-test.sh COMMAND [ARGS...]' >&2
  exit 2
fi
: "${DISPLAY:?Run this wrapper inside xvfb-run}"
: "${DBUS_SESSION_BUS_ADDRESS:?Run this wrapper inside dbus-run-session}"
for binary in openbox xprop; do command -v "$binary" >/dev/null; done
log_dir="${HORIZON_WM_LOG_DIR:-artifacts/linux/window-manager}"
mkdir -p "$log_dir"
# Never replace another window manager. The expected environment is a fresh Xvfb.
if xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -Eq 'window id # 0x[1-9a-fA-F][0-9a-fA-F]*'; then
  echo 'Refusing to replace an existing window manager; use a fresh Xvfb display.' >&2
  exit 2
fi
openbox --sm-disable >"$log_dir/openbox.log" 2>&1 &
wm_pid=$!
cleanup() {
  kill "$wm_pid" 2>/dev/null || true
  wait "$wm_pid" 2>/dev/null || true
}
trap cleanup EXIT
for attempt in {1..100}; do
  if ! kill -0 "$wm_pid" 2>/dev/null; then
    cat "$log_dir/openbox.log" >&2
    echo 'Openbox exited before registering as window manager.' >&2
    exit 1
  fi
  if xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -Eq 'window id # 0x[1-9a-fA-F][0-9a-fA-F]*'; then
    xprop -root _NET_SUPPORTING_WM_CHECK >"$log_dir/root-wm-check.txt"
    printf 'display=%s\nopenbox_pid=%s\n' "$DISPLAY" "$wm_pid" >"$log_dir/session.txt"
    "$@"
    exit $?
  fi
  sleep 0.1
done
echo 'Timed out waiting for Openbox _NET_SUPPORTING_WM_CHECK.' >&2
exit 1
