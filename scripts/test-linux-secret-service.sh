#!/usr/bin/env bash
# Real Secret Service acceptance in a disposable home and fresh private session bus.
set -euo pipefail
[[ $(uname -s) == Linux ]] || { echo 'Linux only' >&2; exit 1; }
for tool in cargo python3 dbus-run-session gnome-keyring-daemon gdbus timeout; do command -v "$tool" >/dev/null; done
root=$(mktemp -d "${TMPDIR:-/tmp}/horizon-secret-service-XXXXXXXX")
trap 'rm -rf "$root"' EXIT
# Compile before replacing HOME so rustup/cargo do not need user configuration in the test session.
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --test credentials_linux_secret_service --no-run --message-format=json > "$root/build.jsonl"
binary=$(python3 - "$root/build.jsonl" <<'PY'
import json,sys
artifacts=[d['executable'] for line in open(sys.argv[1]) if (d:=json.loads(line)).get('reason')=='compiler-artifact' and d.get('target',{}).get('name')=='credentials_linux_secret_service' and d.get('executable')]
assert len(artifacts)==1, artifacts
print(artifacts[0])
PY
)
mkdir -p "$root/home" "$root/data/keyrings" "$root/config" "$root/runtime" "$root/control"
chmod 700 "$root" "$root/home" "$root/data" "$root/runtime" "$root/control"
printf 'horizon-synthetic-keyring-only\n' > "$root/fixture-marker"
# No inherited bus, real account variables, provider keys, home, or user keyring.
timeout 90s env -i PATH="$PATH" HOME="$root/home" XDG_DATA_HOME="$root/data" XDG_CONFIG_HOME="$root/config" XDG_RUNTIME_DIR="$root/runtime" HORIZON_SECRET_SERVICE_FIXTURE="$root" HORIZON_KEYRING_TEST_BINARY="$binary" dbus-run-session -- bash --noprofile --norc -euo pipefail <<'INNER'
printf 'synthetic-fixture-keyring-password' | gnome-keyring-daemon --foreground --unlock --components=secrets --control-directory="$HORIZON_SECRET_SERVICE_FIXTURE/control" > "$HORIZON_SECRET_SERVICE_FIXTURE/daemon.log" 2>&1 &
daemon=$!
trap 'result=$?; if [[ $result != 0 ]]; then cat "$HORIZON_SECRET_SERVICE_FIXTURE/daemon.log" >&2; fi; kill "$daemon" 2>/dev/null || true; wait "$daemon" 2>/dev/null || true; exit "$result"' EXIT
timeout 15s gdbus wait --session org.freedesktop.secrets
alias=$(gdbus call --session --dest org.freedesktop.secrets --object-path /org/freedesktop/secrets --method org.freedesktop.Secret.Service.ReadAlias default)
[[ "$alias" != "(objectpath '/',)" ]] || { cat "$HORIZON_SECRET_SERVICE_FIXTURE/daemon.log" >&2; echo 'No default collection' >&2; exit 1; }
collection=$(printf '%s' "$alias" | sed -n "s/.*objectpath '\([^']*\)'.*/\1/p")
[[ "$collection" == /org/freedesktop/secrets/collection/* ]] || { echo 'Invalid default collection' >&2; exit 1; }
locked=$(gdbus call --session --dest org.freedesktop.secrets --object-path "$collection" --method org.freedesktop.DBus.Properties.Get org.freedesktop.Secret.Collection Locked)
[[ "$locked" == "(<false>,)" ]] || { echo 'Fixture collection is locked; refusing interactive prompt' >&2; exit 1; }
"$HORIZON_KEYRING_TEST_BINARY" --list --ignored | grep -Fx "real_linux_secret_service_roundtrip: test"
"$HORIZON_KEYRING_TEST_BINARY" real_linux_secret_service_roundtrip --exact --ignored --nocapture --test-threads=1
INNER
