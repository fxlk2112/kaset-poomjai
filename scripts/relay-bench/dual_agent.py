#!/usr/bin/env python3
"""One physical controller; Cloud I/O never blocks authenticated LAN dispatch."""
import json
import os
import signal
import socketserver
import threading
import time
import uuid
from pathlib import Path
from agent import BenchFault, CloudClient, Controller, Journal, load_driver

class Coordinator:
    def __init__(self, controller):
        self.c = controller
        self.lock = threading.RLock()
        self.source = "CLOUD"
        self.epoch = str(uuid.uuid4())
        self.instance = str(uuid.uuid4())
        self.lan_until = 0
        self.cloud_until = 0
        self.cloud_seen = False
        self.cloud_ok = False
        self.cloud_last = 0
        self.cached = None
        self.commands = {}
        self.pulses = []
        self.c.stop()

    def rotate(self):
        self.epoch = str(uuid.uuid4())
        self.instance = str(uuid.uuid4())
        self.c.seen_stop_seq = -1
        self.cloud_until = 0
        self.cloud_seen = False

    def leave_lan(self):
        self.c.stop()
        self.lan_until = 0
        self.source = "CLOUD"
        self.rotate()

    def tick(self):
        with self.lock:
            try:
                if self.source == "LAN" and time.monotonic() >= self.lan_until:
                    self.leave_lan()
                if self.c.fault != "NONE":
                    self.c.stop()
                self.cached = self.c.snapshot()
                for identifier, ack in list(self.c.acks.items()):
                    if identifier in self.commands:
                        self.commands[identifier]["status"] = ack["status"]
                        if ack["status"] in ("OFF_VERIFIED","FAILED"): self.c.acks.pop(identifier,None)
            except Exception as error:
                self.c.fault = str(error) if isinstance(error, BenchFault) else "READBACK_FAILED"
                try:
                    self.c.driver.all_off()
                    for key in list(self.c.active): self.c.finish(key, "FAILED")
                except Exception:
                    self.c.fault = "OFF_UNVERIFIED"
                self.cached = None
                self.lan_until = 0
            return self.public()

    def snapshot(self):
        value = dict(self.cached or {"protocol_version":2,"observed_at":None,"modules":[],"fault":self.c.fault})
        value["control_source"] = self.source
        value["cloud_connected"] = self.cloud_ok and time.monotonic()-self.cloud_last < 12
        value["fault"] = self.c.fault
        return value

    def public(self):
        snapshot = self.snapshot()
        rows = snapshot["modules"]
        ready = len(rows) == 2 and self.c.fault == "NONE" and all(m.get("mode_verified") is True and m.get("identity_verified") is True and m.get("crc_valid") is True for m in rows)
        remaining = max(0, self.lan_until-time.monotonic()) if self.source == "LAN" else 0
        now = int(time.time()*1000)
        commands = sorted(self.commands.values(), key=lambda c:c["created_at"], reverse=True)[:32]
        return {"mode":"NO_LOAD_BENCH","protocol_version":2,"field_control_allowed":False,
            "control_source":self.source,"control_epoch":self.epoch,"cloud_connected":snapshot["cloud_connected"],
            "session_active":remaining>0,"armed_until":now+int(remaining*1000) if remaining else 0,
            "ready":ready,"connected":bool(rows),"stopping":False,"snapshot":snapshot,
            "commands":commands,"last_command":commands[0] if commands else None,
            "pulse_seconds":5,"session_minutes":15,"server_now":now}

    def local(self, action, p):
        with self.lock:
            state = self.tick()
            now = int(time.time()*1000)
            if action == "read": return {"ok":True,"data":state}
            if action == "arm":
                if p.get("no_load_confirmed") is not True or not state["ready"] or any(any(m["relay_status"]) for m in state["snapshot"]["modules"]):
                    return {"ok":False,"error":"NO_LOAD_AND_READY_REQUIRED"}
                if self.cloud_until > time.monotonic() and self.source != "LAN":
                    return {"ok":False,"error":"CLOUD_CONTROL_ACTIVE"}
                self.c.stop()
                self.source = "LAN"
                self.lan_until = time.monotonic()+900
                self.rotate()
                # LAN uses a synthetic controller generation; Cloud responses are ignored.
                self.c.seen_stop_seq = 0
                return {"ok":True,"data":self.tick()}
            if action == "disarm" or (action == "off" and p.get("module") is None):
                if action == "disarm": self.leave_lan()
                else:
                    self.c.stop()
                    self.rotate()
                    if self.source == "LAN": self.c.seen_stop_seq = 0
                return {"ok":True,"accepted":{"action":"DISARM" if action=="disarm" else "ALL_OFF"},"data":self.tick()}
            if action not in ("pulse","off") or p.get("module") not in ("RELAY_A","RELAY_B") or type(p.get("channel")) is not int or not 1<=p["channel"]<=8:
                return {"ok":False,"error":"INVALID_PULSE"}
            identifier=p.get("id")
            try:
                if str(uuid.UUID(identifier)) != identifier: raise ValueError()
            except (ValueError,TypeError,AttributeError): return {"ok":False,"error":"INVALID_PULSE"}
            if self.source != "LAN" or self.lan_until <= time.monotonic() or p.get("control_epoch") != self.epoch:
                return {"ok":False,"error":"LOCAL_SESSION_REQUIRED"}
            issued = p.get("issued_at")
            if type(issued) not in (int,float) or not 0 <= now-issued+2000 <= 10000:
                return {"ok":False,"error":"COMMAND_EXPIRED"}
            old=self.c.journal.db.execute("SELECT status FROM commands WHERE id=?",(identifier,)).fetchone()
            if old: return {"ok":True,"accepted":{"id":identifier,"status":old[0]},"data":self.public()}
            if action == "pulse" and (p.get("pulse_seconds") != 5 or not state["ready"] or (p["module"],p["channel"]) in self.c.active):
                return {"ok":False,"error":"NOT_READY_OR_BUSY"}
            self.pulses=[t for t in self.pulses if now-t<60000]
            if action=="pulse" and len(self.pulses)>=120: return {"ok":False,"error":"NOT_READY_OR_BUSY"}
            if action == "off" and p.get("cancel_id"):
                try:
                    cancel_id=str(uuid.UUID(p["cancel_id"]))
                    if self.c.journal.claim(cancel_id): self.c.journal.record(cancel_id,"CANCELLED")
                except (ValueError,TypeError,AttributeError): return {"ok":False,"error":"INVALID_PULSE"}
            command={"id":identifier,"module":p["module"],"channel":p["channel"],"action":"PULSE" if action=="pulse" else "OFF",
                "pulse_seconds":5 if action=="pulse" else 0,"expires_at":min(issued+8000,now+8000),"stop_seq":0}
            self.c.seen_stop_seq=0
            try:
                self.c.accept({"protocol_version":2,"server_now":now,"armed_until":now+int((self.lan_until-time.monotonic())*1000),"stop_seq":0,"commands":[command],"acknowledged_ids":[]},0)
            except Exception:
                self.c.fault="WRITE_FAILED"
                self.tick()
                return {"ok":False,"error":"COMMAND_FAILED"}
            status=self.c.acks.get(identifier,{}).get("status","FAILED")
            if action=="pulse": self.pulses.append(now)
            self.commands[identifier]={**command,"status":status,"created_at":now}
            if len(self.commands)>64: self.commands.pop(next(iter(self.commands)))
            return {"ok":True,"accepted":{"id":identifier,"status":status},"data":self.tick()}

    def cloud_payload(self):
        with self.lock:
            return self.epoch, {"instance_id":self.instance,"seen_stop_seq":self.c.seen_stop_seq if self.source=="CLOUD" else -1,
                "snapshot":self.snapshot(),"acks":[a for key,a in self.c.acks.items() if key not in self.commands][:32]}

    def cloud_result(self, epoch, result, elapsed):
        with self.lock:
            if epoch != self.epoch: return
            self.cloud_ok=True
            self.cloud_last=time.monotonic()
            if self.source == "LAN": return
            self.cloud_until=time.monotonic()+max(0,(result.get("armed_until",0)-result.get("server_now",0))/1000-elapsed)
            self.c.accept(result,elapsed)
            self.cloud_seen=True

    def cloud_failure(self, epoch):
        with self.lock:
            if epoch != self.epoch: return
            self.cloud_ok=False
            if self.cloud_seen:
                if self.source == "CLOUD": self.c.stop()
                self.rotate() # New device instance cancels pre-outage queued commands.
            elif self.source == "CLOUD" and self.c.active:
                self.c.stop()
            self.cloud_until=0

