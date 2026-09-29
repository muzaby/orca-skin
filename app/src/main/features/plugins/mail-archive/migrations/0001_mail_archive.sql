CREATE TABLE IF NOT EXISTS archive_mail (
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('eml', 'pst')),
  source_path TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  item_key TEXT NOT NULL,
  folder_path TEXT,
  sent_at INTEGER,
  imported_at INTEGER NOT NULL,
  from_addr TEXT NOT NULL,
  to_addrs TEXT NOT NULL,
  cc_addrs TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  thread_key TEXT NOT NULL,
  attachment_names TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  UNIQUE (source_kind, source_fingerprint, item_key)
);

CREATE TABLE IF NOT EXISTS archive_attachment (
  id TEXT PRIMARY KEY,
  mail_id TEXT NOT NULL REFERENCES archive_mail(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS archive_mail_date_idx ON archive_mail(sent_at DESC, imported_at DESC);
CREATE INDEX IF NOT EXISTS archive_mail_thread_idx ON archive_mail(thread_key, sent_at);

CREATE VIRTUAL TABLE IF NOT EXISTS archive_mail_fts USING fts5(
  from_addr,
  to_addrs,
  cc_addrs,
  subject,
  body_text,
  attachment_names,
  content='archive_mail',
  content_rowid='rowid',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS archive_mail_ai AFTER INSERT ON archive_mail BEGIN
  INSERT INTO archive_mail_fts(rowid, from_addr, to_addrs, cc_addrs, subject, body_text, attachment_names)
    VALUES (new.rowid, new.from_addr, new.to_addrs, new.cc_addrs, new.subject, new.body_text, new.attachment_names);
END;
CREATE TRIGGER IF NOT EXISTS archive_mail_ad AFTER DELETE ON archive_mail BEGIN
  INSERT INTO archive_mail_fts(archive_mail_fts, rowid, from_addr, to_addrs, cc_addrs, subject, body_text, attachment_names)
    VALUES ('delete', old.rowid, old.from_addr, old.to_addrs, old.cc_addrs, old.subject, old.body_text, old.attachment_names);
END;
CREATE TRIGGER IF NOT EXISTS archive_mail_au AFTER UPDATE ON archive_mail BEGIN
  INSERT INTO archive_mail_fts(archive_mail_fts, rowid, from_addr, to_addrs, cc_addrs, subject, body_text, attachment_names)
    VALUES ('delete', old.rowid, old.from_addr, old.to_addrs, old.cc_addrs, old.subject, old.body_text, old.attachment_names);
  INSERT INTO archive_mail_fts(rowid, from_addr, to_addrs, cc_addrs, subject, body_text, attachment_names)
    VALUES (new.rowid, new.from_addr, new.to_addrs, new.cc_addrs, new.subject, new.body_text, new.attachment_names);
END;
