#!/usr/bin/env python3
"""Roll back only OWNER-LAN-001 services; retain release, credentials and observations."""
import hashlib
import json
import shutil
import subprocess
import os
from pathlib import Path

def run(*args): return subprocess.run(args,capture_output=True,check=True)
def main():
    if os.geteuid()!=0: raise RuntimeError()
    backup=Path('/var/lib/sucha-farm-lan-install')
    state=json.loads((backup/'state.json').read_text())
    if hashlib.sha256((backup/'agent.py').read_bytes()).hexdigest()!=state['agent_sha']: raise RuntimeError()
    run('systemctl','disable','--now','sucha-farm-lan.service','sucha-lan-weather.timer','sucha-lan-alias.service')
    run('systemctl','stop','sucha-relay-bench.service','sucha-lan-weather.service')
    shutil.copy2(backup/'agent.py','/opt/sucha-relay-bench/agent.py')
    drop=Path('/etc/systemd/system/sucha-relay-bench.service.d/70-farm-lan.conf')
    if drop.is_file(): drop.unlink()
    avahi=Path('/etc/avahi/hosts')
    lines=avahi.read_text().splitlines()
    avahi.write_text('\n'.join(line for line in lines if not line.endswith('# FARMULTIMATE_LAN_OWNER_001'))+'\n')
    run('systemctl','reload','avahi-daemon.service')
    run('systemctl','daemon-reload');run('systemctl','start','sucha-relay-bench.service')
    print('{"result":"LAN_DISABLED_CLOUD_AGENT_RESTORED","data_retained":true}')
if __name__=='__main__':
    try: main()
    except Exception: raise SystemExit('ROLLBACK_NEEDS_REVIEW')
