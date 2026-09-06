CREATE TABLE IF NOT EXISTS relay_bench_state (
  user_id TEXT PRIMARY KEY,
  armed_until INTEGER NOT NULL DEFAULT 0,
  stop_seq INTEGER NOT NULL DEFAULT 0,
  seen_stop_seq INTEGER NOT NULL DEFAULT -1,
  instance_id TEXT NOT NULL DEFAULT '',
  heartbeat_at INTEGER NOT NULL DEFAULT 0,
  snapshot TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS relay_bench_commands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  module TEXT NOT NULL CHECK(module IN ('RELAY_A','RELAY_B')),
  channel INTEGER NOT NULL CHECK(channel BETWEEN 1 AND 8),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  stop_seq INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('QUEUED','CLAIMED','ON_VERIFIED','OFF_VERIFIED','FAILED','CANCELLED','EXPIRED')),
  claimed_by TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS relay_bench_owner_time ON relay_bench_commands(user_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS relay_bench_one_active ON relay_bench_commands(user_id)
  WHERE status IN ('QUEUED','CLAIMED','ON_VERIFIED');
