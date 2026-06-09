CREATE TABLE turn_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_creation_input_tokens INTEGER NOT NULL,
  cache_read_input_tokens INTEGER NOT NULL,
  total_cost_usd REAL NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_turn_usage_created ON turn_usage(created_at DESC);

CREATE TABLE turn_model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turn_usage_id INTEGER NOT NULL REFERENCES turn_usage(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_creation_input_tokens INTEGER NOT NULL,
  cache_read_input_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL
);
CREATE INDEX idx_turn_model_usage_turn ON turn_model_usage(turn_usage_id);
