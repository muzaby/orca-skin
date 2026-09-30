CREATE TABLE archive_session_scope (
  session_id TEXT PRIMARY KEY,
  source_ids TEXT NOT NULL,
  sent_after INTEGER,
  sent_before INTEGER,
  token TEXT NOT NULL
);
CREATE TABLE archive_evidence (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  mail_id TEXT REFERENCES archive_mail(id) ON DELETE SET NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  body_hash TEXT NOT NULL,
  CHECK (start_offset >= 0 AND end_offset > start_offset)
);
CREATE INDEX archive_evidence_session_idx ON archive_evidence(session_id);
CREATE TABLE archive_plugin_revision (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
INSERT INTO archive_plugin_revision VALUES (1, 0);
CREATE TRIGGER archive_plugin_insert AFTER INSERT ON archive_source_occurrence BEGIN
  UPDATE archive_plugin_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER archive_plugin_delete AFTER DELETE ON archive_source_occurrence BEGIN
  UPDATE archive_plugin_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER archive_plugin_revision_change AFTER UPDATE OF state ON archive_source_revision BEGIN
  UPDATE archive_plugin_revision SET revision=revision+1 WHERE id=1;
END;
