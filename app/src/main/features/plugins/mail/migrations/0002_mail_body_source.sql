-- 저장된 본문(body_text)의 출처. 'none' = 저장 본문이 비어 있다 (0302 D-005·D-016).
-- 값 집합은 여기서 확정한다 — SQLite 는 열 CHECK 를 ALTER 로 넓힐 수 없다.
ALTER TABLE mail ADD COLUMN body_source TEXT NOT NULL DEFAULT 'none'
  CHECK (body_source IN ('plain', 'html', 'attachment', 'none'));

-- 이전 수집은 email.text 만 저장했다. 비어 있지 않은 기존 본문은 전부 plain 이다.
UPDATE mail SET body_source = 'plain' WHERE body_text <> '';
