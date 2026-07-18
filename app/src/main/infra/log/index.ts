// 로깅 싱글턴 진입점 (0123 AC2) — infra/db 의 initDb/closeDb 패턴을 따른다.
// electron 값(앱 버전·DEV)은 여기서만 읽어 LogManager 에 주입한다 —
// 나머지 log 모듈은 electron 비의존(순수 vitest 대상)을 유지한다.
// 파일 위치는 ~/.config/orca/logs/ (홈 디렉토리 고정) — dev/prod 공통 디렉토리를 쓴다.

import { app } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { LogInput, LogRecord } from '../../../shared/logging'
import { FileTransport } from './file-transport'
import { LogManager, type AppLogger, type LogSource } from './log-manager'
import { setRootLogger } from './registry'

export type { AppLogger, LogSource } from './log-manager'
export { runWithLogContext, currentCorrelationId, type LogContext } from './log-context'
export { serializeError } from './serialize-error'
export { getLogger } from './registry'

let manager: LogManager | null = null
let transport: FileTransport | null = null
let rootLogger: AppLogger | null = null

const MAIN_SOURCE: LogSource = { process: 'main' }

// 로거 내부 장애 보고 전용 emergency 채널 — 로거 재귀 호출 금지 불변식의 유일한 콘솔 출구.
function emergency(message: string): void {
  console.error('[log]', message)
}

// dev 콘솔 미러 — 파일과 동일 레코드를 사람이 읽기 좋게 한 줄로. prod 에선 주입되지 않아
// dead-code 제거된다(import.meta.env.DEV 인라인 가드, security.md §1.7 선례).
function mirrorToConsole(record: LogRecord): void {
  const suffix: Record<string, unknown> = {}
  if (record.message !== undefined) suffix.message = record.message
  if (record.data !== undefined) suffix.data = record.data
  if (record.error !== undefined) suffix.error = record.error
  if (record.correlationId !== undefined) suffix.correlationId = record.correlationId
  console.log(
    `[log:${record.level}] (${record.process}) ${record.event}`,
    Object.keys(suffix).length > 0 ? suffix : ''
  )
}

export function initLog(): AppLogger {
  if (rootLogger) return rootLogger
  const dir = join(homedir(), '.config', 'orca', 'logs')
  transport = new FileTransport({ dir, onInternalError: emergency })
  manager = new LogManager({
    transport,
    appVersion: app.getVersion(),
    sessionId: randomUUID(),
    dev: import.meta.env.DEV,
    consoleMirror: import.meta.env.DEV ? mirrorToConsole : undefined,
    onInternalError: emergency
  })
  rootLogger = manager.logger('main', MAIN_SOURCE)
  setRootLogger(rootLogger)
  return rootLogger
}

// dev 콘솔 미러 런타임 게이트 (0124 AC12) — 디버그 패널 "로그" 스위치가 wire 기록과 함께
// 통합 제어한다. 기본 OFF(스위치 기본값과 일치) — 파일 기록 정책은 불변, 콘솔 출력만 게이트.
export function setConsoleMirror(on: boolean): void {
  manager?.setConsoleMirrorEnabled(on)
}

// renderer/preload 발 로그 인제스트 (app/handlers/log.ts 전용) — 검증된 LogInput 만 받는다.
// 공통 필드는 LogManager.enrich 가 source 기반으로 강제 부여한다.
export function emitIngestedLog(input: LogInput, source: LogSource): void {
  manager?.emit(input, source)
}

// fatal 경로(uncaughtException 등)에서 버퍼 유실 방지 (AC8·AC9).
export function flushLogSync(): void {
  manager?.flushSync()
}

export function closeLog(): void {
  manager?.close()
  manager = null
  transport = null
  rootLogger = null
  setRootLogger(null)
}
