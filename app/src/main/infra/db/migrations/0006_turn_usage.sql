-- usage_events(0005)를 원 제시안 turn_usage + turn_model_usage 로 통일한다.
-- 0005 파일은 이미 merge 된 불변 마이그레이션이므로 새 파일에서 이관 후 제거한다.
CREATE TABLE turn_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_creation_input_tokens INTEGER,
  cache_read_input_tokens INTEGER,
  total_cost_usd REAL,
  created_at INTEGER NOT NULL
);

CREATE TABLE turn_model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turn_usage_id INTEGER NOT NULL REFERENCES turn_usage(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_creation_input_tokens INTEGER,
  cache_read_input_tokens INTEGER,
  cost_usd REAL
);

INSERT INTO turn_usage (
  id,
  session_id,
  message_id,
  input_tokens,
  output_tokens,
  cache_creation_input_tokens,
  cache_read_input_tokens,
  total_cost_usd,
  created_at
)
SELECT
  id,
  session_id,
  NULL,
  input_tokens,
  output_tokens,
  cache_creation_tokens,
  cache_read_tokens,
  cost_usd,
  created_at
FROM usage_events;

INSERT INTO turn_model_usage (
  turn_usage_id,
  model,
  input_tokens,
  output_tokens,
  cache_creation_input_tokens,
  cache_read_input_tokens,
  cost_usd
)
SELECT
  id,
  model,
  input_tokens,
  output_tokens,
  cache_creation_tokens,
  cache_read_tokens,
  cost_usd
FROM usage_events
WHERE model IS NOT NULL;

CREATE INDEX idx_turn_usage_created ON turn_usage(created_at);
CREATE INDEX idx_turn_usage_session ON turn_usage(session_id);
CREATE INDEX idx_turn_model_usage_turn ON turn_model_usage(turn_usage_id);

DROP TABLE usage_events;
