ALTER TABLE archive_mail ADD COLUMN body_kind TEXT NOT NULL DEFAULT 'legacy'
  CHECK (body_kind IN ('plain', 'html', 'none', 'legacy'));
ALTER TABLE archive_mail ADD COLUMN body_alternate_text TEXT;
ALTER TABLE archive_mail ADD COLUMN body_alternate_kind TEXT
  CHECK (body_alternate_kind IS NULL OR body_alternate_kind IN ('plain', 'html'));
ALTER TABLE archive_mail ADD COLUMN body_alternate_omitted INTEGER NOT NULL DEFAULT 0
  CHECK (body_alternate_omitted IN (0, 1));
ALTER TABLE archive_mail ADD COLUMN body_quality_flags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE archive_mail ADD COLUMN body_selection_reason TEXT NOT NULL DEFAULT 'legacy';
