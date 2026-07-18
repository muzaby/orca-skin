import { describe, expect, it } from 'vitest'
import type { LogRecord } from '../../../shared/logging'
import { runWithLogContext } from './log-context'
import { LogManager, type LogSource } from './log-manager'
import { RepeatSuppressor } from './suppress'
import type { LogTransport } from './file-transport'

const MAIN: LogSource = { process: 'main' }

function collector(): { lines: string[]; transport: LogTransport } {
  const lines: string[] = []
  return {
    lines,
    transport: { write: (line) => lines.push(line), flushSync: () => {}, close: () => {} }
  }
}

function manager(opts: Partial<ConstructorParameters<typeof LogManager>[0]> = {}): {
  m: LogManager
  lines: string[]
} {
  const { lines, transport } = collector()
  const m = new LogManager({
    transport,
    appVersion: '9.9.9',
    sessionId: 'session-1',
    dev: true,
    now: () => new Date('2026-07-18T05:00:00.000Z'),
    ...opts
  })
  return { m, lines }
}

function parse(line: string): LogRecord {
  return JSON.parse(line) as LogRecord
}

describe('LogManager.enrich (공통 필드 강제 부여)', () => {
  it('schemaVersion/timestamp/process/appVersion/sessionId/windowId 를 main 이 부여한다', () => {
    const { m, lines } = manager()
    m.emit(
      { level: 'info', event: 'app.start.completed', scope: 'app' },
      { process: 'renderer', windowId: 7 }
    )
    const rec = parse(lines[0])
    expect(rec.schemaVersion).toBe(1)
    expect(rec.timestamp).toBe('2026-07-18T05:00:00.000Z')
    expect(rec.process).toBe('renderer')
    expect(rec.appVersion).toBe('9.9.9')
    expect(rec.sessionId).toBe('session-1')
    expect(rec.windowId).toBe(7)
  })

  it('AsyncLocalStorage 컨텍스트의 correlationId 를 자동 주입한다', () => {
    const { m, lines } = manager()
    runWithLogContext({ correlationId: 'corr-42' }, () => {
      m.emit({ level: 'info', event: 'chat.turn.started', scope: 'chat' }, MAIN)
    })
    expect(parse(lines[0]).correlationId).toBe('corr-42')
  })

  it('명시 correlationId 가 컨텍스트보다 우선한다', () => {
    const { m, lines } = manager()
    runWithLogContext({ correlationId: 'ambient' }, () => {
      m.emit(
        { level: 'info', event: 'chat.turn.started', scope: 'chat', correlationId: 'explicit' },
        MAIN
      )
    })
    expect(parse(lines[0]).correlationId).toBe('explicit')
  })
})

describe('레벨 정책 (dev/prod)', () => {
  it('prod(dev:false) 는 debug 를 기록하지 않는다', () => {
    const { m, lines } = manager({ dev: false })
    m.emit({ level: 'debug', event: 'x.y.z', scope: 's' }, MAIN)
    m.emit({ level: 'info', event: 'x.y.z', scope: 's' }, MAIN)
    expect(lines.length).toBe(1)
    expect(parse(lines[0]).level).toBe('info')
  })

  it('dev(dev:true) 는 debug 까지 기록한다', () => {
    const { m, lines } = manager({ dev: true })
    m.emit({ level: 'debug', event: 'x.y.z', scope: 's' }, MAIN)
    expect(lines.length).toBe(1)
  })
})

describe('redaction 통합 (파일 기록 직전)', () => {
  it('data 의 토큰/키가 파일 라인에 남지 않는다', () => {
    const { m, lines } = manager()
    m.emit(
      {
        level: 'error',
        event: 'llm.request.failed',
        scope: 'llm',
        data: { apiKey: 'sk-ant-secret-value-123456', note: 'auth was Bearer abcdef1234567890' },
        error: { name: 'E', message: 'Authorization: Bearer abcdef1234567890' }
      },
      MAIN
    )
    expect(lines.length).toBe(1)
    expect(lines[0]).not.toContain('sk-ant-secret-value-123456')
    expect(lines[0]).not.toContain('abcdef1234567890')
    expect(lines[0]).toContain('[REDACTED]')
  })
})

