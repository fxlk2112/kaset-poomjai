#!/usr/bin/env python3
"""Mirror health with read-only SQLite and outbound HTTPS; no hardware imports."""
import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCES = ("PI5_CONTROLLER_01", "PI_ZERO_GATEWAY_01")
DEFAULT_DATABASE = "/var/lib/sucha-water-dashboard/water-level.sqlite3"
ENDPOINT = "https://flytech-farmultimate-owner-staging.pongnarin-pa.workers.dev/api/monitor/publish"
METRICS = "observed_at,quality,temp_c,load1,load5,load15,uptime_s,cpu_count"
DEFAULT_RELAY_SNAPSHOT = "/var/lib/sucha-relay-observer/latest.json"

def relay_snapshot(path=DEFAULT_RELAY_SNAPSHOT):
    """Project the existing observer file; never poll or write hardware here."""
    empty = {"observed_at": None, "modules": [], "output_control_allowed": False}
    try:
        with Path(path).open("rb") as stream:
            raw = stream.read(65537)
        if len(raw) > 65536:
            return empty
        data = json.loads(raw)
        safety = data.get("safety", {})
        if safety.get("output_control_allowed") is not False or safety.get("actual_output_write_enabled") is not False:
            return empty
        observed = data.get("observed_at")
        if not isinstance(observed, str) or datetime.fromisoformat(observed.replace("Z", "+00:00")).tzinfo is None:
            return empty
        modules, seen = [], set()
        for device in data.get("devices", []):
            identifier = {"relay_a": "RELAY_A", "relay_b": "RELAY_B"}.get(device.get("id"))
            if not identifier or identifier in seen:
                return empty
            seen.add(identifier)
            def bits(key):
                rows = device.get(key)
                return [v if isinstance(v, bool) else None for v in rows] if isinstance(rows, list) and len(rows) == 8 else [None] * 8
            modules.append({"id": identifier, "online": device.get("connectivity") is True,
                "identity_verified": device.get("identity_match") is True, "crc_valid": device.get("crc_valid") is True,
                "relay_status": bits("relay_status"), "digital_inputs": bits("digital_inputs")})
        return {"observed_at": observed, "modules": modules, "output_control_allowed": False}
    except (OSError, ValueError, TypeError, AttributeError):
        return empty

def health_snapshot(database=DEFAULT_DATABASE, now=None, relay_path=DEFAULT_RELAY_SNAPSHOT):
    now = time.time() if now is None else now
    out = {"generated_at": datetime.fromtimestamp(now, timezone.utc).isoformat(), "output_control_allowed": False, "sources": {}, "history": {}}
    with sqlite3.connect(Path(database).as_uri() + "?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA query_only=ON")
        for source in SOURCES:
            current = db.execute("SELECT " + METRICS + " FROM pi_health_samples WHERE source_id=? ORDER BY observed_epoch DESC LIMIT 1", (source,)).fetchone()
            count = db.execute("SELECT COUNT(*) FROM pi_health_samples WHERE source_id=? AND observed_epoch>=?", (source, now-86400)).fetchone()[0]
            out["sources"][source] = {"current": dict(current) if current else None, "samples_24h": count}
            # Keep the final real sample in each 15-minute interval; do not average faults away.
            rows = db.execute("SELECT " + METRICS + ",MAX(observed_epoch) AS observed_epoch FROM pi_health_samples WHERE source_id=? AND observed_epoch>=? GROUP BY CAST(observed_epoch/900 AS INTEGER) ORDER BY observed_epoch", (source, now-7*86400)).fetchall()
            out["history"][source] = [dict(row) for row in rows][-700:]
    out["relays"] = relay_snapshot(relay_path)
    return out

def publish(kind, data, endpoint=ENDPOINT):
    credentials = os.environ.get("CREDENTIALS_DIRECTORY")
    token_path = Path(credentials)/"farmultimate_device_token" if credentials else Path("/etc/sucha-irrigation/farmultimate-device-token.secret")
    token = token_path.read_text().strip()
    if len(token) != 64 or any(c not in "0123456789abcdefABCDEF" for c in token):
        raise ValueError("Credential format invalid")
    raw = json.dumps({"kind":kind,"data":data}, separators=(",", ":"), ensure_ascii=False).encode()
    if len(raw) > 512000:
        raise ValueError("Snapshot too large")
    request = urllib.request.Request(endpoint, data=raw, headers={"Content-Type":"application/json", "Authorization":"Bearer "+token, "User-Agent":"FARMULTIMATE-Owner-Monitor/1.0", "Accept":"application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=20) as response:
        result = json.loads(response.read(4096))
    if not result.get("ok"):
        raise RuntimeError("Cloud rejected snapshot")
    return {"result":"PASS", "kind":kind, "stored":result["data"]["stored"], "observed_at":result["data"]["observed_at"], "output_control_allowed":False}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weather-stdin", action="store_true")
    parser.add_argument("--health-stdin", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        kind = "weather" if args.weather_stdin else "health"
        if args.weather_stdin or args.health_stdin:
            raw = sys.stdin.buffer.read(512001)
            if len(raw) > 512000: raise ValueError("Snapshot too large")
            data = json.loads(raw.decode("utf-8-sig"))
        else:
            data = health_snapshot()
        if args.dry_run:
            print(json.dumps({"result":"DRY_RUN_PASS", "kind":kind, "sources":{k: {"has_current":bool(v["current"]), "history_rows":len(data["history"][k])} for k,v in data.get("sources",{}).items()}, "output_control_allowed":data.get("output_control_allowed")}, separators=(",", ":")))
        else:
            print(json.dumps(publish(kind,data), separators=(",", ":")))
        return 0
    except Exception as error:
        # Never log payloads, credentials, private paths, endpoint errors or coordinates.
        print(json.dumps({"result":"FAILED", "error_type":type(error).__name__, "sqlite_errorcode":getattr(error,"sqlite_errorcode",None), "output_control_allowed":False}))
        return 1

if __name__ == "__main__":
    sys.exit(main())
