CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  prompt TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  final_model TEXT NOT NULL,
  fallback_used INTEGER NOT NULL DEFAULT 0,
  answer TEXT,
  raw_result TEXT
);
