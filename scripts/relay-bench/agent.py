#!/usr/bin/env python3
"""Pi-only unloaded relay bench. Fixed hardware pulses; no latched ON builder."""
import argparse
import hashlib
import importlib.util
import json
import os
import signal
import socket
import sqlite3
import struct
import sys
import time
import uuid
import http.client
from urllib.parse import urlsplit
from datetime import datetime, timezone
from pathlib import Path

ENDPOINT = "https://flytech-farmultimate-owner-staging.pongnarin-pa.workers.dev/api/relay-bench/poll"
MODULES = {"RELAY_A": "relay_a", "RELAY_B": "relay_b"}
PULSE_SECONDS = 5

class BenchFault(Exception):
    pass

def crc16(data):
    crc = 0xFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc

def write_frame(slave, channel=None, off=False):
    """None = all OFF; channel 1..8 = fixed five-second hardware flash ON."""
    if type(slave) is not int or not 1 <= slave <= 247:
        raise BenchFault("WRITE_FAILED")
    if channel is not None and (type(channel) is not int or not 1 <= channel <= 8):
        raise BenchFault("WRITE_FAILED")
    if type(off) is not bool:
        raise BenchFault("WRITE_FAILED")
    address, value = (0x00FF, 0) if channel is None else ((channel - 1, 0) if off else (0x0200 + channel - 1, 50))
    frame = struct.pack(">BBHH", slave, 5, address, value)
    return frame + struct.pack("<H", crc16(frame))

def read_exact(stream, count):
    data = b""
    while len(data) < count:
        part = stream.recv(count - len(data))
        if not part:
            raise BenchFault("WRITE_FAILED")
        data += part
    return data

class Driver:
    def __init__(self, observer, devices):
        self.observer = observer
        self.devices = devices
        self.reader = observer.ModbusReadClient(timeout=1.5, inter_read_delay_sec=0.02)

    def read_one(self, module, require_normal=True):
        d = self.devices[module]
        try:
            data, _ = self.reader.read_device(d)
        except Exception:
            raise BenchFault("READBACK_FAILED") from None
        if (self.observer.read_arp_mac(d["ip_address"]) != d["mac_address"] or
            data["modbus_address"] != [d["modbus_address"]] or
            data["software_version"] != [d["expected_software_version_raw"]]):
            raise BenchFault("IDENTITY_MISMATCH")
        normal = data["control_modes"] == [0] * 8
        if require_normal and not normal:
            raise BenchFault("MODE_MISMATCH")
        return {"id": module, "online": True, "identity_verified": True, "crc_valid": True,
                "mode_verified": normal, "relay_status": data["relay_status"], "digital_inputs": data["digital_inputs"]}

    def read_all(self):
        return [self.read_one(module) for module in MODULES]

    def _write(self, module, channel=None, deadline=None, allowed_on=(), off=False):
        # Fresh identity/mode check before each write; never send to an unknown unit.
        turning_on = channel is not None and not off
        before = self.read_one(module, require_normal=turning_on)
        on = {i + 1 for i, value in enumerate(before["relay_status"]) if value}
        if turning_on and (channel in on or not on.issubset(set(allowed_on))):
            raise BenchFault("UNEXPECTED_ON")
        d = self.devices[module]
        frame = write_frame(d["modbus_address"], channel, off=off)
        if turning_on and (deadline is None or time.monotonic() >= deadline):
            raise BenchFault("WRITE_FAILED")
        try:
            with socket.create_connection((d["ip_address"], d["port"]), timeout=1.5) as stream:
                stream.settimeout(1.5)
                if turning_on and time.monotonic() >= deadline:
                    raise BenchFault("WRITE_FAILED")
                stream.sendall(frame)
                header = read_exact(stream, 2)
                reply = header + read_exact(stream, 3 if header[1] & 0x80 else 6)
            if reply != frame:
                raise BenchFault("WRITE_FAILED")
        except Exception:
            raise BenchFault("WRITE_FAILED") from None

    def pulse(self, module, channel, deadline, allowed_on=()):
        if module not in MODULES:
            raise BenchFault("WRITE_FAILED")
        self._write(module, channel, deadline, allowed_on)
        after = self.read_one(module)
        on = {i + 1 for i, value in enumerate(after["relay_status"]) if value}
        if channel not in on or not on.issubset(set(allowed_on) | {channel}):
            raise BenchFault("WRITE_FAILED")

    def channel_off(self, module, channel):
        if module not in MODULES:
            raise BenchFault("WRITE_FAILED")
        self._write(module, channel, off=True)
        if self.read_one(module, require_normal=False)["relay_status"][channel - 1]:
            raise BenchFault("OFF_UNVERIFIED")

    def all_off(self):
        failed = False
        for module in MODULES:
            try:
                self._write(module)
                if any(self.read_one(module, require_normal=False)["relay_status"]):
                    failed = True
            except BenchFault:
                failed = True
        if failed:
            raise BenchFault("OFF_UNVERIFIED")

