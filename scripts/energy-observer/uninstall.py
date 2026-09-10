"""Roll back only matching installed files. Keep all measurement databases."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'rollback.json').read_text())
for item in manifest['changes']:
    path = Path(item['path'])
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        raise SystemExit('ROLLBACK_BLOCKED_FILE_CHANGED')
subprocess.run(['systemctl', 'disable', '--now', manifest['service'] + '.service'], check=True, capture_output=True)
for item in reversed(manifest['changes']):
    path = Path(item['path'])
    if item['backup']:
        shutil.copy2(item['backup'], path)
    else:
        path.unlink()
subprocess.run(['systemctl', 'daemon-reload'], check=True, capture_output=True)
if any(item['path'] == '/etc/mosquitto/sucha-acl' for item in manifest['changes']):
    subprocess.run(['systemctl', 'reload', 'mosquitto.service'], check=True, capture_output=True)
print(json.dumps({'status': 'ROLLED_BACK', 'measurement_databases': 'PRESERVED'}))
