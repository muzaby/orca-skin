-- per-turn 사용량 원장(ledger). 턴 종료(telemetry)마다 1행. 시간(created_at)·모델별 집계로
-- 1일/주/월 사용량을 산출한다(추후 usage 화면). 세션 삭제해도 과금 이력은 보존 — session_id 는
-- ON DELETE SET NULL. 컨텍스트 도넛/패널은 세션의 최신 행에서 마지막 턴 통계를 복원한다.
CREATE TABLE usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  model TEXT,
  created_at INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_creation_tokens INTEGER,
  cost_usd REAL
);
CREATE INDEX idx_usage_created ON usage_events(created_at);
CREATE INDEX idx_usage_session ON usage_events(session_id);