class Journal:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute("CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,status TEXT NOT NULL,updated_at REAL NOT NULL)")
        self.db.commit()
    def claim(self, identifier):
        try:
            with self.db:
                c = self.db.execute("INSERT OR IGNORE INTO commands VALUES(?,'CONSUMED',?)", (identifier, time.time()))
            return c.rowcount == 1
        except sqlite3.Error:
            raise BenchFault("JOURNAL_FAILED") from None
    def record(self, identifier, status):
        with self.db:
            self.db.execute("UPDATE commands SET status=?,updated_at=? WHERE id=?", (status, time.time(), identifier))

class Controller:
    def __init__(self, driver, journal):
        self.driver, self.journal = driver, journal
        self.active = {}
        self.acks = {}
        self.seen_stop_seq = -1
        self.fault = "NONE"

    def finish(self, key, status):
        command = self.active.get(key)
        if command:
            self.journal.record(command["id"], status)
            self.acks[command["id"]] = {"id": command["id"], "status": status}
            del self.active[key]

    def stop(self):
        self.driver.all_off()
        for key in list(self.active):
            self.finish(key, "OFF_VERIFIED")
        self.fault = "NONE"

    def snapshot(self):
        rows = self.driver.read_all()
        on = {(m["id"], i + 1) for m in rows for i, value in enumerate(m["relay_status"]) if value}
        if not on.issubset(set(self.active)):
            raise BenchFault("UNEXPECTED_ON")
        for key, command in list(self.active.items()):
            if key not in on:
                self.finish(key, "OFF_VERIFIED")
            elif time.monotonic() > command["deadline"] + 1:
                raise BenchFault("OFF_UNVERIFIED")
        return {"protocol_version": 2, "observed_at": datetime.now(timezone.utc).isoformat(), "modules": rows, "fault": self.fault}

    def accept(self, result, elapsed):
        seq = result.get("stop_seq")
        server_now, armed = result.get("server_now", 0), result.get("armed_until", 0)
        if result.get("protocol_version") != 2 or type(seq) is not int or type(server_now) not in (int, float) or type(armed) not in (int, float):
            raise BenchFault("READBACK_FAILED")
        # Clear only ACKs confirmed by the server. Lost responses never replay ON.
        for identifier in result.get("acknowledged_ids", [])[:32]:
            self.acks.pop(identifier, None)
        if seq != self.seen_stop_seq or self.fault != "NONE" or (armed <= server_now and self.active):
            self.stop()
            self.seen_stop_seq = seq
            return
        commands = result.get("commands", [])
        if not isinstance(commands, list) or len(commands) > 16:
            raise BenchFault("READBACK_FAILED")
        received = time.monotonic()
        if commands:
            self.snapshot()
        # OFF precedes ON when a batch contains both. Each channel has its own timer.
        for command in sorted(commands, key=lambda c: c.get("action") != "OFF"):
            try:
                kind = command["action"]
                if str(uuid.UUID(command["id"])) != command["id"] or command["module"] not in MODULES or type(command["channel"]) is not int or not 1 <= command["channel"] <= 8 or kind not in ("PULSE", "OFF"):
                    raise ValueError()
                spent = elapsed + time.monotonic() - received
                if command["stop_seq"] != seq or command["expires_at"] - server_now <= spent * 1000 + 100:
                    raise ValueError()
                if kind == "PULSE" and (command["pulse_seconds"] != 5 or armed - server_now <= spent * 1000 + 6000):
                    raise ValueError()
            except (KeyError, TypeError, ValueError, AttributeError):
                raise BenchFault("WRITE_FAILED") from None
            expires = received + (command["expires_at"] - server_now) / 1000 - elapsed
            key = (command["module"], command["channel"])
            if not self.journal.claim(command["id"]):
                self.acks[command["id"]] = {"id": command["id"], "status": "FAILED"}
                continue
            try:
                if kind == "OFF":
                    self.driver.channel_off(*key)
                    self.finish(key, "OFF_VERIFIED")
                    status = "OFF_VERIFIED"
                else:
                    if key in self.active or len(self.active) >= 16:
                        raise BenchFault("UNEXPECTED_ON")
                    allowed = [ch for module, ch in self.active if module == key[0]]
                    self.active[key] = {**command, "deadline": time.monotonic() + 5}
                    self.driver.pulse(*key, expires, allowed_on=allowed)
                    status = "ON_VERIFIED"
                self.journal.record(command["id"], status)
                self.acks[command["id"]] = {"id": command["id"], "status": status}
            except Exception:
                self.acks[command["id"]] = {"id": command["id"], "status": "FAILED"}
                # Always attempt OFF, even if writing the local journal fails.
                try:
                    self.journal.record(command["id"], "FAILED")
                finally:
                    self.driver.all_off()
                    self.active.clear()
                raise


