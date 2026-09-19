CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  auth_id TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  tls INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 원격 메시지 식별자 ledger. **프로토콜 중립이다** (0237 D-058):
--   remote_uid — POP3 UIDL | IMAP `UIDVALIDITY:UID`. 계정 안에서 안정적인 식별자.
--   ordinal    — POP3 message number | IMAP sequence number. **세션 안에서만 유효**하므로
--                nullable 이다. 다음 세션에 같은 값이라는 보장이 없다.
CREATE TABLE IF NOT EXISTS message_ledger (
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  remote_uid TEXT NOT NULL,
  ordinal INTEGER,
  first_seen_at INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active', 'missing')),
  PRIMARY KEY (account_id, remote_uid)
);

CREATE TABLE IF NOT EXISTS mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  remote_uid TEXT NOT NULL,
  header_date INTEGER,
  first_seen_at INTEGER NOT NULL,
  from_addr TEXT NOT NULL,
  to_addrs TEXT NOT NULL,
  cc_addrs TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  UNIQUE (account_id, remote_uid)
);

CREATE VIRTUAL TABLE IF NOT EXISTS mail_fts USING fts5(
  from_addr,
  to_addrs,
  cc_addrs,
  subject,
  body_text,
  content='mail',
  content_rowid='id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS mail_ai AFTER INSERT ON mail BEGIN
  INSERT INTO mail_fts(rowid, from_addr, to_addrs, cc_addrs, subject, body_text)
    VALUES (new.id, new.from_addr, new.to_addrs, new.cc_addrs, new.subject, new.body_text);
END;
CREATE TRIGGER IF NOT EXISTS mail_ad AFTER DELETE ON mail BEGIN
  INSERT INTO mail_fts(mail_fts, rowid, from_addr, to_addrs, cc_addrs, subject, body_text)
    VALUES ('delete', old.id, old.from_addr, old.to_addrs, old.cc_addrs, old.subject, old.body_text);
END;
CREATE TRIGGER IF NOT EXISTS mail_au AFTER UPDATE ON mail BEGIN
  INSERT INTO mail_fts(mail_fts, rowid, from_addr, to_addrs, cc_addrs, subject, body_text)
    VALUES ('delete', old.id, old.from_addr, old.to_addrs, old.cc_addrs, old.subject, old.body_text);
  INSERT INTO mail_fts(rowid, from_addr, to_addrs, cc_addrs, subject, body_text)
    VALUES (new.id, new.from_addr, new.to_addrs, new.cc_addrs, new.subject, new.body_text);
END;

CREATE TABLE IF NOT EXISTS attachment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mail_id INTEGER NOT NULL REFERENCES mail(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  stored_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  account_id TEXT PRIMARY KEY REFERENCES account(id) ON DELETE CASCADE,
  last_sync_at INTEGER,
  last_error_code TEXT,
  protection_kind TEXT NOT NULL DEFAULT 'none' CHECK (protection_kind IN ('none', 'suspected')),
  protection_first_observed_at INTEGER,
  protection_observations INTEGER,
  protection_fingerprint TEXT
);
