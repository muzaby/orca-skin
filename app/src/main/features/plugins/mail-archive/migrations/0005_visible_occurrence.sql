-- 메일 identity는 보관함 전체에서 하나다.
CREATE UNIQUE INDEX IF NOT EXISTS archive_mail_identity_idx ON archive_mail(identity_key);

-- 검색 가능 = 검증된 revision에 occurrence가 있음. 모든 조회가 이 뷰 하나로 가시성을 판정한다.
-- revision은 누적된다: 새 revision이 검증돼도 이전 revision에서 확인한 메일은 명시 제거 전까지 남는다.
CREATE VIEW IF NOT EXISTS archive_visible_occurrence AS
  SELECT o.rowid AS occurrence_order, o.source_id, o.revision, o.item_key, o.mail_id, o.folder_path
  FROM archive_source_occurrence o
  JOIN archive_source_revision r ON r.source_id = o.source_id AND r.revision = o.revision
  WHERE r.state = 'verified';
