CREATE TABLE IF NOT EXISTS daily_visitors (
  visit_date TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visit_date, visitor_hash)
) WITHOUT ROWID;
