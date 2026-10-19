ALTER TABLE sessions ADD COLUMN hidden_at INTEGER;

CREATE TABLE native_history_snapshots (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  local_frontier INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);
CREATE TABLE native_message_bindings (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  native_message_id TEXT NOT NULL,
  PRIMARY KEY (message_id, native_message_id)
);
CREATE TABLE native_history_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  native_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at INTEGER NOT NULL,
  content TEXT NOT NULL,
  UNIQUE (session_id, native_id)
);
CREATE VIRTUAL TABLE native_history_fts USING fts5(
  content, content='native_history_messages', content_rowid='id', tokenize='unicode61'
);
CREATE TRIGGER native_history_ai AFTER INSERT ON native_history_messages BEGIN
  INSERT INTO native_history_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER native_history_ad AFTER DELETE ON native_history_messages BEGIN
  INSERT INTO native_history_fts(native_history_fts, rowid, content)
  VALUES ('delete', old.id, old.content);
END;
CREATE TRIGGER native_history_au AFTER UPDATE ON native_history_messages BEGIN
  INSERT INTO native_history_fts(native_history_fts, rowid, content)
  VALUES ('delete', old.id, old.content);
  INSERT INTO native_history_fts(rowid, content) VALUES (new.id, new.content);
END;
