CREATE TABLE IF NOT EXISTS team_grants (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, email TEXT NOT NULL,
  member_id TEXT, scopes TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'invited',
  invite_hash TEXT, expires_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS team_owner ON team_grants(owner_id);
CREATE INDEX IF NOT EXISTS team_member ON team_grants(member_id, status);
CREATE TABLE IF NOT EXISTS team_submissions (
  id TEXT PRIMARY KEY, grant_id TEXT NOT NULL, owner_id TEXT NOT NULL,
  member_id TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  revision INTEGER NOT NULL DEFAULT 1, review_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS team_inbox ON team_submissions(owner_id, status);
CREATE INDEX IF NOT EXISTS team_sent ON team_submissions(member_id, grant_id);
CREATE TABLE IF NOT EXISTS team_events (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, actor_id TEXT NOT NULL,
  event TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS team_photos (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, member_id TEXT NOT NULL,
  grant_id TEXT NOT NULL, submission_id TEXT NOT NULL, object_key TEXT NOT NULL,
  content_type TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS team_photo_submission ON team_photos(submission_id);
