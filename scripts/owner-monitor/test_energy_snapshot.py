import importlib.util
import sqlite3
import unittest
from pathlib import Path
SPEC = importlib.util.spec_from_file_location("publisher_energy_test", Path(__file__).with_name("publisher.py"))
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)

class EnergySnapshotTests(unittest.TestCase):
    def db(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        self.addCleanup(db.close)
        return db

    def test_no_table_is_reported_and_does_not_create_schema(self):
        db = self.db()
        self.assertEqual(M.energy_snapshot(db, 1800000000)["status"], "INGEST_NOT_READY")
        self.assertEqual(db.execute("SELECT count(*) FROM sqlite_master").fetchone()[0], 0)

    def test_wrong_schema_fails_locally_without_throwing(self):
        db = self.db()
        db.execute("CREATE TABLE energy_samples (wrong TEXT)")
        self.assertEqual(M.energy_snapshot(db, 1800000000)["status"], "UNAVAILABLE")

    def test_real_rows_project_without_notes_or_identity_and_preserve_zero(self):
        db = self.db()
        fields = M.ENERGY_FIELDS.split(",")
        db.execute("CREATE TABLE energy_samples (" + ",".join(fields) + ",source_id,circuit_role,meter_model,register_map_id,observed_epoch,notes)")
        values = ["2027-01-15T08:00:00+00:00", "GOOD", 180, 1, 1, 1, 230, 231, 229, 0, 0, 0, 0, 100, .99, 50, 0, 0]
        db.execute("INSERT INTO energy_samples VALUES("+",".join("?" for _ in range(len(values)+6))+")", values+["SYSTEM_TOTAL_FEEDER_QA","SYSTEM_TOTAL_FEEDER","ADL400N-CT/D16","ACREL_ADL400N_CT_EXTERNAL_CT_MANUAL_V1_5_FAST_READ_V1",1800000000,"private-note"])
        db.execute("PRAGMA query_only=ON")
        snapshot = M.energy_snapshot(db, 1800000010)
        self.assertEqual(snapshot["status"], "AVAILABLE")
        current = snapshot["sources"][0]["current"]
        self.assertEqual(current["active_power_total_kw"], 0)
        self.assertIs(current["ct_ratio_verified"], True)
        self.assertNotIn("private-note", str(snapshot))
        self.assertEqual(len(snapshot["sources"][0]["history"]), 1)
        self.assertEqual(db.execute("SELECT count(*) FROM energy_samples").fetchone()[0], 1)

if __name__ == "__main__":
    unittest.main()
