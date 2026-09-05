import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SchemaTests(unittest.TestCase):
    def test_all_schemas_apply_to_fresh_database(self):
        connection = sqlite3.connect(":memory:")
        for name in ("schema.sql", "schema2.sql", "schema3.sql", "schema4.sql", "schema5.sql"):
            connection.executescript((ROOT / name).read_text(encoding="utf-8"))

        water_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(water_systems)")
        }
        self.assertTrue({"lat", "lng", "note"}.issubset(water_columns))

        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        self.assertTrue(
            {"sensor_devices", "sensor_samples", "sensor_latest"}.issubset(tables)
        )

        sample_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(sensor_samples)")
        }
        self.assertIn("output_control_allowed", sample_columns)

        # Phase 1 schema may be replayed safely by migration tooling.
        connection.executescript((ROOT / "schema5.sql").read_text(encoding="utf-8"))

        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute(
                """INSERT INTO sensor_samples
                (id,user_id,device_id,source_id,observed_at,observed_ts,received_at,
                 quality,stale_after_s,calibration_id,volume_model_id,output_control_allowed)
                VALUES ('s','u','d','source','2026-01-01T00:00:00.000Z',1,1,
                        'GOOD',180,'c','v',1)"""
            )


if __name__ == "__main__":
    unittest.main()
