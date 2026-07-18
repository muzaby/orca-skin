// 중앙 LogManager (0123 AC2·AC3·AC10) — 모든 프로세스의 로그가 이 단일 파이프라인을 지난다:
//   enrich(공통 필드 강제 부여) → suppress(반복 억제) → redact(마스킹) → serialize → transport.
// 불변식: emit 은 어떤 내부 실패에도 호출자에게 throw 하지 않는다. 내부 오류는 주입된
// emergency 채널(콘솔 1줄)로만 보고하고, 로거가 로거를 재귀 호출하지 않는다.
// electron 값(appVersion·경로·DEV)은 생성자 주입 — 본 모듈은 electron 비의존 → vitest 대상.

import type { LogInput, LogLevel, LogProcess, LogRecord } from '../../../shared/logging'
import { currentCorrelationId } from './log-context'
import { redactRecord } from './redact'
import { serializeError } from './serialize-error'
import { RepeatSuppressor, fingerprintOf } from './suppress'
import type { LogTransport } from './file-transport'

// 업무 코드가 쓰는 유일한 표면 (Logger Facade). error 만 error 인자를 받는다.
export interface AppLogger {
  debug(event: string, data?: Record<string, unknown>): void
  info(event: string, data?: Record<string, unknown>): void
  warn(event: string, data?: Record<string, unknown>): void
  error(event: string, error?: unknown, data?: Record<string, unknown>): void
  child(scope: string): AppLogger
}

export interface LogSource {
  process: LogProcess
  windowId?: number
}

export interface LogManagerOptions {
  transport: LogTransport
  appVersion: string
  sessionId: string
  // dev=true 면 debug 까지 기록, false(prod) 면 info 이상만 (AC10).
  dev: boolean
  // dev 콘솔 미러 — 호출측(컴포지션)이 주입. prod 에선 미주입. 발화 여부는 런타임 게이트
  // (setConsoleMirrorEnabled — 디버그 패널 "로그" 스위치, 0124 AC12)가 추가로 제어한다.
  consoleMirror?: (record: LogRecord) => void
  suppressor?: RepeatSuppressor
  onInternalError?: (message: string) => void
  now?: () => Date
}

const LEVEL_RANK: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }

export class LogManager {
  private readonly transport: LogTransport
  private readonly appVersion: string
  private readonly sessionId: string
  private readonly minRank: number
  private readonly consoleMirror?: (record: LogRecord) => void
  private readonly suppressor: RepeatSuppressor
  private readonly onInternalError: (message: string) => void
  private readonly now: () => Date
  private internalErrorReported = false
  // 콘솔 미러 런타임 게이트 — 기본 OFF(스위치 전까지 콘솔 침묵, 파일 기록은 불변).
  private consoleMirrorEnabled = false

  constructor(options: LogManagerOptions) {
    this.transport = options.transport
    this.appVersion = options.appVersion
    this.sessionId = options.sessionId
    this.minRank = LEVEL_RANK[options.dev ? 'debug' : 'info']
    this.consoleMirror = options.consoleMirror
    this.suppressor = options.suppressor ?? new RepeatSuppressor()
    this.onInternalError = options.onInternalError ?? (() => {})
    this.now = options.now ?? (() => new Date())
  }

  setConsoleMirrorEnabled(on: boolean): void {
    this.consoleMirrorEnabled = on
  }

  emit(input: LogInput, source: LogSource): void {
    try {
      if (LEVEL_RANK[input.level] > this.minRank) return
      const record = this.enrich(input, source)
      const decision = this.suppressor.check(record)
      if (decision.action === 'drop') return
      const redacted = redactRecord(record)
      if (decision.action === 'summary') {
        this.writeRecord({
          ...redacted,
          data: {
            ...redacted.data,
            fingerprint: fingerprintOf(record),
            suppressedCount: decision.suppressedCount,
            windowMs: decision.windowMs
          }
        })
        return
      }
      this.writeRecord(redacted)
    } catch (err) {
      // 로거 내부 오류는 앱으로 전파하지 않는다 — emergency 1회성 보고만 (AC3).
      if (!this.internalErrorReported) {
        this.internalErrorReported = true
        this.onInternalError(`log emit failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  logger(scope: string, source: LogSource): AppLogger {
    const make = (currentScope: string): AppLogger => ({
      debug: (event, data) =>
        this.emit({ level: 'debug', event, scope: currentScope, data }, source),
      info: (event, data) => this.emit({ level: 'info', event, scope: currentScope, data }, source),
      warn: (event, data) => this.emit({ level: 'warn', event, scope: currentScope, data }, source),
      error: (event, error, data) =>
        this.emit(
          {
            level: 'error',
            event,
            scope: currentScope,
            error: error === undefined ? undefined : serializeError(error),
            data
          },
          source
        ),
      child: (childScope) => make(`${currentScope}.${childScope}`)
    })
    return make(scope)
  }

  flushSync(): void {
    try {
      this.transport.flushSync()
    } catch {
      // flush 실패도 전파 금지.
    }
  }

  close(): void {
    try {
      this.transport.close()
    } catch {
      // close 실패도 전파 금지.
    }
  }

  // 공통 필드는 여기서만 부여한다 — 호출자(특히 renderer)가 보낸 값은 신뢰하지 않는다 (AC2·AC7).
  private enrich(input: LogInput, source: LogSource): LogRecord {
    return {
      ...input,
      schemaVersion: 1,
      timestamp: this.now().toISOString(),
      process: source.process,
      appVersion: this.appVersion,
      sessionId: this.sessionId,
      windowId: source.windowId,
      correlationId: input.correlationId ?? currentCorrelationId()
    }
  }

  private writeRecord(record: LogRecord): void {
    this.transport.write(JSON.stringify(record))
    if (this.consoleMirrorEnabled) this.consoleMirror?.(record)
  }
}
