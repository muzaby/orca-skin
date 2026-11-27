-- Incarnations survive content edits. Replacing a recovery archive invalidates
-- its ordinal locators even when the native session key and row numbers repeat.
CREATE TABLE history_source_clock (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  revision INTEGER NOT NULL
);
INSERT INTO history_source_clock VALUES(1,0);
CREATE TABLE history_source_epochs (
  incarnation INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  native INTEGER NOT NULL DEFAULT 0,
  archive INTEGER NOT NULL DEFAULT 0
);
INSERT INTO history_source_epochs(session_id) SELECT id FROM sessions ORDER BY id;
CREATE TRIGGER history_session_insert AFTER INSERT ON sessions BEGIN
  INSERT INTO history_source_epochs(session_id) VALUES(new.id);
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
END;
CREATE TRIGGER history_native_source_change AFTER UPDATE OF payload_json ON native_history_snapshots
WHEN (CASE WHEN json_valid(old.payload_json) THEN json_extract(old.payload_json,'$.sourceKey') END)
  IS NOT (CASE WHEN json_valid(new.payload_json) THEN json_extract(new.payload_json,'$.sourceKey') END)
BEGIN UPDATE history_source_epochs SET native=native+1 WHERE session_id=new.session_id; END;
CREATE TRIGGER history_native_source_delete AFTER DELETE ON native_history_snapshots
BEGIN UPDATE history_source_epochs SET native=native+1 WHERE session_id=old.session_id; END;
CREATE TRIGGER history_archive_change AFTER UPDATE OF archive_json,native_id ON native_session_recovery
BEGIN UPDATE history_source_epochs SET archive=archive+1 WHERE session_id=new.session_id; END;
CREATE TRIGGER history_archive_delete AFTER DELETE ON native_session_recovery
BEGIN UPDATE history_source_epochs SET archive=archive+1 WHERE session_id=old.session_id; END;

