-- Repair the live water_systems schema before adding Phase 1 telemetry.
-- The Worker already reads/writes these fields, but the prior schema did not
-- create them. This migration is intended to run once after schema3.sql.
ALTER TABLE water_systems ADD COLUMN lat REAL DEFAULT 0;
ALTER TABLE water_systems ADD COLUMN lng REAL DEFAULT 0;
ALTER TABLE water_systems ADD COLUMN note TEXT DEFAULT '';

-- Phase 1 sensor telemetry (read-only from the application's point of view).
-- Device credentials are stored only as SHA-256 hashes. No output/control state
-- is represented in these tables.
CREATE TABLE IF NOT EXISTS sensor_devices (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  source_id   TEXT NOT NULL,
  name        TEXT DEFAULT '',
  token_hash  TEXT UNIQUE NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  revoked_at  INTEGER DEFAULT 0,
  UNIQUE (user_id, source_id)
);

CREATE TABLE IF NOT EXISTS sensor_samples (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL,
  device_id                TEXT NOT NULL,
  source_id                TEXT NOT NULL,
  observed_at              TEXT NOT NULL,
  observed_ts              INTEGER NOT NULL,
  received_at              INTEGER NOT NULL,
  quality                  TEXT NOT NULL,
  voltage_v                REAL,
  current_ma               REAL,
  depth_m                  REAL,
  staff_gauge_m            REAL,
  volume_m3                REAL,
  capacity_percent         REAL,
  stale_after_s            INTEGER NOT NULL,
  calibration_id           TEXT NOT NULL,
  volume_model_id          TEXT NOT NULL,
  sample_count             INTEGER DEFAULT 0,
  output_control_allowed   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, source_id, observed_at)
);

CREATE INDEX IF NOT EXISTS idx_sensor_samples_user_source_time
  ON sensor_samples(user_id, source_id, observed_ts DESC);

CREATE TABLE IF NOT EXISTS sensor_latest (
  user_id                  TEXT NOT NULL,
  source_id                TEXT NOT NULL,
  device_id                TEXT NOT NULL,
  observed_at              TEXT NOT NULL,
  observed_ts              INTEGER NOT NULL,
  received_at              INTEGER NOT NULL,
  quality                  TEXT NOT NULL,
  voltage_v                REAL,
  current_ma               REAL,
  depth_m                  REAL,
  staff_gauge_m            REAL,
  volume_m3                REAL,
  capacity_percent         REAL,
  stale_after_s            INTEGER NOT NULL,
  calibration_id           TEXT NOT NULL,
  volume_model_id          TEXT NOT NULL,
  sample_count             INTEGER DEFAULT 0,
  output_control_allowed   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, source_id)
);
