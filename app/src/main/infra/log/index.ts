// 로깅 싱글턴 진입점 (0123 AC2) — infra/db 의 initDb/closeDb 패턴을 따른다.
// electron 값(앱 버전·DEV)은 여기서만 읽어 LogManager 에 주입한다 —
// 나머지 log 모듈은 electron 비의존(순수 vitest 대상)을 유지한다.
// 파일 위치는 ~/.config/orcinus-orca/logs/ (홈 디렉토리 고정) — dev/prod 공통 디렉토리를 쓴다.
// 루트 조립은 `infra/config/paths` 의 `ooConfigDir()` 하나가 소유한다 — 0225 이전에는 여기서
// 독립 하드코딩해 설정 루트 정의가 둘이었고, 한쪽만 고치면 로그가 옛 루트에 남는다.

import { join } from 'path'
import { randomUUID } from 'crypto'
import { ooConfigDir } from '../config/paths'
import type { LogInput, LogRecord } from '../../../shared/logging'
import { FileTransport } from './file-transport'
import { LogManager, type AppLogger, type LogSource } from './log-manager'
import { setRootLogger } from './registry'
import { hostEnvironment } from '../host-environment'

export type { AppLogger, LogSource } from './log-manager'
export { runWithLogContext, currentCorrelationId, type LogContext } from './log-context'
export { serializeError } from './serialize-error'
export { getLogger } from './registry'

let manager: LogManager | null = null
let rootLogger: AppLogger | null = null

// 프로세스마다 자기 파일에 쓴다(0324 AC46) — 한 파일을 여러 프로세스가 돌려 쓰면 로테이션이 서로를
// 덮는다. 셸은 예전 이름을 그대로 쓴다.
export type LogHostProcess = 'main' | 'agent-host' | 'data-host'
const LOG_BASE_NAMES: Record<LogHostProcess, string> = {
  main: 'application.jsonl',
  'agent-host': 'agent-host.jsonl',
  'data-host': 'data-host.jsonl'
}

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

export function initLog(process: LogHostProcess = 'main'): AppLogger {
  if (rootLogger) return rootLogger
  const transport = new FileTransport({
    dir: logDirectory(),
    baseName: LOG_BASE_NAMES[process],
    onInternalError: emergency
  })
  manager = new LogManager({
    transport,
    appVersion: hostEnvironment().appVersion,
    sessionId: randomUUID(),
    dev: import.meta.env.DEV,
    consoleMirror: import.meta.env.DEV ? mirrorToConsole : undefined,
    onInternalError: emergency
  })
  rootLogger = manager.logger(process, { process })
  setRootLogger(rootLogger)
  return rootLogger
}

// dev 콘솔 미러 런타임 게이트 (0124 AC12) — 디버그 패널 "로그" 스위치가 wire 기록과 함께
// 통합 제어한다. 기본 OFF(스위치 기본값과 일치) — 파일 기록 정책은 불변, 콘솔 출력만 게이트.
export function setConsoleMirror(on: boolean): void {
  manager?.setConsoleMirrorEnabled(on)
}

// orcinus-orca.json debug 스위치 런타임 반영 (0144) — 부팅 시 loadOoConfig() 후 컴포지션 루트가 호출.
// true 면 prod 파일 레벨을 info→debug 로 올린다(dev 는 항상 debug 라 무영향).
export function setLogDebug(on: boolean): void {
  manager?.setDebugEnabled(on)
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

// 모든 프로세스의 로그 파일이 모이는 폴더.
export function logDirectory(): string {
  return join(ooConfigDir(), 'logs')
}

export function closeLog(): void {
  manager?.close()
  manager = null
  rootLogger = null
  setRootLogger(null)
}