describe('반복 억제 통합', () => {
  it('동일 오류 반복은 drop 되고 창 만료 시 suppressedCount 집계가 실린다', () => {
    let now = 0
    const { lines, transport } = collector()
    const m = new LogManager({
      transport,
      appVersion: '1',
      sessionId: 's',
      dev: true,
      now: () => new Date(now),
      // suppressor 도 같은 가짜 시계를 봐야 창 만료가 결정론적이다.
      suppressor: new RepeatSuppressor(60_000, () => now)
    })
    const input = {
      level: 'error' as const,
      event: 'llm.stream.failed',
      scope: 'llm',
      error: { name: 'TimeoutError', message: 't', code: 'MODEL_TIMEOUT' }
    }
    m.emit(input, MAIN)
    now = 1000
    m.emit(input, MAIN)
    now = 2000
    m.emit(input, MAIN)
    expect(lines.length).toBe(1)
    now = 61_000
    m.emit(input, MAIN)
    expect(lines.length).toBe(2)
    const summary = parse(lines[1])
    expect(summary.data?.suppressedCount).toBe(2)
    expect(summary.data?.fingerprint).toBe('llm.stream.failed|TimeoutError|MODEL_TIMEOUT')
  })
})

describe('emit 무예외 불변식', () => {
  it('transport throw 가 호출자에게 전파되지 않고 emergency 1회만 보고된다', () => {
    const failures: string[] = []
    const m = new LogManager({
      transport: {
        write: () => {
          throw new Error('disk exploded')
        },
        flushSync: () => {},
        close: () => {}
      },
      appVersion: '1',
      sessionId: 's',
      dev: true,
      onInternalError: (msg) => failures.push(msg)
    })
    expect(() => {
      m.emit({ level: 'info', event: 'a.b.c', scope: 's' }, MAIN)
      m.emit({ level: 'info', event: 'a.b.c', scope: 's' }, MAIN)
    }).not.toThrow()
    expect(failures.length).toBe(1)
  })

  it('직렬화 불가 data(BigInt) 도 throw 없이 삼켜진다', () => {
    const { m } = manager()
    expect(() =>
      m.emit({ level: 'info', event: 'a.b.c', scope: 's', data: { big: BigInt(1) } }, MAIN)
    ).not.toThrow()
  })
})

describe('logger facade', () => {
  it('child(scope) 가 점 연결 scope 로 emit 하고 error 인자를 직렬화한다', () => {
    const { m, lines } = manager()
    const log = m.logger('main', MAIN).child('updater')
    log.error('update.check.failed', new Error('net down'), { retry: 1 })
    const rec = parse(lines[0])
    expect(rec.scope).toBe('main.updater')
    expect(rec.level).toBe('error')
    expect(rec.error?.name).toBe('Error')
    expect(rec.error?.message).toBe('net down')
    expect(rec.data).toEqual({ retry: 1 })
  })
})

describe('console mirror runtime gate (0124 AC12)', () => {
  it('기본 OFF — 미러가 주입돼 있어도 게이트 전에는 콘솔 미러가 발화하지 않는다', () => {
    const mirrored: LogRecord[] = []
    const { m, lines } = manager({ consoleMirror: (rec) => mirrored.push(rec) })
    m.emit({ level: 'info', event: 'app.start.completed', scope: 'app' }, MAIN)
    expect(lines).toHaveLength(1) // 파일 기록은 게이트와 무관하게 불변
    expect(mirrored).toHaveLength(0)
  })

  it('게이트 ON 이면 파일과 동일 레코드를 미러하고, OFF 로 되돌리면 다시 침묵한다', () => {
    const mirrored: LogRecord[] = []
    const { m, lines } = manager({ consoleMirror: (rec) => mirrored.push(rec) })
    m.setConsoleMirrorEnabled(true)
    m.emit({ level: 'info', event: 'app.start.completed', scope: 'app' }, MAIN)
    expect(mirrored).toHaveLength(1)
    expect(mirrored[0]).toEqual(parse(lines[0]))
    m.setConsoleMirrorEnabled(false)
    m.emit({ level: 'info', event: 'app.quit.started', scope: 'app' }, MAIN)
    expect(lines).toHaveLength(2)
    expect(mirrored).toHaveLength(1)
  })
})
