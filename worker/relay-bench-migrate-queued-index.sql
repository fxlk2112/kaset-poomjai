-- Proposed migration: apply once only after explicit Farm D1 approval.
-- Target: flytech-farmultimate-canary. No command/state rows are changed.
CREATE INDEX IF NOT EXISTS relay_bench_queued_owner_expiry
ON relay_bench_commands(user_id, expires_at)
WHERE status = 'QUEUED';
