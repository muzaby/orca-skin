ALTER TABLE messages ADD COLUMN message_key TEXT;

CREATE UNIQUE INDEX idx_messages_session_key
ON messages(session_id, message_key)
WHERE message_key IS NOT NULL;
