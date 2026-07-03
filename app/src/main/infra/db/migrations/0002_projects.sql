-- Phase 3+ — 프로젝트 기능. sessions 는 project_id 로 프로젝트 소속을 표현하고,
-- 프로젝트 삭제 시 ON DELETE SET NULL 로 세션 자체는 보존한다.
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);

ALTER TABLE sessions ADD COLUMN project_id TEXT
  REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX idx_sessions_project ON sessions(project_id, updated_at DESC);
