-- Orca's stable conversation key survives native retention. Only native_id changes.
CREATE TABLE native_session_recovery (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  native_id TEXT NOT NULL,
  archive_json TEXT NOT NULL,
  local_frontier INTEGER NOT NULL,
  fresh_start INTEGER NOT NULL DEFAULT 0,
  prompt_id TEXT,
  prompt_text TEXT,
  accepted INTEGER NOT NULL DEFAULT 0
);
