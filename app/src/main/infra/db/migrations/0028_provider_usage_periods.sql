CREATE TABLE provider_usage_periods (
  provider_key TEXT NOT NULL,
  period_kind TEXT NOT NULL CHECK (period_kind IN ('day', 'month')),
  period TEXT NOT NULL,
  input_tokens INTEGER, output_tokens INTEGER,
  cache_creation_input_tokens INTEGER, cache_read_input_tokens INTEGER,
  cost_usd REAL,
  fetched_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider_key, period_kind, period)
);

CREATE TABLE provider_usage_period_models (
  provider_key TEXT NOT NULL,
  period_kind TEXT NOT NULL CHECK (period_kind IN ('day', 'month')),
  period TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER, output_tokens INTEGER,
  cache_creation_input_tokens INTEGER, cache_read_input_tokens INTEGER,
  cost_usd REAL,
  fetched_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider_key, period_kind, period, model)
);
