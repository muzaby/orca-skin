-- 정규화 Persistence (provider-runtime.md §7) — 메시지를 순서 보존 parts 로 저장한다.
-- messages.content 는 삭제하지 않고 "text/reasoning parts 의 concat 캐시"로 유지한다
-- (FTS5 contentless 가 messages.content 를 참조하므로 트리거를 건드리지 않는다).
-- 정식 배포 전이라 하위호환 불필요 — 기존 messages/tool_calls 를 parts 로 backfill 후
-- tool_calls 테이블은 DROP 한다.

CREATE TABLE message_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,                       -- 메시지 내 파트 순서
  type TEXT NOT NULL,                          -- text|reasoning|tool_call|tool_result|file|diff|structured_output|error
  tool_run_id TEXT,                            -- tool_call/tool_result 만 (toolRunId)
  payload_json TEXT NOT NULL                   -- type 외 나머지 필드의 JSON
);
CREATE INDEX idx_message_parts_msg ON message_parts(message_id, idx);
CREATE INDEX idx_message_parts_tool_run ON message_parts(tool_run_id);

-- backfill ① 기존 메시지 본문 → text 파트(idx 0). 빈 본문(도구만 있던 assistant row)은 제외.
INSERT INTO message_parts (message_id, idx, type, tool_run_id, payload_json)
SELECT id, 0, 'text', NULL, json_object('text', content)
FROM messages
WHERE content <> '';

-- backfill ② tool_calls → tool_call 파트(홀수 idx) + tool_result 파트(짝수 idx).
-- 같은 message 안에서 tc.id 순으로 1,2,3,4… 배치되어 text(0) 다음에 호출/결과 쌍이 온다.
INSERT INTO message_parts (message_id, idx, type, tool_run_id, payload_json)
SELECT
  tc.message_id,
  2 * ROW_NUMBER() OVER (PARTITION BY tc.message_id ORDER BY tc.id) - 1,
  'tool_call',
  tc.tool_use_id,
  json_object('toolName', tc.name, 'args', json(tc.input_json))
FROM tool_calls tc;

INSERT INTO message_parts (message_id, idx, type, tool_run_id, payload_json)
SELECT
  tc.message_id,
  2 * ROW_NUMBER() OVER (PARTITION BY tc.message_id ORDER BY tc.id),
  'tool_result',
  tc.tool_use_id,
  json_object(
    'result', json(COALESCE(tc.result_json, 'null')),
    'isError', json(CASE WHEN tc.status = 'error' THEN 'true' ELSE 'false' END)
  )
FROM tool_calls tc
WHERE tc.result_json IS NOT NULL;

DROP TABLE tool_calls;
