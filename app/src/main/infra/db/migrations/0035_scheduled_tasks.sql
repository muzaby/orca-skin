-- 예약 작업. 정의는 scheduled_tasks, 실행 이력은 scheduled_task_runs.
-- trigger_json·action_json 은 shared/scheduled-tasks.ts 의 TriggerSpec·ScheduledTaskAction 직렬화다.
-- 프로젝트가 지워져도 작업은 남는다(project_id NULL → 실행 시 실패로 기록).
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  trigger_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_task_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK(origin IN ('schedule', 'manual')),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL CHECK(status IN ('running', 'success', 'error', 'skipped')),
  error TEXT,
  session_id TEXT,
  exit_code INTEGER,
  output TEXT,
  output_truncated INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_task_started
  ON scheduled_task_runs(task_id, started_at DESC, id DESC);
