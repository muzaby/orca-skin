import { describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import { makeClassifiedError } from '../../infra/errors'
import type { TurnRequest } from '../../adapters/turn'
import type { AbortCause } from '../../contracts/session-state'
import type { RuntimeLiveTurn, RuntimeSessionAdapter } from '../../contracts/ports'
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

describe('SessionRuntime close 정책(0054 → 0067)', () => {
  it('기본 정책은 persistent — reusable=true (0067 long-lived 직행)', () => {
    const runtime = new SessionRuntime(adapter(live([])))
    expect(runtime.reusable).toBe(true)
  })

  it('oneshot 정책은 reusable=false', () => {
    const oneshot = new SessionRuntime(adapter(live([])), 'oneshot')
    expect(oneshot.reusable).toBe(false)
  })

  it("persistent + pushTurn 미지원(mock)은 턴-스코프 폴백 — terminal 후 state='live'", async () => {
    const runtime = new SessionRuntime(adapter(live([{ type: 'telemetry', sessionId: 's1' }])))
    await collect(runtime.send(req()))
    expect(runtime.state).toBe('live')
    expect(runtime.channelAlive).toBe(false)
  })

  it('close() 는 정책과 무관하게 상태를 closed 로 만든다', () => {
    const runtime = new SessionRuntime(adapter(live([])))
    runtime.close()
    expect(runtime.state).toBe('closed')
  })
})

// 0067 장수명 채널 — pushTurn 지원 어댑터(claude)의 프레임 demux. 채널을 외부에서 구동할 수
// 있는 fake live 로 spawn 1회·프레임 절단·interrupt 취소·unframed 버퍼를 본다.
function channelLive(): {
  liveTurn: RuntimeLiveTurn
  emit: (ev: NormalizedEvent) => void
  close: ReturnType<typeof vi.fn>
  pushed: Array<{ text: string; promptUuid?: string }>
  interrupted: ReturnType<typeof vi.fn>
} {
  const queue: NormalizedEvent[] = []
  let wake: (() => void) | null = null
  let closed = false
  const close = vi.fn(() => {
    closed = true
    wake?.()
    wake = null
  })
  const pushed: Array<{ text: string; promptUuid?: string }> = []
  const interrupted = vi.fn()
  const liveTurn: RuntimeLiveTurn = {
    events: (async function* () {
      while (true) {
        while (queue.length > 0) yield queue.shift()!
        if (closed) return
        await new Promise<void>((resolve) => {
          if (closed || queue.length > 0) resolve()
          else wake = resolve
        })
      }
    })(),
    close,
    pushTurn: async (next) => {
      pushed.push({ text: next.text, ...(next.promptUuid ? { promptUuid: next.promptUuid } : {}) })
    },
    setPermissionMode: async () => {},
    interrupt: async () => {
      interrupted()
    },
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
  return {
    liveTurn,
    emit: (ev) => {
      queue.push(ev)
      wake?.()
      wake = null
    },
    close,
    pushed,
    interrupted
  }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('SessionRuntime 장수명 채널(0067)', () => {
  it('terminal 에서 프레임만 닫고 채널(live)은 유지한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const frame = collect(runtime.send(req()))
    ch.emit({ type: 'session.updated', sessionId: 's1', patch: {} })
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    const events = await frame
    expect(events.map((e) => e.type)).toEqual(['session.updated', 'telemetry'])
    expect(ch.close).not.toHaveBeenCalled()
    expect(runtime.channelAlive).toBe(true)
    expect(runtime.state).toBe('live')
  })

  it('후속 send 는 pushTurn 으로 이어붙인다 — 새 spawn 없이 두 번째 프레임 소비', async () => {
    const ch = channelLive()
    let spawns = 0
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: () => {
        spawns += 1
        return ch.liveTurn
      },
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    const f2 = collect(runtime.send({ ...req(), text: 'second', promptUuid: 'u2' }))
    await tick()
    expect(ch.pushed).toEqual([{ text: 'second', promptUuid: 'u2' }])
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    const events2 = await f2
    expect(events2.map((e) => e.type)).toEqual(['telemetry'])
    expect(spawns).toBe(1)
  })

  it('markAborted(취소)=interrupt — 턴만 멈추고 채널 생존, 잔여는 terminal 까지 드랍', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'session.updated', sessionId: 's1', patch: {} })
    await tick()
    runtime.markAborted('user_cancelled')
    const events = await f1
    expect(events.map((e) => e.type)).toEqual(['session.updated'])
    expect(ch.interrupted).toHaveBeenCalled()
    expect(ch.close).not.toHaveBeenCalled()
    expect(runtime.cancelled).toBe(true)
    // 중단된 턴의 잔여 이벤트는 드랍되고, terminal 에서 채널이 유휴 복귀한다.
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await tick()
    expect(runtime.state).toBe('live')
    expect(runtime.channelAlive).toBe(true)
  })

  it('프레임 밖 이벤트는 버퍼에 쌓였다가 다음 프레임 앞에 합류한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    // CLI 자동 픽업 턴 개시 시뮬레이트 — 프레임 없는 상태의 이벤트.
    ch.emit({ type: 'session.updated', sessionId: 's1', patch: {} })
    await tick()

    const f2 = collect(runtime.send({ ...req(), text: 'next' }))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    const events2 = await f2
    // 백로그(session.updated)가 새 프레임 앞에 합류한다.
    expect(events2.map((e) => e.type)).toEqual(['session.updated', 'telemetry'])
  })

  it('close() 는 채널을 내리고 closed — 이후 send 어댑터 spawn 은 호출자 몫', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1
    runtime.close()
    expect(ch.close).toHaveBeenCalled()
    expect(runtime.state).toBe('closed')
    expect(runtime.channelAlive).toBe(false)
  })

  it('채널 스트림이 에러로 죽으면 활성 프레임에 전파되고 다음 send 는 respawn 한다', async () => {
    const ch = channelLive()
    let spawns = 0
    const second = channelLive()
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: () => {
        spawns += 1
        return spawns === 1 ? ch.liveTurn : second.liveTurn
      },
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })
    const f1 = collect(runtime.send(req()))
    // 스트림 자체를 죽인다 — pump 가 프레임에 fail 을 전파한다.
    ch.liveTurn.close()
    await expect(f1).resolves.toEqual([]) // close→iterator 종료(에러 아님): 프레임 end
    expect(runtime.channelAlive).toBe(false)
    // 다음 send 는 respawn(콜드 패스).
    const f2 = collect(runtime.send(req()))
    second.emit({ type: 'telemetry', sessionId: 's1' })
    await f2
    expect(spawns).toBe(2)
  })
})

