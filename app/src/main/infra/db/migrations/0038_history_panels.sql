CREATE TABLE history_panel_inputs (
  session_id TEXT NOT NULL,
  generation TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  PRIMARY KEY(session_id,generation,ordinal),
  FOREIGN KEY(session_id,generation,ordinal) REFERENCES history_message_headers ON DELETE CASCADE
) WITHOUT ROWID;
CREATE TABLE history_panel_rows (
  session_id TEXT NOT NULL,
  generation TEXT NOT NULL,
  kind TEXT NOT NULL,
  position INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_bytes INTEGER NOT NULL,
  PRIMARY KEY(session_id,generation,kind,position),
  UNIQUE(session_id,generation,kind,item_key),
  FOREIGN KEY(session_id,generation) REFERENCES history_generations ON DELETE CASCADE
) WITHOUT ROWID;
CREATE TABLE history_panel_detail_chunks (
  session_id TEXT NOT NULL,
  generation TEXT NOT NULL,
  kind TEXT NOT NULL,
  position INTEGER NOT NULL,
  byte_offset INTEGER NOT NULL,
  payload BLOB NOT NULL CHECK(length(payload) <= 65536),
  PRIMARY KEY(session_id,generation,kind,position,byte_offset),
  FOREIGN KEY(session_id,generation,kind,position) REFERENCES history_panel_rows ON DELETE CASCADE
) WITHOUT ROWID;
-- Rebuild even a partially completed generation from an earlier application version.
UPDATE history_index_state SET revision=revision+1,rebuild=1;

ALTER TABLE history_generations ADD COLUMN user_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE history_session_cost (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  total REAL NOT NULL
);
INSERT INTO history_session_cost SELECT session_id, sum(coalesce(total_cost_usd,0))
  FROM turn_usage WHERE session_id IS NOT NULL GROUP BY session_id;
CREATE TRIGGER history_cost_insert AFTER INSERT ON turn_usage WHEN new.session_id IS NOT NULL BEGIN
  INSERT INTO history_session_cost VALUES(new.session_id,coalesce(new.total_cost_usd,0))
  ON CONFLICT(session_id) DO UPDATE SET total=total+excluded.total;
END;
CREATE TRIGGER history_cost_delete AFTER DELETE ON turn_usage WHEN old.session_id IS NOT NULL BEGIN
  UPDATE history_session_cost SET total=total-coalesce(old.total_cost_usd,0) WHERE session_id=old.session_id;
END;
CREATE TRIGGER history_cost_update AFTER UPDATE OF session_id,total_cost_usd ON turn_usage BEGIN
  UPDATE history_session_cost SET total=total-coalesce(old.total_cost_usd,0) WHERE session_id=old.session_id;
  INSERT INTO history_session_cost SELECT new.session_id,coalesce(new.total_cost_usd,0) WHERE new.session_id IS NOT NULL
  ON CONFLICT(session_id) DO UPDATE SET total=total+excluded.total;
END;

CREATE TABLE history_panel_counts (
  session_id TEXT NOT NULL, generation TEXT NOT NULL, kind TEXT NOT NULL, total INTEGER NOT NULL,
  PRIMARY KEY(session_id,generation,kind),
  FOREIGN KEY(session_id,generation) REFERENCES history_generations ON DELETE CASCADE
) WITHOUT ROWID;
CREATE TABLE history_metadata_refs (
  session_id TEXT NOT NULL, generation TEXT NOT NULL, token TEXT NOT NULL, bytes INTEGER NOT NULL,
  UNIQUE(session_id,generation,token),
  FOREIGN KEY(session_id,generation) REFERENCES history_generations ON DELETE CASCADE
);
CREATE TABLE history_metadata_chunks (
  session_id TEXT NOT NULL,
  generation TEXT NOT NULL,
  token TEXT NOT NULL,
  byte_offset INTEGER NOT NULL,
  payload BLOB NOT NULL CHECK(length(payload)<=65536),
  PRIMARY KEY(session_id,generation,token,byte_offset),
  FOREIGN KEY(session_id,generation,token) REFERENCES history_metadata_refs(session_id,generation,token) ON DELETE CASCADE
) WITHOUT ROWID;
CREATE INDEX history_last_usage ON turn_usage(session_id,created_at DESC,id DESC);
