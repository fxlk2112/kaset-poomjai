-- ประวัติราคาตลาด: บันทึกรายวันจาก MARKET_DATA (cron ทำงานทุกวัน 08:00 BKK)
-- product + market + date = unique key (upsert-safe)
CREATE TABLE IF NOT EXISTS price_history (
  product    TEXT NOT NULL,          -- ชื่อสินค้า
  market     TEXT NOT NULL,          -- ชื่อตลาด
  date       TEXT NOT NULL,          -- YYYY-MM-DD (Bangkok time)
  price      REAL NOT NULL,          -- ราคากลาง (midpoint ของ min+max)
  min        REAL NOT NULL,
  max        REAL NOT NULL,
  unit       TEXT DEFAULT '',
  category   TEXT DEFAULT '',
  status     TEXT DEFAULT 'stable',  -- up | down | stable
  recorded_at INTEGER NOT NULL,      -- Unix ms ที่บันทึก
  PRIMARY KEY (product, market, date)
);
CREATE INDEX IF NOT EXISTS idx_ph_product_date ON price_history(product, date DESC);
CREATE INDEX IF NOT EXISTS idx_ph_date ON price_history(date DESC);
