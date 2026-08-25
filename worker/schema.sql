-- FarmUltimate Solutions — โครงฐานข้อมูลบัญชีผู้ใช้ + ข้อมูลรายบัญชี
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  pass_hash  TEXT NOT NULL,              -- pbkdf2$iterations$salt_b64$hash_b64
  name       TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS user_data (
  user_id    TEXT PRIMARY KEY,
  data       TEXT NOT NULL,              -- สถานะทั้งหมดของแอปของบัญชีนั้น (JSON)
  updated_at INTEGER NOT NULL
);
