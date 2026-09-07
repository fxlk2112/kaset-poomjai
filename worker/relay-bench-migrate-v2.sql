-- Only the dedicated no-load bench queue changes. Preserve every audit row.
UPDATE relay_bench_state SET armed_until=0,stop_seq=stop_seq+1;
UPDATE relay_bench_commands SET status='CANCELLED',updated_at=unixepoch()*1000
  WHERE status IN ('QUEUED','CLAIMED','ON_VERIFIED');
ALTER TABLE relay_bench_commands ADD COLUMN action TEXT NOT NULL DEFAULT 'PULSE' CHECK(action IN ('PULSE','OFF'));
CREATE UNIQUE INDEX relay_bench_one_active_channel ON relay_bench_commands(user_id,module,channel)
  WHERE status IN ('QUEUED','CLAIMED','ON_VERIFIED');
DROP INDEX relay_bench_one_active;
