ALTER TABLE archive_mail ADD COLUMN source_id TEXT;
ALTER TABLE archive_mail ADD COLUMN identity_key TEXT;

CREATE TABLE IF NOT EXISTS archive_source (
  source_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('eml', 'pst')),
  source_path TEXT NOT NULL,
  current_revision INTEGER,
  current_fingerprint TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS archive_source_revision (
  source_id TEXT NOT NULL REFERENCES archive_source(source_id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('staging', 'verified', 'interrupted', 'failed')),
  started_at INTEGER NOT NULL,
  verified_at INTEGER,
  PRIMARY KEY (source_id, revision),
  UNIQUE (source_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS archive_source_occurrence (
  source_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  mail_id TEXT NOT NULL REFERENCES archive_mail(id) ON DELETE CASCADE,
  folder_path TEXT,
  PRIMARY KEY (source_id, revision, item_key, mail_id),
  FOREIGN KEY (source_id, revision)
    REFERENCES archive_source_revision(source_id, revision) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS archive_source_occurrence_mail_idx
  ON archive_source_occurrence(mail_id, source_id, revision);
CREATE INDEX IF NOT EXISTS archive_source_revision_state_idx
  ON archive_source_revision(source_id, state, revision DESC);
