-- Google Sign-In: จับบัญชี Google ด้วย sub ที่ Google รับประกันว่าไม่ซ้ำและไม่เปลี่ยน
ALTER TABLE users ADD COLUMN google_sub TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
