"""Synthetic observer files only; no network, database or hardware calls."""
import json
import tempfile
import unittest
from pathlib import Path
from publisher import relay_snapshot

class RelaySnapshotTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "observer.json"
        self.data = {"observed_at": "2026-09-06T10:00:00Z", "safety": {"output_control_allowed": False, "actual_output_write_enabled": False}, "devices": [{"id": "relay_a", "connectivity": True, "identity_match": True, "crc_valid": True, "relay_status": [False] * 8, "digital_inputs": [True] * 8, "private_identity": "fixture-private"}]}
    def project(self):
        self.path.write_text(json.dumps(self.data))
        return relay_snapshot(self.path)
    def test_strips_private_identity(self):
        output = self.project()
        self.assertNotIn("fixture-private", json.dumps(output))
        self.assertEqual(output["modules"][0]["id"], "RELAY_A")
        self.assertEqual(output["modules"][0]["digital_inputs"], [True] * 8)
    def test_missing_corrupt_unsafe_files_fail_closed(self):
        self.assertEqual(relay_snapshot(self.path)["modules"], [])
        self.path.write_text("not json")
        self.assertEqual(relay_snapshot(self.path)["modules"], [])
        self.data["safety"]["actual_output_write_enabled"] = True
        self.assertEqual(self.project()["modules"], [])
    def test_unknown_duplicate_ids_and_bad_values(self):
        self.data["devices"][0]["relay_status"][0] = "false"
        self.assertIsNone(self.project()["modules"][0]["relay_status"][0])
        self.data["devices"].append(self.data["devices"][0])
        self.assertEqual(self.project()["modules"], [])
        self.data["devices"] = [{"id": "unrecognized"}]
        self.assertEqual(self.project()["modules"], [])

if __name__ == "__main__":
    unittest.main()
