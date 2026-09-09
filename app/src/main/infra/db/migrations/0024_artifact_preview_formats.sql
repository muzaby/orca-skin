-- Rebuild the parent and its referencing ledger together while foreign_keys stays ON.
-- Dropping only artifact_files would violate the existing publication RESTRICT references.
CREATE TABLE artifact_files_preview (
  id TEXT PRIMARY KEY,
  relative_path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('html', 'markdown', 'text', 'image')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_trashed_at INTEGER
);
INSERT INTO artifact_files_preview
  (id, relative_path, filename, kind, size_bytes, hash, created_at, last_trashed_at)
SELECT id, relative_path, filename, kind, size_bytes, hash, created_at, last_trashed_at
FROM artifact_files;

CREATE TABLE session_artifacts_preview (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  artifact_file_id TEXT NOT NULL REFERENCES artifact_files_preview(id) ON DELETE RESTRICT,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  tool_run_id TEXT,
  title TEXT NOT NULL,
  input_source TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  card_attached INTEGER NOT NULL DEFAULT 0 CHECK (card_attached IN (0, 1))
);
INSERT INTO session_artifacts_preview
  (id, session_id, artifact_file_id, message_id, tool_run_id, title, input_source, published_at, card_attached)
SELECT id, session_id, artifact_file_id, message_id, tool_run_id, title, input_source, published_at, card_attached
FROM session_artifacts;

DROP TABLE session_artifacts;
DROP TABLE artifact_files;
ALTER TABLE artifact_files_preview RENAME TO artifact_files;
ALTER TABLE session_artifacts_preview RENAME TO session_artifacts;
CREATE INDEX session_artifacts_latest ON session_artifacts(session_id, input_source, published_at DESC, id DESC);
CREATE INDEX session_artifacts_message ON session_artifacts(message_id);
CREATE INDEX session_artifacts_file ON session_artifacts(artifact_file_id);
