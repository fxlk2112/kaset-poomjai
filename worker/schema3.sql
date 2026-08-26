-- แชร์แปลง: ลิงก์ดูอย่างเดียว + คอมเมนต์
CREATE TABLE IF NOT EXISTS shares (
  token         TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  plot_id       TEXT DEFAULT '',
  created_at    INTEGER NOT NULL,
  active        INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS share_comments (
  id         TEXT PRIMARY KEY,
  token      TEXT NOT NULL,
  name       TEXT DEFAULT '',
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS share_scopes (
  token    TEXT PRIMARY KEY,
  cycle_id TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_shares_owner_plot_active ON shares(owner_user_id, plot_id, active);
CREATE INDEX IF NOT EXISTS idx_share_comments_token_created ON share_comments(token, created_at DESC);