class IPCHandler(socketserver.StreamRequestHandler):
    def handle(self):
        self.request.settimeout(12)
        try:
            raw=self.rfile.readline(8193)
            if len(raw)>8192 or not raw.endswith(b"\n"): raise ValueError()
            p=json.loads(raw)
            result=self.server.coordinator.local(p.get("action"),p)
        except Exception:
            result={"ok":False,"error":"LOCAL_REQUEST_FAILED"}
        self.wfile.write(json.dumps(result,separators=(",",":")).encode()+b"\n")

class IPCServer(getattr(socketserver,"ThreadingUnixStreamServer",object)):
    daemon_threads=True
    request_queue_size=16

def main():
    import fcntl
    state=Path("/var/lib/sucha-relay-bench")
    with (state/"writer.lock").open("a") as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        coordinator=Coordinator(Controller(load_driver("/etc/sucha-relay-bench/config.json"),Journal(state/"journal.sqlite3",threaded=True)))
        stop=threading.Event()
        for sig in (signal.SIGTERM,signal.SIGINT): signal.signal(sig,lambda *_:stop.set())
        sock=Path("/run/sucha-relay-bench/control.sock")
        if sock.exists(): sock.unlink() # Scoped stale socket, only after acquiring sole-writer lock.
        server=IPCServer(str(sock),IPCHandler)
        os.chmod(sock,0o660)
        server.coordinator=coordinator
        threading.Thread(target=server.serve_forever,daemon=True).start()
        def poll():
            client=CloudClient()
            while not stop.is_set():
                epoch,payload=coordinator.cloud_payload()
                started=time.monotonic()
                try:
                    # Root/operator-only outage simulation; no interface/firewall changes.
                    if Path('/run/sucha-relay-bench/wan-test.block').exists(): raise ConnectionError()
                    coordinator.cloud_result(epoch,client.poll(payload),time.monotonic()-started)
                except Exception:
                    try: coordinator.cloud_failure(epoch)
                    except Exception: coordinator.c.fault="OFF_UNVERIFIED"
                stop.wait(.15 if coordinator.c.active else 1)
        coordinator.tick()
        threading.Thread(target=poll,daemon=True).start()
        print('{"result":"DUAL_TRANSPORT_STARTED","mode":"NO_LOAD_BENCH"}',flush=True)
        try:
            while not stop.wait(.5): coordinator.tick()
        finally:
            server.shutdown()
            with coordinator.lock: coordinator.c.stop()
            server.server_close()

if __name__ == "__main__":
    try: main()
    except Exception:
        print('{"result":"DUAL_TRANSPORT_STOPPED","reason":"SANITIZED_FAILURE"}',flush=True)
        raise SystemExit(1)
