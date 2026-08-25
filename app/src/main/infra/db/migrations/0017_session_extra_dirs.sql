-- 세션의 추가 참조 경로 (CLI `/add-dir` 대응) — 절대 경로 JSON 배열. NULL/부재 = 없음.
-- cwd 와 같은 수명(새 세션 출생 시 고정)이라 세션행에 둔다.
ALTER TABLE sessions ADD COLUMN extra_dirs TEXT;
