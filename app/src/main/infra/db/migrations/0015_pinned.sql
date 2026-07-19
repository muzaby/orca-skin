-- Phase 3++ — 고정(pin) 기능. 세션·프로젝트를 좌측 nav "고정됨" 섹션에 고정한다.
-- pinned_at = 고정 시각(NULL=미고정). 시각값이 정렬 키를 겸한다(최근 고정이 위).
-- 세션/프로젝트 삭제 시 행 CASCADE/SET NULL 로 자연 정리되므로 별도 정리 불필요.
ALTER TABLE sessions ADD COLUMN pinned_at INTEGER;
ALTER TABLE projects ADD COLUMN pinned_at INTEGER;
