// 로깅 공유 계약 — 순수 타입/상수만 (런타임 의존 0). preload(sandbox=true)·renderer·main 모두 import.
// 스키마 정본은 docs/arch/backend/observability.md, 런타임 검증(zod)은 ./protocol.ts (main 전용).

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

// 로그 발생 프로세스. utility process 는 현재 미사용 — 도입 시 확장.
export type LogProcess = 'main' | 'renderer' | 'preload'

// Error 를 파일 로그용으로 보존 직렬화한 형태. IPC 용 평탄화(infra/errors.ts sanitizeCause)와
// 달리 stack·code·cause 체인을 유지한다.
export interface SerializedError {
  name: string
  message: string
  code?: string
  stack?: string
  cause?: SerializedError
}

// 호출자(renderer/preload/main 업무 코드)가 제공하는 입력. 공통 필드(LogRecord 확장분)는
// 호출자가 보내도 무시되고 main 이 강제 부여한다 — 출처/버전 위조 방지.
export interface LogInput {
  level: LogLevel
  event: string
  scope: string
  message?: string
  correlationId?: string
  data?: Record<string, unknown>
  error?: SerializedError
}

// 파일에 기록되는 완성 레코드 (JSONL 1줄 = LogRecord 1개).
export interface LogRecord extends LogInput {
  schemaVersion: 1
  timestamp: string
  process: LogProcess
  appVersion: string
  sessionId: string
  windowId?: number
}

export const LOG_LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug']

// 이벤트 명명 규칙: `<domain>.<operation>.<state>` — 소문자 시작 세그먼트 2~5개, 점 구분.
// 예: app.start.completed · db.migration.failed · chat.turn.started
export const LOG_EVENT_PATTERN = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){1,4}$/

export const LOG_SCOPE_MAX_LENGTH = 64
// 단일 문자열 필드 상한 (redaction 단계에서 절단).
export const LOG_STRING_MAX_LENGTH = 8 * 1024
// renderer→main 단일 IPC 로그 payload(직렬화 길이) 상한 — 초과분은 전송/수신 모두 폐기.
export const LOG_IPC_PAYLOAD_MAX_BYTES = 32 * 1024
