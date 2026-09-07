#!/bin/sh
set -eu
test "$(id -u)" = 0
if systemctl is-active --quiet sucha-relay-bench.service; then
  printf 'STOP_BENCH_BEFORE_INSTALL\n' >&2
  exit 1
fi
cd "$(dirname "$0")"
test -f /opt/sucha-relay-observer/app/relay-observer.json
test -f /etc/sucha-irrigation/farmultimate-device-token.secret
getent group sucha-relay-observer >/dev/null
getent passwd sucha-relay-bench >/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin sucha-relay-bench
install -d -m 755 /opt/sucha-relay-bench
install -d -m 750 -o root -g sucha-relay-observer /var/lib/sucha-relay-bus
touch /var/lib/sucha-relay-bus/access.lock
chown root:sucha-relay-observer /var/lib/sucha-relay-bus/access.lock
chmod 660 /var/lib/sucha-relay-bus/access.lock
install -d -m 750 -o root -g sucha-relay-bench /etc/sucha-relay-bench
install -m 644 agent.py /opt/sucha-relay-bench/agent.py
install -m 644 bus_lock.py observer_serialized.py /opt/sucha-relay-bench/
install -d -m 755 /etc/systemd/system/relay-observer.service.d
install -m 644 observer-serialization.conf /etc/systemd/system/relay-observer.service.d/bench-serialization.conf
install -m 644 sucha-relay-bench.service /etc/systemd/system/sucha-relay-bench.service
python3 - <<'PY'
import hashlib,json,os,grp
from pathlib import Path
path=Path('/etc/sucha-relay-bench/config.json')
data={'mode':'NO_LOAD_BENCH','owner_confirmed_no_load':True,'authorization':'OWNER-RELAY-BENCH-001_2026-09-06','observer_config_sha256':hashlib.sha256(Path('/opt/sucha-relay-observer/app/relay-observer.json').read_bytes()).hexdigest()}
if path.exists() and json.loads(path.read_text())!=data:
    raise SystemExit('EXISTING_BENCH_CONFIG_CHANGED')
path.write_text(json.dumps(data)+'\n')
os.chmod(path,0o640)
os.chown(path,0,grp.getgrnam('sucha-relay-bench').gr_gid)
PY
systemd-analyze verify /etc/systemd/system/sucha-relay-bench.service
systemctl daemon-reload
# Preparation never starts the writer. Read-only preflight precedes bench testing.
python3 /opt/sucha-relay-bench/agent.py --preflight
printf 'BENCH_PREPARED_NOT_STARTED\n'
