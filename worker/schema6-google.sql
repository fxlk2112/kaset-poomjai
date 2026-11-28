-- Existing databases created before Google sign-in only.
-- Fresh databases already receive google_sub through schema.sql.
-- schema5.sql remains the independent read-only telemetry migration.
ALTER TABLE users ADD COLUMN google_sub TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
