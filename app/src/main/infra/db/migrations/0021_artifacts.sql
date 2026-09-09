-- Files outlive sessions. Only their publication references cascade on session deletion.
CREATE TABLE artifact_files (
  id TEXT PRIMARY KEY,
  relative_path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('html', 'markdown')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_trashed_at INTEGER
);

CREATE TABLE session_artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  artifact_file_id TEXT NOT NULL REFERENCES artifact_files(id) ON DELETE RESTRICT,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  tool_run_id TEXT,
  title TEXT NOT NULL,
  input_source TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  card_attached INTEGER NOT NULL DEFAULT 0 CHECK (card_attached IN (0, 1))
);
CREATE INDEX session_artifacts_latest ON session_artifacts(session_id, input_source, published_at DESC, id DESC);
CREATE INDEX session_artifacts_message ON session_artifacts(message_id);
CREATE INDEX session_artifacts_file ON session_artifacts(artifact_file_id);
