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
import urllib.request
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

def write_frame(slave, channel=None):
    """None = all OFF; channel 1..8 = fixed five-second hardware flash ON."""
    if type(slave) is not int or not 1 <= slave <= 247:
        raise BenchFault("WRITE_FAILED")
    if channel is not None and (type(channel) is not int or not 1 <= channel <= 8):
        raise BenchFault("WRITE_FAILED")
    address, value = (0x00FF, 0) if channel is None else (0x0200 + channel - 1, 50)
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

    def _write(self, module, channel=None, deadline=None):
        # Fresh identity/mode check before each write; never send to an unknown unit.
        before = self.read_one(module, require_normal=channel is not None)
        if channel is not None and any(before["relay_status"]):
            raise BenchFault("UNEXPECTED_ON")
        d = self.devices[module]
        frame = write_frame(d["modbus_address"], channel)
        if channel is not None and (deadline is None or time.monotonic() >= deadline):
            raise BenchFault("WRITE_FAILED")
        try:
            with socket.create_connection((d["ip_address"], d["port"]), timeout=1.5) as stream:
                stream.settimeout(1.5)
                if channel is not None and time.monotonic() >= deadline:
                    raise BenchFault("WRITE_FAILED")
                stream.sendall(frame)
                header = read_exact(stream, 2)
                reply = header + read_exact(stream, 3 if header[1] & 0x80 else 6)
            if reply != frame:
                raise BenchFault("WRITE_FAILED")
        except Exception:
            raise BenchFault("WRITE_FAILED") from None

    def pulse(self, module, channel, deadline):
        if module not in MODULES:
            raise BenchFault("WRITE_FAILED")
        self._write(module, channel, deadline)
        after = self.read_one(module)
        if after["relay_status"] != [i == channel - 1 for i in range(8)]:
            raise BenchFault("WRITE_FAILED")

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
        self.active = None
        self.ack = None
        self.seen_stop_seq = -1
        self.fault = "NONE"

    def stop(self):
        self.driver.all_off()
        if self.active:
            self.finish("OFF_VERIFIED")
        self.fault = "NONE"

    def finish(self, status):
        if self.active:
            self.ack = {"id": self.active["id"], "status": status}
            self.journal.record(self.active["id"], status)
        self.active = None

    def snapshot(self):
        rows = self.driver.read_all()
        on = [(m["id"], i + 1) for m in rows for i, value in enumerate(m["relay_status"]) if value]
        if self.active:
            expected = (self.active["module"], self.active["channel"])
            if not on:
                self.finish("OFF_VERIFIED")
            elif on != [expected]:
                raise BenchFault("UNEXPECTED_ON")
            elif time.monotonic() > self.active["deadline"] + 1:
                raise BenchFault("OFF_UNVERIFIED")
        elif on:
            raise BenchFault("UNEXPECTED_ON")
        return {"observed_at": datetime.now(timezone.utc).isoformat(), "modules": rows, "fault": self.fault}

    def accept(self, result, elapsed):
        seq = result.get("stop_seq")
        server_now, armed = result.get("server_now", 0), result.get("armed_until", 0)
        if type(seq) is not int or type(server_now) not in (int, float) or type(armed) not in (int, float):
            raise BenchFault("READBACK_FAILED")
        # A fault has already been reported in this poll. Re-verify OFF before
        # clearing it, including an idle connection loss with no new stop epoch.
        if seq != self.seen_stop_seq or self.fault != "NONE" or (armed <= server_now and self.active):
            self.stop()
            self.seen_stop_seq = seq
            return
        if armed <= server_now:
            return
        command = result.get("command")
        if not command:
            return
        try:
            if str(uuid.UUID(command["id"])) != command["id"] or command["module"] not in MODULES or type(command["channel"]) is not int or not 1 <= command["channel"] <= 8:
                raise ValueError()
            if command["pulse_seconds"] != 5 or command["stop_seq"] != seq or armed - server_now <= 6000 or command["expires_at"] - server_now <= elapsed * 1000 + 1000:
                raise ValueError()
        except (KeyError, TypeError, ValueError, AttributeError):
            raise BenchFault("WRITE_FAILED") from None
        expires = time.monotonic() + (command["expires_at"] - server_now) / 1000 - elapsed
        if self.active or self.fault != "NONE":
            raise BenchFault("UNEXPECTED_ON")
        if not self.journal.claim(command["id"]):
            # Durable consume-before-write means a lost ACK never repeats ON.
            self.ack = {"id": command["id"], "status": "FAILED"}
            return
        self.snapshot()
        self.active = {"id": command["id"], "module": command["module"], "channel": command["channel"], "deadline": time.monotonic() + 5}
        try:
            self.driver.pulse(command["module"], command["channel"], expires)
            self.ack = {"id": command["id"], "status": "ON_VERIFIED"}
            self.journal.record(command["id"], "ON_VERIFIED")
        except Exception:
            self.finish("FAILED")
            self.driver.all_off()
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

def poll(payload):
    token = (Path(os.environ["CREDENTIALS_DIRECTORY"]) / "farmultimate_device_token").read_text().strip()
    if len(token) != 64 or any(c not in "0123456789abcdefABCDEF" for c in token):
        raise BenchFault("LOCAL_DISABLED")
    request = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode(), method="POST", headers={"Content-Type": "application/json", "Authorization": "Bearer " + token, "User-Agent": "FARMULTIMATE-Relay-Bench/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=8) as response:
        raw = response.read(8193)
    if len(raw) > 8192:
        raise BenchFault("READBACK_FAILED")
    result = json.loads(raw)
    if result.get("ok") is not True:
        raise BenchFault("READBACK_FAILED")
    return result["data"]

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
        controller.stop()
        print(json.dumps({"result": "STARTED_ALL_OFF_VERIFIED", "mode": "NO_LOAD_BENCH"}), flush=True)
        try:
            while running:
                interval = 5
                try:
                    snapshot = controller.snapshot()
                    started = time.monotonic()
                    result = poll({"instance_id": instance, "seen_stop_seq": controller.seen_stop_seq, "snapshot": snapshot, "ack": controller.ack})
                    controller.accept(result, time.monotonic() - started)
                    interval = 0.7 if result["armed_until"] > result["server_now"] else 5
                except Exception as error:
                    controller.fault = str(error) if isinstance(error, BenchFault) else "READBACK_FAILED"
                    try:
                        try:
                            controller.finish("FAILED")
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
