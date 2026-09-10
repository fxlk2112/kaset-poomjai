"""Scoped on-device installer. Receives this directory plus energy_observations.py.

Run as root with zero/five. Existing project credentials stay on their devices.
No meter settings, relay commands, water service restart or network listener.
"""
import grp
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import sys
import time
import venv

def private_runtime(target, source_python):
    """Reuse installed paho bytes, without granting access to water credentials."""
    runtime = target / 'venv'
    venv.EnvBuilder(with_pip=False).create(runtime)
    python = str(runtime / 'bin/python')
    package = Path(command([source_python, '-c', 'import paho.mqtt; print(next(iter(paho.mqtt.__path__)))'])).parent
    library = Path(command([python, '-c', 'import sysconfig; print(sysconfig.get_paths()["purelib"])']))
    shutil.copytree(package, library / 'paho', dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__'))
    for path in runtime.rglob('*'):
        if not path.is_symlink():
            os.chmod(path, 0o755 if path.is_dir() or path.parent == runtime / 'bin' else 0o644)
    command([python, '-c', 'import paho.mqtt.client; assert hasattr(paho.mqtt.client.CallbackAPIVersion,"VERSION2")'])
    return python

def command(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()

def install(mode):
    if mode not in ('zero', 'five') or os.geteuid() != 0:
        raise ValueError('ROOT_AND_MODE_REQUIRED')
    source = Path(__file__).resolve().parent
    zero = mode == 'zero'
    service = 'sucha-energy-observer' if zero else 'sucha-energy-ingest'
    user = 'sucha-energy' if zero else 'sucha-energy-ingest'
    group = user if zero else 'sucha-dashboard'
    target = Path('/opt/sucha-energy-observer' if zero else '/opt/sucha-energy-monitor')
    database_dir = Path('/var/lib/sucha-energy-observer' if zero else '/var/lib/sucha-energy-monitor')
    python = '/opt/sucha-water-publisher/venv/bin/python' if zero else '/opt/sucha-water-dashboard/venv/bin/python'
    command([python, '-c', 'import paho.mqtt.client; assert hasattr(paho.mqtt.client.CallbackAPIVersion,"VERSION2")'])
    try:
        pwd.getpwnam(user)
    except KeyError:
        command(['useradd', '--system', '--user-group', '--no-create-home', '--shell', '/usr/sbin/nologin', user])
    account = pwd.getpwnam(user)
    group_id = grp.getgrnam(group).gr_gid
    target.mkdir(parents=True, exist_ok=True)
    if zero:
        python = private_runtime(target, python)
    database_dir.mkdir(parents=True, exist_ok=True)
    os.chown(database_dir, account.pw_uid, group_id)
    os.chmod(database_dir, 0o700 if zero else 0o770)
    backup = target / ('backup-' + str(time.time_ns()))
    backup.mkdir(mode=0o700)
    changes = []
    def put(path, content, mode=0o644):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        old = None
        if path.exists():
            old = backup / str(len(changes))
            shutil.copy2(path, old)
        raw = content if isinstance(content, bytes) else content.encode()
        temp = path.with_name(path.name + '.energy-new')
        temp.write_bytes(raw)
        os.chmod(temp, mode)
        os.replace(temp, path)
        changes.append({'path': str(path), 'backup': str(old) if old else None, 'sha256': hashlib.sha256(raw).hexdigest()})
    put(target / 'energy_observations.py', (source / 'energy_observations.py').read_bytes())
    put(target / 'uninstall.py', (source / 'uninstall.py').read_bytes())
    if zero:
        config_dir = Path('/etc/sucha-energy-observer')
        config_dir.mkdir(mode=0o750, exist_ok=True)
        os.chown(config_dir, 0, group_id)
        cfg = {}
        for line in Path('/etc/sucha-irrigation/mqtt-edge.env').read_text().splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k, value = line.split('=', 1)
                cfg[k.strip()] = value.strip().strip('"\'')
        choices = [p for p in Path('/dev/serial/by-id').glob('*') if p.resolve() == Path('/dev/ttyUSB0')]
        if len(choices) != 1:
            raise ValueError('EXACT_SERIAL_PORT_REQUIRED')
        busy = subprocess.run(['fuser', '/dev/ttyUSB0'], capture_output=True, text=True)
        if busy.stdout.strip():
            raise ValueError('PORT_ALREADY_IN_USE')
        settings = {'mqtt_host': cfg['MQTT_HOST'], 'mqtt_port': int(cfg['MQTT_PORT']), 'mqtt_user': cfg['MQTT_USER'],
                    'serial_port': str(choices[0]), 'database': str(database_dir / 'outbox.sqlite3')}
        put(config_dir / 'config.json', json.dumps(settings), 0o640)
        os.chown(config_dir / 'config.json', 0, group_id)
        for name in ('serial_reader.py', 'observer.py'):
            put(target / name, (source / name).read_bytes())
        extra = 'SupplementaryGroups=dialout\nLoadCredential=mqtt-password:/etc/sucha-irrigation/mqtt-edge.secret\nDevicePolicy=closed\nDeviceAllow=char-ttyUSB rw\n'
        main = 'observer.py'
    else:
        put(target / 'ingest.py', (source / 'ingest.py').read_bytes())
        # Existing authenticated edge user gets only this observation topic and its receipt topic.
        acl_path = Path('/etc/mosquitto/sucha-acl')
        acl = acl_path.read_text().splitlines()
        start = acl.index('user sucha-edge')
        end = next((i for i in range(start + 1, len(acl)) if acl[i].strip().startswith('user ')), len(acl))
        rules = ['topic write irrigation/sensors/energy/UNASSIGNED_METER_01/observation',
                 'topic read irrigation/sensors/energy/UNASSIGNED_METER_01/ack']
        missing = [x for x in rules if x not in acl[start:end]]
        if missing:
            acl[end:end] = missing
            put(acl_path, '\n'.join(acl) + '\n', 0o640)
            os.chown(acl_path, 0, grp.getgrnam('mosquitto').gr_gid)
            command(['systemctl', 'reload', 'mosquitto.service'])
        extra = 'PrivateDevices=true\n'
        main = 'ingest.py'
    unit = f'''[Unit]
Description=FARMULTIMATE uncommissioned energy observations DATA_ONLY
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=10
[Service]
Type=simple
User={user}
Group={group}
WorkingDirectory={target}
ExecStart={python} {target / main}
Restart=always
RestartSec=10
TimeoutStopSec=15
StateDirectory={database_dir.name}
StateDirectoryMode={'0700' if zero else '0770'}
UMask={'0077' if zero else '0007'}
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
{extra}[Install]
WantedBy=multi-user.target
'''
    put('/etc/systemd/system/' + service + '.service', unit)
    (target / 'rollback.json').write_text(json.dumps({'service': service, 'changes': changes}, indent=2))
    os.chmod(target / 'rollback.json', 0o600)
    command(['systemctl', 'daemon-reload'])
    command(['systemctl', 'enable', '--now', service + '.service'])
    print(json.dumps({'status': 'INSTALLED', 'service': service, 'mode': mode, 'observation_only': True}))

if __name__ == '__main__':
    try:
        install(sys.argv[1])
    except Exception as error:
        print(json.dumps({'status': 'INSTALL_FAILED', 'error_type': type(error).__name__}))
        raise SystemExit(1)
