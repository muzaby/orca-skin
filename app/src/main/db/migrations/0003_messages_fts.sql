-- FTS5 가상 테이블 + 기존 messages.content 동기화 트리거.
-- contentless external-content (`content='messages'`) 패턴: FTS5 는 rowid 만 들고
-- 실 본문은 messages 테이블을 참조. 디스크 사용량 절약 + 단일 source of truth.
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='id',
  tokenize='unicode61'
);

-- 기존 메시지 백필
INSERT INTO messages_fts(rowid, content)
  SELECT id, content FROM messages;

-- 삽입/갱신/삭제 시 인덱스 동기화 (FTS5 standard pattern)
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
END;
CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
