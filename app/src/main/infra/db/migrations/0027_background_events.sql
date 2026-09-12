CREATE TABLE background_task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  generation TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(session_id, generation, event_key)
);
CREATE INDEX background_task_events_session_order
  ON background_task_events(session_id, id);
