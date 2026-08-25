-- ระบบน้ำ IoT: สถานะ/ตารางฝั่งเซิร์ฟเวอร์ (cron ใช้ตัดสินใจ) + อุปกรณ์ที่ลงทะเบียน
CREATE TABLE IF NOT EXISTS water_systems (
  user_id      TEXT NOT NULL,
  system_id    TEXT NOT NULL,
  plot_name    TEXT DEFAULT '',
  name         TEXT DEFAULT '',
  every_days   INTEGER DEFAULT 2,
  time_of_day  TEXT DEFAULT '06:00',
  minutes      INTEGER DEFAULT 30,
  enabled      INTEGER DEFAULT 0,
  last_watered TEXT DEFAULT '',
  state        TEXT DEFAULT 'off',
  until_ts     INTEGER DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, system_id)
);
CREATE TABLE IF NOT EXISTS water_devices (
  user_id    TEXT NOT NULL,
  device_key TEXT PRIMARY KEY,
  name       TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