def load_driver(config_path):
    cfg = json.loads(Path(config_path).read_text())
    if cfg.get("mode") != "NO_LOAD_BENCH" or cfg.get("owner_confirmed_no_load") is not True:
        raise BenchFault("LOCAL_DISABLED")
    base = Path("/opt/sucha-relay-observer/app")
    config = base / "relay-observer.json"
    if hashlib.sha256(config.read_bytes()).hexdigest() != cfg.get("observer_config_sha256"):
        raise BenchFault("IDENTITY_MISMATCH")
    spec = importlib.util.spec_from_file_location("relay_observer", base / "relay_observer.py")
    observer = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = observer
    spec.loader.exec_module(observer)
    observed = observer.load_config(config)
    if {d["id"] for d in observed["devices"]} != set(MODULES.values()):
        raise BenchFault("IDENTITY_MISMATCH")
    devices = {public: next(d for d in observed["devices"] if d["id"] == local) for public, local in MODULES.items()}
    return Driver(observer, devices)

class CloudClient:
    """Reuse HTTPS/TLS between polls. Never replay a failed command request."""
    def __init__(self):
        self.connection = None
        self.target = urlsplit(ENDPOINT)
    def poll(self, payload):
        token = (Path(os.environ["CREDENTIALS_DIRECTORY"]) / "farmultimate_device_token").read_text().strip()
        if len(token) != 64 or any(c not in "0123456789abcdefABCDEF" for c in token):
            raise BenchFault("LOCAL_DISABLED")
        if self.connection is None:
            self.connection = http.client.HTTPSConnection(self.target.hostname, timeout=5)
        try:
            self.connection.request("POST", self.target.path, body=json.dumps(payload), headers={"Content-Type": "application/json", "Authorization": "Bearer " + token, "User-Agent": "FARMULTIMATE-Relay-Bench/2.0", "Accept": "application/json"})
            response = self.connection.getresponse()
            raw = response.read(8193)
            if response.status != 200 or len(raw) > 8192:
                raise BenchFault("READBACK_FAILED")
            result = json.loads(raw)
            if result.get("ok") is not True:
                raise BenchFault("READBACK_FAILED")
            return result["data"]
        except Exception:
            self.connection.close()
            self.connection = None
            raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="/etc/sucha-relay-bench/config.json")
    parser.add_argument("--state-dir", default="/var/lib/sucha-relay-bench")
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--bench-self-test", action="store_true")
    args = parser.parse_args()
    driver = load_driver(args.config)
    if args.preflight:
        rows = driver.read_all()
        if any(any(m["relay_status"]) for m in rows):
            raise BenchFault("UNEXPECTED_ON")
        print(json.dumps({"result": "PREFLIGHT_PASS", "modules": len(rows), "channels": 16, "writes": 0}), flush=True)
        return
    state = Path(args.state_dir)
    state.mkdir(mode=0o700, exist_ok=True)
    with (state / "writer.lock").open("a") as lock:
        import fcntl
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        controller = Controller(driver, Journal(state / "journal.sqlite3"))
        if args.bench_self_test:
            controller.stop()
            try:
                for module in MODULES:
                    for channel in range(1, 9):
                        driver.pulse(module, channel, time.monotonic() + 3)
                        # Leave the hardware entirely alone until its internal timer expires.
                        time.sleep(5.3)
                        rows = driver.read_all()
                        if any(any(m["relay_status"]) for m in rows):
                            raise BenchFault("OFF_UNVERIFIED")
                        print(json.dumps({"module": module, "channel": channel, "on_readback": True, "hardware_auto_off_readback": True}), flush=True)
                driver.pulse("RELAY_A", 1, time.monotonic() + 3)
                driver.all_off()
                print(json.dumps({"result": "BENCH_SELF_TEST_PASS", "channels": 16, "early_off_readback": True}), flush=True)
            finally:
                controller.stop()
            return
        running = True
        def stop_signal(signum, frame):
            nonlocal running
            running = False
        signal.signal(signal.SIGTERM, stop_signal)
        signal.signal(signal.SIGINT, stop_signal)
        instance = str(uuid.uuid4())
        cloud = CloudClient()
        cycles = 0
        controller.stop()
        print(json.dumps({"result": "STARTED_ALL_OFF_VERIFIED", "mode": "NO_LOAD_BENCH"}), flush=True)
        try:
            while running:
                interval = 5
                try:
                    cycle_start = time.monotonic()
                    snapshot = controller.snapshot()
                    started = time.monotonic()
                    result = cloud.poll({"instance_id": instance, "seen_stop_seq": controller.seen_stop_seq, "snapshot": snapshot, "acks": list(controller.acks.values())[:32]})
                    network_ms = round((time.monotonic() - started) * 1000)
                    controller.accept(result, time.monotonic() - started)
                    interval = 0.05 if result["armed_until"] > result["server_now"] or controller.acks else 1
                    cycles += 1
                    if cycles <= 5 or cycles % 60 == 0 or result.get("commands"):
                        print(json.dumps({"result": "POLL_TIMING", "cloud_ms": network_ms, "cycle_ms": round((time.monotonic() - cycle_start) * 1000), "commands": len(result.get("commands", []))}), flush=True)
                except Exception as error:
                    controller.fault = str(error) if isinstance(error, BenchFault) else "READBACK_FAILED"
                    try:
                        try:
                            for key in list(controller.active):
                                controller.finish(key, "FAILED")
                        finally:
                            driver.all_off()
                    except Exception:
                        controller.fault = "OFF_UNVERIFIED"
                    # Do not log endpoint, raw device response, credential or exception text.
                    print(json.dumps({"result": "SAFE_OFF_RECOVERY", "fault": controller.fault}), flush=True)
                time.sleep(interval)
        finally:
            controller.stop()
            print(json.dumps({"result": "STOPPED_ALL_OFF_VERIFIED"}), flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"result": "BENCH_STOPPED", "fault": str(error) if isinstance(error, BenchFault) else "READBACK_FAILED"}), flush=True)
        sys.exit(1)
