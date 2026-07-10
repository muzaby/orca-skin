CREATE TABLE IF NOT EXISTS schedule_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_key TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL CHECK(status IN ('running', 'success', 'error', 'skipped')),
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_schedule_runs_job_started
  ON schedule_runs(job_key, started_at DESC);
