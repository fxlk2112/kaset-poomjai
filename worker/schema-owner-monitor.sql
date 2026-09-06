-- Additive, bounded latest snapshots only; existing account/sensor rows are untouched.
CREATE TABLE IF NOT EXISTS owner_monitor_snapshots (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('health','weather')),
  payload TEXT NOT NULL,
  observed_ts INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,kind)
);
