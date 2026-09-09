ALTER TABLE sessions ADD COLUMN agent_kind TEXT NOT NULL DEFAULT 'coding'
  CHECK (agent_kind IN ('coding', 'work'));
