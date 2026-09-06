import tempfile
import unittest
import uuid
from pathlib import Path
from agent import BenchFault, Controller, Journal, write_frame, crc16

class FakeDriver:
    def __init__(self): self.on = None; self.pulses = 0; self.stops = 0; self.fail = False
    def read_all(self):
        return [{"id": m, "relay_status": [self.on == (m, i+1) for i in range(8)]} for m in ["RELAY_A", "RELAY_B"]]
    def pulse(self, module, channel, deadline):
        self.pulses += 1
        if self.fail: raise BenchFault("WRITE_FAILED")
        self.on = (module, channel)
    def all_off(self): self.on = None; self.stops += 1

class ControllerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "journal.sqlite3"
        self.driver = FakeDriver(); self.controller = Controller(self.driver, Journal(self.path)); self.controller.seen_stop_seq = 1
        self.addCleanup(self.controller.journal.db.close)
        self.command = {"id": str(uuid.uuid4()), "module": "RELAY_A", "channel": 1, "pulse_seconds": 5, "expires_at": 9000, "stop_seq": 1}
    def result(self): return {"server_now": 1000, "armed_until": 900000, "stop_seq": 1, "command": dict(self.command)}
    def test_hardware_frames_have_only_five_second_pulse_or_off(self):
        for ch in range(1, 9):
            frame = write_frame(1, ch)
            self.assertEqual(frame[1], 5); self.assertEqual(int.from_bytes(frame[2:4], "big"), 0x0200+ch-1)
            self.assertEqual(frame[4:6], b"\x00\x32"); self.assertEqual(crc16(frame[:-2]), int.from_bytes(frame[-2:], "little"))
        self.assertEqual(write_frame(1)[2:6], b"\x00\xff\x00\x00")
        for ch in [0, 9, True, "1"]:
            with self.assertRaises(BenchFault): write_frame(1, ch)
    def test_open_and_off_are_read_back_and_durable_dedupe_prevents_replay(self):
        self.controller.accept(self.result(), 0.1); self.assertEqual(self.controller.ack["status"], "ON_VERIFIED")
        self.driver.on = None; self.controller.snapshot(); self.assertEqual(self.controller.ack["status"], "OFF_VERIFIED")
        restarted = Controller(self.driver, Journal(self.path)); restarted.seen_stop_seq = 1
        self.addCleanup(restarted.journal.db.close)
        restarted.accept(self.result(), 0.1); self.assertEqual(self.driver.pulses, 1)
    def test_expiry_stop_epoch_bad_duration_and_unarmed_prevent_on(self):
        for key, value in [("expires_at", 1001), ("pulse_seconds", 60), ("stop_seq", 9), ("channel", 9)]:
            result = self.result(); result["command"][key] = value
            with self.assertRaises(BenchFault): self.controller.accept(result, 0.1)
        result = self.result(); result["armed_until"] = 0
        self.controller.accept(result, 0.1); self.assertEqual(self.driver.pulses, 0)
    def test_ambiguous_write_attempts_off_and_never_retries_on(self):
        self.driver.fail = True
        with self.assertRaises(BenchFault): self.controller.accept(self.result(), 0.1)
        self.assertEqual(self.driver.stops, 1); self.assertEqual(self.controller.ack["status"], "FAILED")
        self.driver.fail = False; self.controller.accept(self.result(), 0.1); self.assertEqual(self.driver.pulses, 1)
    def test_changed_stop_epoch_turns_off_active_pulse(self):
        self.controller.accept(self.result(), 0.1)
        result = self.result(); result["stop_seq"] = 2; result["command"] = None
        self.controller.accept(result, 0.1); self.assertIsNone(self.driver.on); self.assertEqual(self.controller.ack["status"], "OFF_VERIFIED")
    def test_idle_connection_fault_recovers_after_cloud_contact_and_off_readback(self):
        self.controller.fault = "READBACK_FAILED"
        result = self.result(); result["armed_until"] = 0; result["command"] = None
        self.controller.accept(result, 0.1)
        self.assertEqual(self.driver.stops, 1); self.assertEqual(self.driver.pulses, 0)
        self.assertEqual(self.controller.fault, "NONE")

if __name__ == "__main__": unittest.main()
