CREATE TABLE IF NOT EXISTS archive_mail_relation (
  child_mail_id TEXT NOT NULL REFERENCES archive_mail(id) ON DELETE CASCADE,
  parent_message_id TEXT NOT NULL,
  parent_mail_id TEXT REFERENCES archive_mail(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('reply', 'reference')),
  resolution TEXT NOT NULL CHECK (resolution IN ('resolved', 'missing', 'ambiguous', 'cycle', 'self')),
  PRIMARY KEY (child_mail_id, parent_message_id, kind),
  CHECK ((resolution = 'resolved' AND parent_mail_id IS NOT NULL)
    OR (resolution <> 'resolved' AND parent_mail_id IS NULL)),
  CHECK (parent_mail_id IS NULL OR child_mail_id <> parent_mail_id)
);

CREATE INDEX IF NOT EXISTS archive_mail_relation_parent_idx
  ON archive_mail_relation(parent_mail_id, child_mail_id)
  WHERE resolution='resolved';
