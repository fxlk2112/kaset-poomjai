#!/usr/bin/env python3
"""Publish the reviewed LAN alias without replacing the Pi's reverse DNS record."""
import json
import os
from pathlib import Path

if __name__=='__main__':
    try:
        cfg=json.loads(Path('/etc/sucha-farm-lan/config.json').read_text())
        address=cfg['bind'].rsplit(':',1)[0]
        # Avahi owns multicast; this helper only connects to its existing D-Bus API.
        with open(os.devnull,'w') as quiet:
            os.dup2(quiet.fileno(),1);os.dup2(quiet.fileno(),2)
        os.execv('/usr/bin/avahi-publish-address',['avahi-publish-address','--no-reverse','--no-fail','farmultimate.local',address])
    except Exception: raise SystemExit(1)
