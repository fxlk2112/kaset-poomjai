#!/usr/bin/env python3
"""Keep the last validated public forecast when WAN is unavailable."""
import json
import os
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

def update(target='/var/lib/sucha-owner-weather/latest.json'):
    req=urllib.request.Request('https://flytech-farmultimate-owner-staging.pongnarin-pa.workers.dev/api/monitor/weather',headers={'User-Agent':'FARMULTIMATE-LAN-Weather/1.0','Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=15) as r: raw=r.read(512001)
    if len(raw)>512000: raise ValueError()
    p=json.loads(raw)
    d=p.get('data',{})
    if p.get('ok') is not True or d.get('output_control_allowed') is not False or d.get('forecast_only') is not True or d.get('station_truth_available') is not False: raise ValueError()
    issued=datetime.fromisoformat(d['generated_at'].replace('Z','+00:00'))
    if issued.tzinfo is None or (issued-datetime.now(timezone.utc)).total_seconds()>120: raise ValueError()
    path=Path(target)
    if path.exists():
        previous=json.loads(path.read_text())
        if datetime.fromisoformat(previous['generated_at'].replace('Z','+00:00'))>=issued: return False
    temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(d,separators=(',',':')),encoding='utf-8')
    temp.chmod(0o640)
    os.replace(temp,path)
    return True

if __name__=='__main__':
    try: print(json.dumps({'result':'PASS','updated':update()}))
    except Exception: print('{"result":"KEEP_LAST_FORECAST"}')
