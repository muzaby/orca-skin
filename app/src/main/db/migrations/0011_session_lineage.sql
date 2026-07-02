-- 0062 conversation continuity — 세션 계보(lineage) 영속화.
-- fork/handoff 로 파생된 세션의 부모 관계를 전용 테이블에 남긴다(hot sessions 행 미오염).
-- child 당 부모는 1개(child PK). 부모/자식 어느 쪽이 삭제돼도 계보 행은 함께 정리(CASCADE).
-- fork_point_message_idx 는 점-분기(특정 메시지 절단) 후속용 — v1 전체 분기는 NULL.

CREATE TABLE session_lineage (
  child_session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  parent_session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,                     -- 'fork' | 'handoff'
  fork_point_message_idx INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_session_lineage_parent ON session_lineage(parent_session_id);
