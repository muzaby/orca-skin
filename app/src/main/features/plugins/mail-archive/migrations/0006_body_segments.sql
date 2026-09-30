CREATE TABLE archive_body_segment (
  mail_id TEXT NOT NULL REFERENCES archive_mail(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
  kind TEXT NOT NULL CHECK (kind IN ('unknown', 'quote', 'signature')),
  rule_id TEXT NOT NULL,
  classifier_revision TEXT NOT NULL,
  confidence_class TEXT NOT NULL CHECK (confidence_class IN ('certain', 'uncertain')),
  PRIMARY KEY (mail_id, ordinal)
);

-- Even an empty body needs a completed projection marker for restart-safe backfill.
CREATE TABLE archive_body_projection (
  mail_id TEXT PRIMARY KEY REFERENCES archive_mail(id) ON DELETE CASCADE,
  classifier_revision TEXT NOT NULL
);
