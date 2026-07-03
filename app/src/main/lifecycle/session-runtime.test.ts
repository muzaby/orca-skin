import { describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../shared/ipc'
import { makeClassifiedError } from '../infra/errors'
import type { TurnRequest } from '../extensions/types'
import type { AbortCause } from './session-state'
import type { RuntimeLiveTurn, RuntimeSessionAdapter } from './ports'
import { SessionRuntime } from './session-runtime'

function req(): TurnRequest {
  return {
    sessionId: 's1',
    text: 'hi',
    cwd: '/w',
    extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
  }
}

function live(events: NormalizedEvent[], close = vi.fn()): RuntimeLiveTurn {
  return {
    events: (async function* () {
      for (const ev of events) yield ev
    })(),
    close,
    setPermissionMode: async () => {},
    interrupt: async () => {},
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
}

function adapter(turn: RuntimeLiveTurn): RuntimeSessionAdapter {
  return {
    id: 'claude',
    complete: async () => '',
    sendMessage: () => turn,
    classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
  }
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const item of iterable) out.push(item)
  return out
}

describe('SessionRuntime', () => {
  it('closes the live turn when a terminal event is observed', async () => {
    const close = vi.fn()
    const runtime = new SessionRuntime(
      adapter(live([{ type: 'telemetry', sessionId: 's1' }], close))
    )
    await collect(runtime.send(req()))
    expect(close).toHaveBeenCalled()
    expect(runtime.state).toBe('live')
  })

  it('keeps retry ownership outside by allowing another send after an empty failed attempt', async () => {
    let calls = 0
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: () => {
        calls += 1
        if (calls === 1) throw new Error('retryable')
        return live([{ type: 'telemetry', sessionId: 's1' }])
      },
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })

    await expect(collect(runtime.send(req()))).rejects.toThrow('retryable')
    await collect(runtime.send(req()))
    expect(calls).toBe(2)
    expect(runtime.state).toBe('live')
  })
})

describe('SessionRuntime close 정책(0054)', () => {
  it('기본 정책은 oneshot — reusable=false', () => {
    const oneshot = new SessionRuntime(adapter(live([])))
    expect(oneshot.reusable).toBe(false)
  })

  it("persistent 정책은 reusable=true — terminal 후 state='live' 유지로 재사용 가능", async () => {
    const runtime = new SessionRuntime(
      adapter(live([{ type: 'telemetry', sessionId: 's1' }])),
      'persistent'
    )
    expect(runtime.reusable).toBe(true)
    await collect(runtime.send(req()))
    expect(runtime.state).toBe('live')
  })

  it('close() 는 정책과 무관하게 상태를 closed 로 만든다', () => {
    const runtime = new SessionRuntime(adapter(live([])), 'persistent')
    runtime.close()
    expect(runtime.state).toBe('closed')
  })
})

// 인수 2·6(c) — 모드-불변 소비자 계약. Persistent 구현(P1) 없이 검증하기 위해,
// 동일 send() 표면에 close 정책만 주입 가능한 FakeSessionRuntime 으로 "소비자가 close 정책에
// 무지함"을 본다 (보강 4). OneShot=terminal 관측 시 self-close, fake-persistent=수명 유지.
function isTerminal(ev: NormalizedEvent): boolean {
  return ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted'
}

type ClosePolicy = 'oneshot' | 'persistent'

class FakeSessionRuntime implements RuntimeLiveTurn {
  readonly closeLog: number[] = []
  private aborted: AbortCause = null
  private emitted = 0

  constructor(
    private readonly script: NormalizedEvent[],
    private readonly policy: ClosePolicy
  ) {}

  // 소비자 표면 — SessionRuntime.send() 와 동일 시그니처.
  async *send(): AsyncIterable<NormalizedEvent> {
    try {
      for (const ev of this.script) {
        this.emitted += 1
        yield ev
        if (this.policy === 'oneshot' && isTerminal(ev)) this.close()
      }
    } finally {
      // OneShot 은 종료 시 멱등 close(백스톱), persistent 는 수명을 유지한다.
      if (this.policy === 'oneshot') this.close()
    }
  }

  // RuntimeLiveTurn 전체 표면 (R3-1 의 stopTask/backgroundTask 포함) — 타입 만족용.
  get events(): AsyncIterable<NormalizedEvent> {
    return this.send()
  }
  close(): void {
    this.closeLog.push(this.emitted)
  }
  setPermissionMode = async (): Promise<void> => {}
  async interrupt(): Promise<void> {
    this.markAborted('user_cancelled')
  }
  setModel = async (): Promise<void> => {}
  stopTask = async (): Promise<void> => {}
  async backgroundTask(): Promise<boolean> {
    return false
  }
  markAborted(cause: Exclude<AbortCause, null>): void {
    this.aborted = cause
  }
  get cancelled(): boolean {
    return this.aborted === 'user_cancelled'
  }
  get timedOut(): boolean {
    return this.aborted === 'stall'
  }
}

// send.ts 소비 루프의 순수 모델 — close 정책을 분기하지 않고 send() 스트림만 본다.
// 실제 consumer(persist·sendChatEvent·promote)가 의존하는 것은 이벤트 순서뿐임을 고정한다.
async function consume(runtime: { send: () => AsyncIterable<NormalizedEvent> }): Promise<{
  seen: string[]
  persisted: NormalizedEvent[]
}> {
  const seen: string[] = []
  const persisted: NormalizedEvent[] = []
  for await (const ev of runtime.send()) {
    seen.push(ev.type)
    persisted.push(ev)
  }
  return { seen, persisted }
}

describe('SessionRuntime mode-invariance (인수 2·6c)', () => {
  const script: NormalizedEvent[] = [
    { type: 'session.updated', sessionId: 's1' } as NormalizedEvent,
    { type: 'telemetry', sessionId: 's1' }
  ]

  it('consumer output is identical across close policies', async () => {
    const oneshot = await consume(new FakeSessionRuntime([...script], 'oneshot'))
    const persistent = await consume(new FakeSessionRuntime([...script], 'persistent'))
    expect(oneshot.seen).toEqual(['session.updated', 'telemetry'])
    expect(oneshot.seen).toEqual(persistent.seen)
    expect(oneshot.persisted).toEqual(persistent.persisted)
  })

  it('close policy difference is internal only (OneShot self-closes, persistent stays open)', async () => {
    const oneshot = new FakeSessionRuntime([...script], 'oneshot')
    const persistent = new FakeSessionRuntime([...script], 'persistent')
    await consume(oneshot)
    await consume(persistent)
    // OneShot 은 terminal 관측 시 close(소비자 무관), persistent 는 close 하지 않는다.
    expect(oneshot.closeLog.length).toBeGreaterThan(0)
    expect(persistent.closeLog).toEqual([])
  })
})