-- The active generation can be read until its successor has been fully published.
CREATE TABLE history_index_state (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0,
  published TEXT,
  published_revision INTEGER,
  building TEXT,
  building_revision INTEGER,
  next_ordinal INTEGER NOT NULL DEFAULT 0,
  rebuild INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE history_generations (
  session_id TEXT NOT NULL REFERENCES history_index_state(session_id) ON DELETE CASCADE,
  generation TEXT NOT NULL,
  native_sync TEXT,
  PRIMARY KEY(session_id, generation)
) WITHOUT ROWID;
CREATE TABLE history_message_headers (
  session_id TEXT NOT NULL,
  generation TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  turn INTEGER NOT NULL,
  message_key TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  incomplete INTEGER NOT NULL,
  part_count INTEGER NOT NULL,
  body_bytes INTEGER NOT NULL,
  PRIMARY KEY(session_id, generation, ordinal),
  FOREIGN KEY(session_id, generation) REFERENCES history_generations ON DELETE CASCADE
) WITHOUT ROWID;
CREATE UNIQUE INDEX history_header_key ON history_message_headers(session_id,generation,message_key);
CREATE INDEX history_turn_order ON history_message_headers(session_id,generation,turn,ordinal);
CREATE TABLE history_body_chunks (
  session_id TEXT NOT NULL,
  generation TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  byte_offset INTEGER NOT NULL,
  payload BLOB NOT NULL CHECK(length(payload) <= 65536),
  PRIMARY KEY(session_id,generation,ordinal,byte_offset),
  FOREIGN KEY(session_id,generation,ordinal) REFERENCES history_message_headers ON DELETE CASCADE
) WITHOUT ROWID;
CREATE TABLE history_source_aliases (
  session_id TEXT NOT NULL,
  generation TEXT NOT NULL,
  source TEXT NOT NULL,
  identity TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  PRIMARY KEY(session_id,generation,source,identity),
  FOREIGN KEY(session_id,generation,ordinal) REFERENCES history_message_headers ON DELETE CASCADE
) WITHOUT ROWID;
CREATE INDEX history_alias_owner ON history_source_aliases(session_id,generation,ordinal);
CREATE TABLE history_part_owners (
  session_id TEXT NOT NULL,
  generation TEXT NOT NULL,
  kind TEXT NOT NULL,
  owner_key TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  part_index INTEGER NOT NULL,
  PRIMARY KEY(session_id,generation,kind,owner_key,ordinal,part_index),
  FOREIGN KEY(session_id,generation,ordinal) REFERENCES history_message_headers ON DELETE CASCADE
) WITHOUT ROWID;
CREATE INDEX history_part_owner_message ON history_part_owners(session_id,generation,ordinal);
CREATE TABLE history_dirty_messages (
  session_id TEXT NOT NULL REFERENCES history_index_state(session_id) ON DELETE CASCADE,
  local_id INTEGER NOT NULL,
  PRIMARY KEY(session_id,local_id)
) WITHOUT ROWID;

CREATE TRIGGER history_messages_insert AFTER INSERT ON messages BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1 WHERE session_id=new.session_id;
  INSERT INTO history_dirty_messages(session_id,local_id)
  SELECT session_id,new.id FROM history_index_state WHERE session_id=new.session_id ON CONFLICT DO NOTHING;
END;

CREATE TRIGGER history_messages_update AFTER UPDATE ON messages BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1 WHERE session_id=new.session_id;
  INSERT INTO history_dirty_messages(session_id,local_id)
  SELECT session_id,new.id FROM history_index_state WHERE session_id=new.session_id ON CONFLICT DO NOTHING;
END;

CREATE TRIGGER history_messages_delete AFTER DELETE ON messages BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=old.session_id;
END;

CREATE TRIGGER history_message_parts_insert AFTER INSERT ON message_parts BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1 WHERE session_id=(SELECT session_id FROM messages WHERE id=new.message_id);
  INSERT INTO history_dirty_messages(session_id,local_id)
  SELECT session_id,new.message_id FROM history_index_state WHERE session_id=(SELECT session_id FROM messages WHERE id=new.message_id) ON CONFLICT DO NOTHING;
END;

CREATE TRIGGER history_message_parts_update AFTER UPDATE ON message_parts BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1 WHERE session_id=(SELECT session_id FROM messages WHERE id=new.message_id);
  INSERT INTO history_dirty_messages(session_id,local_id)
  SELECT session_id,new.message_id FROM history_index_state WHERE session_id=(SELECT session_id FROM messages WHERE id=new.message_id) ON CONFLICT DO NOTHING;
END;

CREATE TRIGGER history_message_parts_delete AFTER DELETE ON message_parts BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1 WHERE session_id=(SELECT session_id FROM messages WHERE id=old.message_id);
  INSERT INTO history_dirty_messages(session_id,local_id)
  SELECT session_id,old.message_id FROM history_index_state WHERE session_id=(SELECT session_id FROM messages WHERE id=old.message_id) ON CONFLICT DO NOTHING;
END;

CREATE TRIGGER history_native_history_snapshots_insert AFTER INSERT ON native_history_snapshots BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=new.session_id;
END;

CREATE TRIGGER history_native_history_snapshots_update AFTER UPDATE OF payload_json,local_frontier ON native_history_snapshots BEGIN
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=new.session_id;
END;

CREATE TRIGGER history_native_history_snapshots_delete AFTER DELETE ON native_history_snapshots BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=old.session_id;
END;

CREATE TRIGGER history_native_message_bindings_insert AFTER INSERT ON native_message_bindings BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=(SELECT session_id FROM messages WHERE id=new.message_id);
END;

CREATE TRIGGER history_native_message_bindings_update AFTER UPDATE ON native_message_bindings BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=(SELECT session_id FROM messages WHERE id=new.message_id);
END;

CREATE TRIGGER history_native_message_bindings_delete AFTER DELETE ON native_message_bindings BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=(SELECT session_id FROM messages WHERE id=old.message_id);
END;

CREATE TRIGGER history_native_session_recovery_insert AFTER INSERT ON native_session_recovery BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=new.session_id;
END;

CREATE TRIGGER history_native_session_recovery_update AFTER UPDATE OF native_id,archive_json,local_frontier ON native_session_recovery BEGIN
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=new.session_id;
END;

CREATE TRIGGER history_native_session_recovery_delete AFTER DELETE ON native_session_recovery BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
  UPDATE history_index_state SET revision=revision+1, rebuild=1 WHERE session_id=old.session_id;
END;

-- Changes used to decide whether a native read is still current may include
-- the recovery receipt, source cursor, or session's working directory.
CREATE TRIGGER history_recovery_observed AFTER UPDATE ON native_session_recovery BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
END;
CREATE TRIGGER history_snapshot_observed AFTER UPDATE ON native_history_snapshots BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
END;
CREATE TRIGGER history_session_observed AFTER UPDATE ON sessions BEGIN
  UPDATE history_source_clock SET revision=revision+1 WHERE singleton=1;
END;
