CREATE TABLE history_fork_prefix (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  marker_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE
);