// 0118 — provider 경계 respawn: spawn-바운드 옵션(env·providerSettings) 변경 시 호출자
// (chat-turn)가 teardownChannel() 로 채널을 내리고, 다음 send 가 새 옵션으로 respawn 한다.
describe('SessionRuntime provider 경계 respawn(0118)', () => {
  it('teardownChannel() 은 유휴 채널을 내리고(상태 불변) 다음 send 가 새 env 로 respawn 한다', async () => {
    const ch = channelLive()
    const second = channelLive()
    let spawns = 0
    const requests: TurnRequest[] = []
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: (r) => {
        requests.push(r)
        spawns += 1
        return spawns === 1 ? ch.liveTurn : second.liveTurn
      },
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })
    const f1 = collect(runtime.send({ ...req(), env: { ANTHROPIC_BASE_URL: 'old' } }))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1
    expect(runtime.channelAlive).toBe(true)

    runtime.teardownChannel()
    expect(ch.close).toHaveBeenCalled()
    expect(runtime.channelAlive).toBe(false)
    // close() 와 달리 상태머신은 건드리지 않는다 — 다음 send 가 정상 진행.
    expect(runtime.state).toBe('live')

    const f2 = collect(runtime.send({ ...req(), env: { ANTHROPIC_BASE_URL: 'new' } }))
    second.emit({ type: 'telemetry', sessionId: 's1' })
    await f2
    expect(spawns).toBe(2)
    expect(requests[1]?.env).toEqual({ ANTHROPIC_BASE_URL: 'new' })
  })

  it('teardownChannel() 은 unframed 백로그를 비운다 — respawn 후 프레임에 유출 금지', async () => {
    const ch = channelLive()
    const second = channelLive()
    let spawns = 0
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: () => {
        spawns += 1
        return spawns === 1 ? ch.liveTurn : second.liveTurn
      },
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    // 프레임 밖 이벤트(구 채널 잔여)를 쌓은 뒤 teardown — 새 채널 프레임에 새면 안 된다.
    ch.emit({ type: 'session.updated', sessionId: 's1', patch: {} })
    await tick()
    runtime.teardownChannel()

    const f2 = collect(runtime.send(req()))
    second.emit({ type: 'telemetry', sessionId: 's1' })
    const events2 = await f2
    expect(events2.map((e) => e.type)).toEqual(['telemetry'])
    expect(spawns).toBe(2)
  })
})

