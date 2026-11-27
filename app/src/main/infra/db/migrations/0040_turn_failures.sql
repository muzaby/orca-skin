-- Index the immutable part itself, including copies materialized by a fork.
CREATE TABLE turn_failures (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  failure_id TEXT NOT NULL,
  owner_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  part_id INTEGER NOT NULL UNIQUE REFERENCES message_parts(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, failure_id)
) WITHOUT ROWID;

CREATE INDEX turn_failures_owner ON turn_failures(owner_message_id);

CREATE TRIGGER turn_failure_receipt AFTER INSERT ON message_parts
WHEN NEW.type = 'error' AND json_type(NEW.payload_json, '$.failure') = 'object'
BEGIN
  INSERT INTO turn_failures(session_id, failure_id, owner_message_id, part_id)
  VALUES (
    (SELECT session_id FROM messages WHERE id = NEW.message_id AND role = 'assistant'
       AND message_key = json_extract(NEW.payload_json, '$.failure.assistantMessageKey')),
    json_extract(NEW.payload_json, '$.failure.failureId'),
    (SELECT owner.id FROM messages owner JOIN messages assistant ON assistant.id = NEW.message_id
      AND owner.session_id = assistant.session_id AND owner.role = 'user'
      AND owner.message_key = json_extract(NEW.payload_json, '$.failure.ownerUserMessageKey')),
    NEW.id
  );
END;
