import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SchemaTests(unittest.TestCase):
    def test_all_schemas_apply_to_fresh_database(self):
        connection = sqlite3.connect(":memory:")
        for name in ("schema.sql", "schema2.sql", "schema3.sql", "schema4.sql"):
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


if __name__ == "__main__":
    unittest.main()