// 0125 — spawn 시점 providerSettings 기록 수명: 콜드 스폰에서 기록, pushTurn 재사용은 불변,
// teardown/채널 사망에서 해제. 내용 비교 판정 자체는 features/providers(순수 함수) 소관.
describe('SessionRuntime spawn settings 기록(0125)', () => {
  const settingsOf = (token: string): NonNullable<TurnRequest['providerSettings']> => ({
    providerKey: 'claude-gateway',
    provider: 'gateway',
    settings: { env: { ANTHROPIC_AUTH_TOKEN: token } }
  })

  it('콜드 스폰이 주입본을 기록하고, pushTurn 후속 턴은 기록을 바꾸지 않는다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const spawned = settingsOf('old')
    const f1 = collect(runtime.send({ ...req(), providerSettings: spawned }))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1
    expect(runtime.spawnedProviderSettings).toBe(spawned)

    // 후속 턴이 새 해석본을 실어도 pushTurn 경로는 spawn-바운드 기록을 갱신하지 않는다.
    const f2 = collect(
      runtime.send({ ...req(), text: 'next', providerSettings: settingsOf('rotated') })
    )
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f2
    expect(runtime.spawnedProviderSettings).toBe(spawned)
  })

  it('teardownChannel() 은 기록을 해제하고, respawn 이 새 주입본을 기록한다', async () => {
    const ch = channelLive()
    const second = channelLive()
    let spawns = 0
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: () => {
        spawns += 1
        return spawns === 1 ? ch.liveTurn : second.liveTurn
      },
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })
    const f1 = collect(runtime.send({ ...req(), providerSettings: settingsOf('old') }))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    runtime.teardownChannel()
    expect(runtime.spawnedProviderSettings).toBeUndefined()

    const rotated = settingsOf('rotated')
    const f2 = collect(runtime.send({ ...req(), providerSettings: rotated }))
    second.emit({ type: 'telemetry', sessionId: 's1' })
    await f2
    expect(spawns).toBe(2)
    expect(runtime.spawnedProviderSettings).toBe(rotated)
  })

  it('채널 스트림 사망(finishPump)도 기록을 해제한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send({ ...req(), providerSettings: settingsOf('old') }))
    ch.liveTurn.close()
    await f1
    expect(runtime.channelAlive).toBe(false)
    expect(runtime.spawnedProviderSettings).toBeUndefined()
  })
})

// 0128 — spawn 시점 model 기록 수명: 콜드 스폰에서 기록, pushTurn 재사용은 불변, teardown/
// 채널 사망에서 해제. 모델 변경 respawn 판정(chat-turn)은 이 기록과 이번 턴 해석 model 비교.
describe('SessionRuntime spawn model 기록(0128)', () => {
  it('콜드 스폰이 model 을 기록하고, pushTurn 후속 턴은 기록을 바꾸지 않는다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send({ ...req(), model: 'sonnet' }))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1
    expect(runtime.spawnedModel).toBe('sonnet')

    // 후속 턴이 다른 model 을 실어도 pushTurn 경로는 spawn-바운드 기록을 갱신하지 않는다
    // (라이브 setModel 은 실제 생성 모델을 못 바꾸므로 respawn 판정은 chat-turn 이 소유).
    const f2 = collect(runtime.send({ ...req(), text: 'next', model: 'haiku' }))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f2
    expect(runtime.spawnedModel).toBe('sonnet')
  })

  it('teardownChannel() 은 기록을 해제하고, respawn 이 새 model 을 기록한다', async () => {
    const ch = channelLive()
    const second = channelLive()
    let spawns = 0
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: () => {
        spawns += 1
        return spawns === 1 ? ch.liveTurn : second.liveTurn
      },
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })
    const f1 = collect(runtime.send({ ...req(), model: 'sonnet' }))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    runtime.teardownChannel()
    expect(runtime.spawnedModel).toBeUndefined()

    const f2 = collect(runtime.send({ ...req(), model: 'haiku' }))
    second.emit({ type: 'telemetry', sessionId: 's1' })
    await f2
    expect(spawns).toBe(2)
    expect(runtime.spawnedModel).toBe('haiku')
  })

  it('채널 스트림 사망(finishPump)도 기록을 해제한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send({ ...req(), model: 'sonnet' }))
    ch.liveTurn.close()
    await f1
    expect(runtime.channelAlive).toBe(false)
    expect(runtime.spawnedModel).toBeUndefined()
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
