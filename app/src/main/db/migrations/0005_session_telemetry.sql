-- 컨텍스트 도넛 + TelemetryPanel 을 세션 수명 동안 영속화한다. 마지막 턴의 provider-reported
-- 통계(ProviderReportedTelemetry) 를 JSON 으로, 세션 누적 비용(USD)을 별도 컬럼으로 저장.
-- 메시지를 받을 때만 보이고 재진입/재시작 시 사라지던 문제(메모리 전용 state) 해결.
ALTER TABLE sessions ADD COLUMN last_telemetry_json TEXT;
ALTER TABLE sessions ADD COLUMN session_cost_usd REAL;
