-- Last model consumed by this session; provider/model are updated together.
ALTER TABLE sessions ADD COLUMN last_model TEXT;
