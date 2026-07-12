-- Latest authoritative usage report fetched from a provider/gateway API.
-- One row per provider. report_json preserves provider-specific optional sections
-- (quota/totals/byModel) while scalar columns keep the limit path cheap.
CREATE TABLE provider_usage_report_cache (
  provider_key TEXT PRIMARY KEY,
  report_json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  as_of INTEGER,
  quota_limit_usd REAL,
  quota_used_usd REAL,
  quota_remaining_usd REAL,
  updated_at INTEGER NOT NULL
);
