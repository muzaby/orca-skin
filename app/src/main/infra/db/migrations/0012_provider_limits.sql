-- provider별 월 지출 한도(0080 피드백 항목 4). provider_key = sessions.provider_key = agent key
-- (예: 'claude', 'claude-bedrock'). limit_usd NULL = 무제한(명시 설정 보존). 행 부재 = 미설정.
-- provider별 실사용량은 별도 테이블 없이 turn_usage ⨝ sessions(provider_key)로 파생한다.
CREATE TABLE provider_limits (
  provider_key TEXT PRIMARY KEY,
  limit_usd REAL,
  updated_at INTEGER NOT NULL
);
