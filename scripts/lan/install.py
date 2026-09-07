#!/usr/bin/env python3
"""Install one reviewed LAN release on the existing Pi. No router/firewall changes."""
import argparse
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

BASE=Path('/opt/sucha-farm-lan')
BACKUP=Path('/var/lib/sucha-farm-lan-install')
DROP=Path('/etc/systemd/system/sucha-relay-bench.service.d/70-farm-lan.conf')
MARKER='# FARMULTIMATE_LAN_OWNER_001'
UNITS=('sucha-farm-lan.service','sucha-lan-weather.service','sucha-lan-weather.timer','sucha-lan-alias.service')

def run(*args):
    return subprocess.check_output(args,stderr=subprocess.PIPE,text=True).strip()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--expected-agent-sha',required=True)
    args=parser.parse_args();source=Path(args.source).resolve()
    if os.geteuid()!=0 or not str(source).startswith('/tmp/sucha-lan-'): raise RuntimeError('SOURCE_DENIED')
    if DROP.exists() or BACKUP.exists(): raise RuntimeError('ALREADY_INSTALLED_REVIEW_REQUIRED')
    agent=Path('/opt/sucha-relay-bench/agent.py')
    if hashlib.sha256(agent.read_bytes()).hexdigest()!=args.expected_agent_sha: raise RuntimeError('AGENT_CHANGED')
    for unit in UNITS:
        if Path('/etc/systemd/system',unit).exists(): raise RuntimeError('UNIT_EXISTS')
    for path in ('config.json','owner.json','tls/server.key','tls/server.crt'):
        if not Path('/etc/sucha-farm-lan',path).is_file(): raise RuntimeError('PROVISION_FIRST')
    if run('ss','-Hlnt','sport = :8443'): raise RuntimeError('PORT_IN_USE')
    if not Path('/usr/bin/avahi-publish-address').is_file(): raise RuntimeError('PROVISION_FIRST')
    cfg=json.loads(Path('/etc/sucha-farm-lan/config.json').read_text())
    avahi=Path('/etc/avahi/hosts');old=avahi.read_text()
    if any('farmultimate.local' in line.split('#')[0] for line in old.splitlines()): raise RuntimeError('MDNS_NAME_EXISTS')
    if subprocess.run(['timeout','4','getent','ahostsv4','farmultimate.local'],capture_output=True).returncode==0: raise RuntimeError('MDNS_NAME_EXISTS')
    # Read-only bus probe shares the driver's bus lock; never constructs a Controller.
    sys.path.insert(0,str(agent.parent))
    from agent import load_driver
    rows=load_driver('/etc/sucha-relay-bench/config.json').read_all()
    if len(rows)!=2 or any(any(r['relay_status']) for r in rows): raise RuntimeError('BENCH_MUST_BE_OFF')
    build=json.loads((source/'.lan-dist/build.json').read_text());release=build['release_commit']
    if len(release)!=40 or any(c not in '0123456789abcdef' for c in release): raise RuntimeError('RELEASE_INVALID')
    destination=BASE/'releases'/release
    if destination.exists(): raise RuntimeError('RELEASE_EXISTS')
    current=BASE/'current'
    if current.exists() or current.is_symlink(): raise RuntimeError('CURRENT_EXISTS')
    BACKUP.mkdir(mode=0o700)
    shutil.copy2(agent,BACKUP/'agent.py')
    (BACKUP/'state.json').write_text(json.dumps({'release':release,'agent_sha':args.expected_agent_sha}))
    shutil.copytree(source/'.lan-dist',destination)
    for file in ('app.py','cache_weather.py','gunicorn.conf.py','provision.py','uninstall.py','publish_alias.py'):
        shutil.copy2(source/'scripts/lan'/file,BASE/'app'/file)
        (BASE/'app'/file).chmod(0o644)
    # Existing agent service performs all-off on shutdown; the new process also verifies all-off.
    run('systemctl','stop','sucha-relay-bench.service')
    shutil.copy2(source/'scripts/relay-bench/agent.py',agent)
    shutil.copy2(source/'scripts/relay-bench/dual_agent.py',agent.parent/'dual_agent.py')
    DROP.parent.mkdir(exist_ok=True)
    shutil.copy2(source/'scripts/lan/dual-transport.conf',DROP)
    for unit in UNITS: shutil.copy2(source/'scripts/lan'/unit,Path('/etc/systemd/system',unit))
    current.symlink_to(destination,target_is_directory=True)
    run('systemctl','daemon-reload')
    run('systemctl','start','sucha-relay-bench.service')
    run('systemctl','enable','--now','sucha-farm-lan.service','sucha-lan-weather.timer','sucha-lan-alias.service')
    run('systemctl','start','sucha-lan-weather.service')
    for unit in ('sucha-relay-bench.service','sucha-farm-lan.service','sucha-lan-weather.timer'):
        if run('systemctl','is-active',unit)!='active': raise RuntimeError('SERVICE_NOT_ACTIVE')
    print(json.dumps({'result':'LAN_INSTALLED','release':release,'single_writer':True}))

if __name__=='__main__':
    try: main()
    except Exception as e:
        known=('SOURCE_DENIED','ALREADY_INSTALLED_REVIEW_REQUIRED','AGENT_CHANGED','UNIT_EXISTS','PROVISION_FIRST','PORT_IN_USE','MDNS_NAME_EXISTS','BENCH_MUST_BE_OFF','RELEASE_INVALID','RELEASE_EXISTS','CURRENT_EXISTS','SERVICE_NOT_ACTIVE')
        print(json.dumps({'result':'INSTALL_FAILED','reason':str(e) if str(e) in known else 'SANITIZED_FAILURE'}));raise SystemExit(1)
