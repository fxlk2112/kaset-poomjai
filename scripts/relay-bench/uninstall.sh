#!/bin/sh
set -eu
test "$(id -u)" = 0
# Graceful shutdown performs OFF/readback; hardware pulses also expire on their own.
systemctl disable --now sucha-relay-bench.service
rm -f /etc/systemd/system/relay-observer.service.d/bench-serialization.conf
systemctl daemon-reload
systemctl try-restart relay-observer.service
python3 - <<'PY'
import json
from pathlib import Path
p=Path('/etc/sucha-relay-bench/config.json')
d=json.loads(p.read_text());d['owner_confirmed_no_load']=False
p.write_text(json.dumps(d)+'\n')
PY
printf 'BENCH_DISABLED; configuration and journal retained for audit\n'
