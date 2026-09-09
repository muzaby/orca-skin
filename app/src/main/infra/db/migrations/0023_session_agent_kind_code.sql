ALTER TABLE sessions ADD COLUMN agent_kind_next TEXT NOT NULL DEFAULT 'code'
  CHECK (agent_kind_next IN ('code', 'work'));

UPDATE sessions
SET agent_kind_next = CASE agent_kind
  WHEN 'coding' THEN 'code'
  WHEN 'work' THEN 'work'
END;

ALTER TABLE sessions DROP COLUMN agent_kind;
ALTER TABLE sessions RENAME COLUMN agent_kind_next TO agent_kind;
