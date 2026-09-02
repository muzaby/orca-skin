import { describe, expect, it, vi, type Mock } from 'vitest'
import type { DiffRequirementAnchor, NormalizedEvent } from '../../../shared/ipc'
import { makeClassifiedError } from '../../infra/errors'
import type { TurnRequest } from '../../adapters/turn'
import type { AbortCause } from '../../contracts/session-state'
import type { GovernedLiveTurn, RuntimeSessionAdapter } from '../../contracts/ports'
import type { ClaudePermissionMode } from '../../../shared/permission-mode'
import type { LiveTurn, ProviderMessageBatch } from '../../adapters/types'
import { SessionRuntime, pickFrameDelegates } from './session-runtime'
import { decideRespawn } from './respawn-policy'

function req(): TurnRequest {
  return {
    sessionId: 's1',
    text: 'hi',
    cwd: '/w',
    extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
  }
}

const requirement = (overrides: Partial<DiffRequirementAnchor> = {}): DiffRequirementAnchor => ({
  sessionId: 'session-1',
  baselineCommit: '3486398aecbc2b97e42d3dba1aae8d13b18d186c',
  filePath: 'app/src/main/adapters/claude.ts',
  oldLine: 10,
  newLine: 12,
  hunkHeader: '@@ -10,2 +12,3 @@',
  contextBefore: ['before'],
  contextAfter: ['after'],
  comment: '요구사항',
  createdAt: 1_725_000_000_000,
  ...overrides
})

function live(events: NormalizedEvent[], close = vi.fn()): LiveTurn {
  return {
    eventBatches: (async function* () {
      let sequence = 0
      for (const event of events) yield { sequence: sequence++, events: [event] }
    })(),
    close,
    setPermissionMode: async () => {},
    interrupt: async () => undefined,
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
}

function adapter(turn: LiveTurn): RuntimeSessionAdapter {
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
  liveTurn: LiveTurn
  emit: (ev: NormalizedEvent) => void
  emitBatch: (events: NormalizedEvent[]) => void
  close: ReturnType<typeof vi.fn>
  pushed: Array<{ text: string; promptUuid?: string; requirements?: DiffRequirementAnchor[] }>
  interrupted: ReturnType<typeof vi.fn>
} {
  const queue: ProviderMessageBatch[] = []
  let nextSequence = 0
  let wake: (() => void) | null = null
  let closed = false
  const close = vi.fn(() => {
    closed = true
    wake?.()
    wake = null
  })
  const pushed: Array<{
    text: string
    promptUuid?: string
    requirements?: DiffRequirementAnchor[]
  }> = []
  const interrupted = vi.fn()
  const liveTurn: LiveTurn = {
    eventBatches: (async function* () {
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
      pushed.push({
        text: next.text,
        ...(next.promptUuid ? { promptUuid: next.promptUuid } : {}),
        ...(next.requirements ? { requirements: next.requirements } : {})
      })
      return { kind: 'accepted' }
    },
    setPermissionMode: async () => {},
    interrupt: async () => {
      interrupted()
      return undefined
    },
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
  return {
    liveTurn,
    emit: (ev) => {
      queue.push({ sequence: nextSequence++, events: [ev] })
      wake?.()
      wake = null
    },
    emitBatch: (events) => {
      queue.push({ sequence: nextSequence++, events })
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

  it('후속 pushTurn 이 requirements 를 누락하지 않는다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const requirements = [requirement()]

    const first = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await first

    const second = collect(
      runtime.send({ ...req(), text: 'next', promptUuid: 'batch-1', requirements })
    )
    await tick()
    expect(ch.pushed).toEqual([{ text: 'next', promptUuid: 'batch-1', requirements }])
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await second
  })

  it('후속 제출은 queue fence를 먼저 통과하고 accepted 뒤에만 commit한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const first = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await first

    const commit = vi.fn(() => true)
    const second = collect(
      runtime.send({
        ...req(),
        text: 'next',
        canSubmitInitial: () => true,
        commitInitialSubmission: commit
      })
    )
    await tick()
    expect(ch.pushed.map((item) => item.text)).toEqual(['next'])
    expect(commit).toHaveBeenCalledTimes(1)
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await second

    await expect(
      collect(
        runtime.send({
          ...req(),
          text: 'stale',
          canSubmitInitial: () => false
        })
      )
    ).rejects.toThrow('submission_stale:before-continuation')
    expect(ch.pushed.map((item) => item.text)).toEqual(['next'])
  })

  it('후속 push가 수용 전에 거절되면 채널을 격리하고 같은 제출을 fresh spawn으로 재시도할 수 있다', async () => {
    const first = channelLive()
    const fresh = channelLive()
    let spawns = 0
    const runtime = new SessionRuntime({
      ...adapter(first.liveTurn),
      sendMessage: () => (spawns++ === 0 ? first.liveTurn : fresh.liveTurn)
    })
    const initial = collect(runtime.send(req()))
    first.emit({ type: 'telemetry', sessionId: 's1' })
    await initial

    first.liveTurn.pushTurn = async () => ({
      kind: 'rejectedBeforeAccept',
      reason: 'stream_closed'
    })
    const commit = vi.fn(() => true)
    const retryableRequest = {
      ...req(),
      text: 'retry-me',
      canSubmitInitial: () => true,
      commitInitialSubmission: commit
    }
    await expect(collect(runtime.send(retryableRequest))).rejects.toThrow(
      'submission_rejected:stream_closed'
    )
    expect(commit).not.toHaveBeenCalled()
    expect(first.close).toHaveBeenCalled()

    const retried = collect(runtime.send(retryableRequest))
    fresh.emit({ type: 'telemetry', sessionId: 's1' })
    await retried
    expect(spawns).toBe(2)
    expect(commit).toHaveBeenCalledTimes(1)
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

  it('provider 실패 result의 terminal 복수 이벤트를 같은 프레임에 모두 배달한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const frame = collect(runtime.send(req()))
    ch.emitBatch([
      { type: 'telemetry', sessionId: 's1' },
      {
        type: 'error',
        sessionId: 's1',
        error: makeClassifiedError('stream_error', 'provider failed', { retryable: false })
      }
    ])
    expect((await frame).map((event) => event.type)).toEqual(['telemetry', 'error'])
    expect(runtime.channelAlive).toBe(true)
  })

  it('취소는 같은 provider 배치에 이미 큐잉된 후속 error도 폐기한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const stream = runtime.send(req())[Symbol.asyncIterator]()
    const first = stream.next()
    ch.emitBatch([
      { type: 'message.delta', sessionId: 's1', delta: { text: 'partial' } },
      {
        type: 'error',
        sessionId: 's1',
        error: makeClassifiedError('stream_error', 'cancelled transport', { retryable: false })
      }
    ])
    expect((await first).value?.type).toBe('message.delta')

    runtime.markAborted('user_cancelled')
    expect(await stream.next()).toEqual({ done: true, value: undefined })
  })

  // 0165 D10 — 취소가 error 만 걷어내고 **나머지는 배달**하는지. 전량 폐기(discard)면 부분 답변의
  // 꼬리가 사라지고 같은 배치의 telemetry 가 버스에 못 올라가 usage 집계가 누락된다.
  it('취소는 아직 소비되지 않은 delta·telemetry 를 버리지 않는다 (error 만 제거)', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const stream = runtime.send(req())[Symbol.asyncIterator]()

    ch.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'A' } })
    const first = await stream.next()
    expect((first.value as { delta: { text: string } }).delta.text).toBe('A')

    // 소비자가 next() 를 부르기 전에 provider 가 더 보냈다 — 프레임 큐에 적체된다.
    ch.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'B' } })
    ch.emitBatch([
      { type: 'telemetry', sessionId: 's1' },
      {
        type: 'error',
        sessionId: 's1',
        error: makeClassifiedError('stream_error', 'cancelled transport', { retryable: false })
      }
    ])
    await tick()

    runtime.markAborted('user_cancelled')

    const rest: NormalizedEvent[] = []
    for (;;) {
      const next = await stream.next()
      if (next.done) break
      rest.push(next.value)
    }
    // 부분 답변 꼬리(B) 보존 + telemetry(usage 집계) 보존 + error 만 소멸.
    expect(rest.map((event) => event.type)).toEqual(['message.delta', 'telemetry'])
  })

  // 0166 D8 — 게이트 훅 콜백 **3종 전부** 턴마다 재바인딩돼야 한다. 채널은 체인보다 오래 살고
  // commit/rollback 은 체인 스코프(lease.chainId fence)를 캡처하므로, spawn 시점 클로저를 그대로
  // 두면 두 번째 send 부터 "take 는 새 체인 · commit 은 옛 체인" 이 되어 fence 가 항상 어긋난다.
  // 결과: 배치가 `submitting` 에 갇혀 **정식 버블로 승격되지 않는다**(실기 보고).
  it('게이트 훅 콜백(take·commit·rollback)은 spawn 이 아니라 **현재 턴**으로 위임된다', async () => {
    const ch = channelLive()
    let captured: TurnRequest | undefined
    const runtime = new SessionRuntime({
      ...adapter(ch.liveTurn),
      sendMessage: (request) => {
        captured = request
        return ch.liveTurn
      }
    })

    const calls: string[] = []
    const turnRequest = (chain: string): TurnRequest => ({
      ...req(),
      takeSteerFlush: () => {
        calls.push(`take:${chain}`)
        return undefined
      },
      commitSteerFlush: () => {
        calls.push(`commit:${chain}`)
        return true
      },
      rollbackSteerFlush: () => {
        calls.push(`rollback:${chain}`)
      }
    })

    // 체인 1 — spawn. 어댑터는 여기서 훅 클로저를 캡처한다.
    const first = collect(runtime.send(turnRequest('chain-1')))
    await tick()
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await first

    // 체인 2 — 같은 채널에 pushTurn 으로 이어붙인다(0067). 어댑터의 훅은 여전히 spawn 캡처본이다.
    const second = collect(runtime.send(turnRequest('chain-2')))
    await tick()

    const batch = { uuid: 'b', ids: ['m'], text: 'x', createdAt: 1 }
    captured!.takeSteerFlush?.()
    captured!.commitSteerFlush?.(batch)
    captured!.rollbackSteerFlush?.(batch)

    // 셋 다 **현재 체인** 으로 가야 한다 — 하나라도 chain-1 이면 fence 가 어긋난다.
    expect(calls).toEqual(['take:chain-2', 'commit:chain-2', 'rollback:chain-2'])

    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await second
  })

  it('pickFrameDelegates 는 프레임 위임을 **전부** 옮긴다 — 재조립 경로의 절반 누락 차단', () => {
    const noop = (): undefined => undefined
    const full = {
      ...req(),
      requestApproval: noop,
      takeSteerFlush: noop,
      commitSteerFlush: () => true,
      rollbackSteerFlush: noop,
      captureInterruptReceipt: noop,
      onChannelRetired: noop
    } as unknown as TurnRequest
    // listen 요청(`chat-turn.ts`)이 손으로 나열하다 commit/rollback 을 빠뜨려 게이트 훅이 배치를
    // `submitting` 에 가뒀다(0166 D7). 목록을 여기 한 곳에 두고 그 전량을 단언한다.
    expect(Object.keys(pickFrameDelegates(full)).sort()).toEqual([
      'captureInterruptReceipt',
      'commitSteerFlush',
      'onChannelRetired',
      'requestApproval',
      'rollbackSteerFlush',
      'takeSteerFlush'
    ])
    // 요청이 안 준 것은 싣지 않는다(어댑터가 "있다" 로 오인하지 않게).
    expect(pickFrameDelegates(req())).toEqual({})
  })

  // 0165 AC14 — **보고 증상 ① 의 재현 경로**. 취소 턴이 만든 provider error 가 다음 턴 프레임으로
  // 새면 renderer 에 에러 버블이 뜨고, 그 뒤 delta 가 도착하며 버블이 지워졌다가 다시 그려진다.
  // (IPC 핸들러가 아니라 프레임 경계에서 재현한다 — 누출이 일어나는 층이 여기다.)
  it('취소 → 재전송 을 반복해도 다음 턴 프레임에 error 가 섞이지 않는다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))

    for (let round = 0; round < 3; round += 1) {
      // ① 사용자 턴 시작 → 부분 응답 → 중단
      const cancelled = collect(runtime.send(req()))
      await tick()
      ch.emit({ type: 'message.delta', sessionId: 's1', delta: { text: `부분 ${round}` } })
      await tick()
      runtime.markAborted('user_cancelled')
      const partial = await cancelled
      expect(partial.map((event) => event.type)).toEqual(['message.delta'])

      // ② interrupt 로 CLI 가 낸 실패 result — [telemetry, error] 한 배치. 취소된 턴의 잔여다.
      ch.emitBatch([
        { type: 'telemetry', sessionId: 's1' },
        {
          type: 'error',
          sessionId: 's1',
          error: makeClassifiedError('stream_error', 'interrupted', { retryable: false })
        }
      ])
      await tick()
      expect(runtime.hasUnframedBacklog).toBe(false) // 다음 프레임으로 새지 않는다

      // ③ 같은 채널에 재전송 — 이 턴에는 error 가 하나도 없어야 한다.
      const next = collect(runtime.send(req()))
      await tick()
      ch.emit({ type: 'message.delta', sessionId: 's1', delta: { text: `정상 ${round}` } })
      ch.emit({ type: 'telemetry', sessionId: 's1' })
      const events = await next
      expect(events.map((event) => event.type)).toEqual(['message.delta', 'telemetry'])
      expect((events[0] as { delta: { text: string } }).delta.text).toBe(`정상 ${round}`)
    }
  })

  // 0165 AC3·AC4 — channel incarnation token. 라우팅 세대 검사의 근거이므로 토큰 자체를 고정한다.
  it('channelToken 은 채널 화신 단위다 — 후속 턴에서 그대로, respawn 에서만 새로 발급', async () => {
    const first = channelLive()
    const second = channelLive()
    let spawned = 0
    const runtime = new SessionRuntime({
      ...adapter(first.liveTurn),
      sendMessage: () => (spawned++ === 0 ? first.liveTurn : second.liveTurn)
    })

    const turn1 = collect(runtime.send(req()))
    await tick()
    const token1 = runtime.channelToken
    expect(token1).not.toBeNull()
    first.emit({ type: 'telemetry', sessionId: 's1' })
    await turn1

    // 같은 채널에 이어붙인 후속 턴은 토큰을 바꾸지 않는다.
    const turn2 = collect(runtime.send(req()))
    await tick()
    expect(runtime.channelToken).toBe(token1)
    first.emit({ type: 'telemetry', sessionId: 's1' })
    await turn2

    // respawn(채널 교체)에서만 새 토큰.
    runtime.teardownChannel()
    const turn3 = collect(runtime.send(req()))
    await tick()
    expect(runtime.channelToken).not.toBe(token1)
    second.emit({ type: 'telemetry', sessionId: 's1' })
    await turn3
    expect(spawned).toBe(2)
  })

  it('이전 세대(구 채널)의 배치는 통째로 폐기된다 — 새 프레임에 섞이지 않는다', async () => {
    const first = channelLive()
    const second = channelLive()
    let spawned = 0
    const runtime = new SessionRuntime({
      ...adapter(first.liveTurn),
      sendMessage: () => (spawned++ === 0 ? first.liveTurn : second.liveTurn)
    })

    const turn1 = collect(runtime.send(req()))
    await tick()
    first.emit({ type: 'telemetry', sessionId: 's1' })
    await turn1
    runtime.teardownChannel()

    const turn2 = collect(runtime.send(req()))
    await tick()
    // 구 채널이 뒤늦게 토해낸 잔여 — 세대 불일치라 새 프레임에 들어가면 안 된다.
    first.emit({ type: 'message.delta', sessionId: 's1', delta: { text: '구 채널 잔여' } })
    await tick()
    second.emit({ type: 'message.delta', sessionId: 's1', delta: { text: '새 채널' } })
    second.emit({ type: 'telemetry', sessionId: 's1' })

    const events = await turn2
    expect(events.map((event) => event.type)).toEqual(['message.delta', 'telemetry'])
    expect((events[0] as { delta: { text: string } }).delta.text).toBe('새 채널')
    expect(runtime.hasUnframedBacklog).toBe(false)
  })

  it('채널 교체 뒤 지각 도착한 interrupt 영수증은 발행 시점 수신자에게도 전달하지 않는다', async () => {
    const ch = channelLive()
    let resolveReceipt!: (value: { stillQueued: string[] }) => void
    ch.liveTurn.interrupt = () =>
      new Promise((resolve) => {
        resolveReceipt = resolve
      })
    const received = vi.fn()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const frame = collect(
      runtime.send({
        ...req(),
        captureInterruptReceipt: () => received
      })
    )
    ch.emit({ type: 'session.updated', sessionId: 's1', patch: {} })
    await tick()
    runtime.markAborted('user_cancelled')
    await frame
    runtime.teardownChannel()
    resolveReceipt({ stillQueued: ['old-attempt'] })
    await tick()
    expect(received).not.toHaveBeenCalled()
  })

  it('채널 화신 종료 통지는 token당 한 번만 올라간다', async () => {
    const ch = channelLive()
    const retired = vi.fn()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const frame = collect(runtime.send({ ...req(), onChannelRetired: retired }))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await frame
    runtime.teardownChannel()
    runtime.close()
    expect(retired).toHaveBeenCalledTimes(1)
    expect(retired).toHaveBeenCalledWith(expect.any(Number))
  })

  it('프레임 밖의 소속 불명 이벤트는 다음 사용자 프레임과 섞지 않고 채널을 격리한다', async () => {
    const first = channelLive()
    const second = channelLive()
    let spawns = 0
    const runtime = new SessionRuntime({
      ...adapter(first.liveTurn),
      sendMessage: () => (spawns++ === 0 ? first.liveTurn : second.liveTurn)
    })
    const f1 = collect(runtime.send(req()))
    first.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    // CLI 자동 픽업 턴 개시 시뮬레이트 — 프레임 없는 상태의 이벤트.
    first.emit({ type: 'session.updated', sessionId: 's1', patch: {} })
    await tick()

    const f2 = collect(runtime.send({ ...req(), text: 'next' }))
    second.emit({ type: 'telemetry', sessionId: 's1' })
    const events2 = await f2
    expect(events2.map((e) => e.type)).toEqual(['telemetry'])
    expect(first.close).toHaveBeenCalled()
    expect(spawns).toBe(2)
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

    const requirements = [requirement()]
    const f2 = collect(runtime.send({ ...req(), env: { ANTHROPIC_BASE_URL: 'new' }, requirements }))
    second.emit({ type: 'telemetry', sessionId: 's1' })
    await f2
    expect(spawns).toBe(2)
    expect(requests[1]?.env).toEqual({ ANTHROPIC_BASE_URL: 'new' })
    expect(requests[1]?.requirements).toBe(requirements)
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

// 0136 — listen 턴: 입력 push 없이 살아있는 채널 프레임만 소비. 백그라운드 서브에이전트의
// CLI 자동 턴(진행·task_notification·완료 알림 턴)을 라이브 배달한다.
describe('SessionRuntime listen 턴(0136)', () => {
  const listenReq = (): TurnRequest => ({ ...req(), text: '' })

  it('채널 생존 중 listen 은 push 없이 프레임을 열어 이벤트를 소비한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    const fl = collect(runtime.listen(listenReq()))
    await tick()
    expect(ch.pushed).toEqual([]) // 입력 주입 없음
    ch.emit({
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 't1',
      result: {},
      isError: false
    })
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    const events = await fl
    expect(events.map((e) => e.type)).toEqual(['tool.call.completed', 'telemetry'])
    expect(runtime.channelAlive).toBe(true)
  })

  it('유휴 중 쌓인 백로그(unframed)를 listen 프레임이 선합류한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    // 프레임 없는 상태에서 CLI 자동 턴 이벤트가 먼저 도착(백로그).
    ch.emit({ type: 'session.updated', sessionId: 's1', patch: {} })
    await tick()

    const fl = collect(runtime.listen(listenReq()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    const events = await fl
    expect(events.map((e) => e.type)).toEqual(['session.updated', 'telemetry'])
  })

  it('terminal까지 이미 쌓인 unframed 자동 턴은 listen 즉시 종료한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const first = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await first

    ch.emitBatch([
      { type: 'session.updated', sessionId: 's1', patch: {} },
      { type: 'telemetry', sessionId: 's1' }
    ])
    await tick()

    const events = await collect(runtime.listen(listenReq()))
    expect(events.map((event) => event.type)).toEqual(['session.updated', 'telemetry'])
    expect(runtime.hasUnframedBacklog).toBe(false)
  })

  it('채널이 없으면 listen 은 즉시 빈 스트림으로 종료한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    // 아직 채널 미개설(첫 send 전) — pushTurn 지원 어댑터라도 pump 미가동.
    const events = await collect(runtime.listen(listenReq()))
    expect(events).toEqual([])
    expect(ch.pushed).toEqual([])
  })

  it('endListenFrame() 직후 소속 불명 이벤트가 오면 다음 사용자 프레임 대신 새 채널을 쓴다', async () => {
    const first = channelLive()
    const second = channelLive()
    let spawns = 0
    const runtime = new SessionRuntime({
      ...adapter(first.liveTurn),
      sendMessage: () => (spawns++ === 0 ? first.liveTurn : second.liveTurn)
    })
    const f1 = collect(runtime.send(req()))
    first.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    const fl = collect(runtime.listen(listenReq()))
    await tick()
    // 릴리즈 밸브 — busy send 예약이 listen 프레임을 닫는다(terminal 없이).
    runtime.endListenFrame()
    const listenEvents = await fl
    expect(listenEvents).toEqual([]) // terminal 없이 종료
    expect(runtime.channelAlive).toBe(true)

    // 밸브 직후의 held flush 턴 — 이후 도착 이벤트는 unframed 로 살아 다음 프레임에 합류한다.
    first.emit({ type: 'session.updated', sessionId: 's1', patch: {} })
    await tick()
    const f2 = collect(runtime.send({ ...req(), text: 'held' }))
    await tick()
    second.emit({ type: 'telemetry', sessionId: 's1' })
    const events2 = await f2
    expect(events2.map((e) => e.type)).toEqual(['telemetry'])
    expect(first.close).toHaveBeenCalled()
    expect(spawns).toBe(2)
  })

  it('endListenFrame() 은 일반(비-listen) 프레임을 닫지 않는다 (no-op)', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    await tick()
    // 일반 턴 프레임 진행 중 — 릴리즈 밸브는 무효여야 한다.
    runtime.endListenFrame()
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    const events = await f1
    expect(events.map((e) => e.type)).toEqual(['telemetry'])
  })
})

// 0143 — CLI 메인 루프 mid-turn 추적(channelBusy) + 밸브 유예: steer 세션 사망(버그 a)의
// 런타임측 차단. mid auto-turn 에 listen 프레임을 닫고 pushTurn 하면 auto-turn 의 잔여/terminal
// 이 steer 프레임으로 오귀속되던 경로를 "busy 면 밸브 no-op → terminal 자연 마감" 으로 막는다.
describe('SessionRuntime channelBusy + 밸브 유예(0143)', () => {
  const listenReq = (): TurnRequest => ({ ...req(), text: '' })

  it('비-terminal 최상위 이벤트에 busy, terminal 에 유휴로 굴린다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    await tick()
    expect(runtime.channelBusy).toBe(false) // 아직 이벤트 없음
    ch.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'x' } })
    await tick()
    expect(runtime.channelBusy).toBe(true)
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1
    expect(runtime.channelBusy).toBe(false)
  })

  it('백그라운드 스코프 이벤트(child·subagent.task)는 busy 를 켜지 않는다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    const fl = collect(runtime.listen(listenReq()))
    await tick()
    // 백그라운드 태스크의 child 스트림·진행 신호만 흐르는 구간 — CLI 메인 루프는 유휴.
    ch.emit({ type: 'subagent.task', sessionId: 's1', toolUseId: 'p1', phase: 'progress' })
    ch.emit({
      type: 'tool.call.started',
      sessionId: 's1',
      toolRunId: 'c1',
      toolName: 'Bash',
      args: {},
      parentToolRunId: 'p1'
    })
    await tick()
    expect(runtime.channelBusy).toBe(false)
    // 유휴이므로 밸브는 즉시 프레임을 닫는다.
    runtime.endListenFrame()
    const events = await fl
    expect(events.map((e) => e.type)).toEqual(['subagent.task', 'tool.call.started'])
  })

  it('mid auto-turn 밸브는 no-op — auto-turn terminal 이 listen 프레임을 자연 마감(무손실)', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1

    const fl = collect(runtime.listen(listenReq()))
    await tick()
    // CLI 자동(알림) 턴 진행 중 — 최상위 스트림 이벤트가 흐른다.
    ch.emit({ type: 'message.delta', sessionId: 's1', delta: { text: '알림 턴' } })
    await tick()
    expect(runtime.channelBusy).toBe(true)
    // steer 예약(held) 릴리즈 밸브 발화 — busy 라 no-op 이어야 한다.
    runtime.endListenFrame()
    ch.emit({ type: 'message.completed', sessionId: 's1', message: { text: '알림 턴' } })
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    // auto-turn 의 전체 이벤트(terminal 포함)가 listen 프레임에 귀속된다 — steer 프레임 오귀속 없음.
    const events = await fl
    expect(events.map((e) => e.type)).toEqual(['message.delta', 'message.completed', 'telemetry'])
    expect(runtime.channelBusy).toBe(false)

    // 이후 held flush 턴은 깨끗한 유휴 채널에서 시작한다.
    const f2 = collect(runtime.send({ ...req(), text: 'held' }))
    await tick()
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    const events2 = await f2
    expect(events2.map((e) => e.type)).toEqual(['telemetry'])
  })

  it('hasUnframedBacklog — 프레임 밖 적체를 노출하고 openFrame 합류로 소진된다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await f1
    expect(runtime.hasUnframedBacklog).toBe(false)

    ch.emit({ type: 'session.updated', sessionId: 's1', patch: {} })
    await tick()
    expect(runtime.hasUnframedBacklog).toBe(true)

    const fl = collect(runtime.listen(listenReq()))
    await tick()
    expect(runtime.hasUnframedBacklog).toBe(false) // 백로그 선합류
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    const events = await fl
    expect(events.map((e) => e.type)).toEqual(['session.updated', 'telemetry'])
  })

  it('teardownChannel/채널 사망은 busy 를 해제한다', async () => {
    const ch = channelLive()
    const runtime = new SessionRuntime(adapter(ch.liveTurn))
    const f1 = collect(runtime.send(req()))
    await tick()
    ch.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'x' } })
    await tick()
    expect(runtime.channelBusy).toBe(true)
    runtime.teardownChannel()
    expect(runtime.channelBusy).toBe(false)
    await f1.catch(() => undefined)
  })
})

// 0125 — spawn 시점 providerSettings 기록 수명: 콜드 스폰에서 기록, pushTurn 재사용은 불변,
// teardown/채널 사망에서 해제. 내용 비교 판정 자체는 features/harnesses(순수 함수) 소관.
describe('SessionRuntime spawn settings 기록(0125)', () => {
  const settingsOf = (token: string): NonNullable<TurnRequest['providerSettings']> => ({
    providerKey: 'claude-gateway',
    provider: 'gateway',
    sourceRevision: 'rev',
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

class FakeSessionRuntime implements GovernedLiveTurn {
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

  // GovernedLiveTurn 전체 표면 (R3-1 의 stopTask/backgroundTask 포함) — 타입 만족용.
  get eventBatches(): AsyncIterable<ProviderMessageBatch> {
    const script = this.script
    return (async function* () {
      let sequence = 0
      for (const event of script) yield { sequence: sequence++, events: [event] }
    })()
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

describe('SessionRuntime runtime tool revision (0158)', () => {
  it('clears the spawn metadata after a one-shot turn completes', async () => {
    const runtime = new SessionRuntime(
      adapter(live([{ type: 'telemetry', sessionId: 's1' }])),
      'oneshot'
    )
    const request: TurnRequest = {
      ...req(),
      model: 'sonnet',
      extensions: { ...req().extensions, runtimeTools: { revision: 7, servers: new Map() } }
    }

    await collect(runtime.send(request))

    expect(runtime.channelAlive).toBe(false)
    expect(runtime.spawnedProviderSettings).toBeUndefined()
    expect(runtime.spawnedModel).toBeUndefined()
    expect(runtime.spawnedRuntimeToolsRevision).toBeUndefined()
  })

  it('records the spawn revision and clears it for forced and stream-end teardown', async () => {
    const first = channelLive()
    const second = channelLive()
    let spawns = 0
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: () => (spawns++ === 0 ? first.liveTurn : second.liveTurn),
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })
    const withRevision = (revision: number): TurnRequest => ({
      ...req(),
      extensions: { ...req().extensions, runtimeTools: { revision, servers: new Map() } }
    })
    const recorded = runtime as unknown as { spawnedRuntimeToolsRevision?: number }

    const firstAttempt = collect(runtime.send(withRevision(3)))
    first.emit({ type: 'telemetry', sessionId: 's1' })
    await firstAttempt
    expect(recorded.spawnedRuntimeToolsRevision).toBe(3)

    runtime.teardownChannel()
    expect(recorded.spawnedRuntimeToolsRevision).toBeUndefined()

    const secondAttempt = collect(runtime.send(withRevision(4)))
    second.liveTurn.close()
    await secondAttempt
    expect(recorded.spawnedRuntimeToolsRevision).toBeUndefined()
  })

  it('uses the fresh automatic-continuation snapshot for both stale detection and respawn request', async () => {
    const first = channelLive()
    const second = channelLive()
    const sent: TurnRequest[] = []
    let spawns = 0
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: (request) => {
        sent.push(request)
        return spawns++ === 0 ? first.liveTurn : second.liveTurn
      },
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })
    const firstRequest: TurnRequest = {
      ...req(),
      extensions: { ...req().extensions, runtimeTools: { revision: 3, servers: new Map() } }
    }
    const continuationRequest: TurnRequest = {
      ...req(),
      text: 'automatic continuation',
      extensions: { ...req().extensions, runtimeTools: { revision: 4, servers: new Map() } }
    }

    const firstAttempt = collect(runtime.send(firstRequest))
    first.emit({ type: 'telemetry', sessionId: 's1' })
    await firstAttempt

    expect(
      decideRespawn({
        channelAlive: runtime.channelAlive,
        providerBoundaryChanged: false,
        modelChanged: false,
        providerSettingsChanged: false,
        runtimeEnvChanged: false,
        // 이 케이스는 도구 revision 축만 본다 — worktree 폴백은 일어나지 않았다.
        executionCwdRecovered: false,
        spawnedRuntimeToolsRevision: runtime.spawnedRuntimeToolsRevision,
        runtimeToolsRevision: continuationRequest.extensions.runtimeTools?.revision
      })
    ).toBe(true)

    runtime.teardownChannel()
    const continuationAttempt = collect(runtime.send(continuationRequest))
    second.emit({ type: 'telemetry', sessionId: 's1' })
    await continuationAttempt

    expect(sent[1]?.extensions.runtimeTools).toBe(continuationRequest.extensions.runtimeTools)
    expect(sent[1]?.extensions.runtimeTools?.revision).toBe(4)
  })
})

// 0212 r3 — **`turn.live` 전달 홉의 인자 충실도**(§10 EP-14 지점 2 · verify r2 D11).
//
// IPC 핸들러가 `turn.live.backgroundTask(req.toolUseId)` 를 부르는 것은 이미 잠겼다
// (`app/chat-turn.background-subagent.test.ts`). 그러나 그 테스트는 포트를 mock 하므로
// **production 에서 그 포트인 여기**를 지나지 않는다 — r2 검증에서 이 네 줄은 인자를
// 오염시켜도(`toolUseId + '-x'`) 본문을 통째로 폐기해도(`return false`) 278파일 2790케이스가
// 전건 초록이었다. 네 forwarder 는 같은 형상의 형제라 함께 잠근다.
//
// **인자를 두 번 서로 다른 값으로 넘긴다** — 한 번이면 상수로 굳힌 전달도 통과한다.
describe('SessionRuntime — live 전달 홉 (0212 §10 EP-14)', () => {
  type ForwardSpy = {
    setPermissionMode: Mock<(mode: ClaudePermissionMode) => Promise<void>>
    setModel: Mock<(model?: string) => Promise<void>>
    stopTask: Mock<(taskId: string) => Promise<void>>
    backgroundTask: Mock<(toolUseId?: string) => Promise<boolean>>
  }

  function spiedLive(moved: boolean): { turn: LiveTurn; spy: ForwardSpy } {
    const spy: ForwardSpy = {
      setPermissionMode: vi.fn(async () => {}),
      setModel: vi.fn(async () => {}),
      stopTask: vi.fn(async () => {}),
      backgroundTask: vi.fn(async () => moved)
    }
    const turn: LiveTurn = {
      // 소비를 멈춘 채로 두려면 스트림이 끝나면 안 된다 — terminal 을 내면 `consumeTurnScoped`
      // 의 finally 가 `this.live = null` 로 홉을 끊는다.
      eventBatches: (async function* () {
        yield { sequence: 0, events: [{ type: 'assistant.delta', sessionId: 's1', text: 'a' }] }
        await new Promise(() => {})
      })() as AsyncIterable<ProviderMessageBatch>,
      close: vi.fn(),
      interrupt: async () => undefined,
      ...spy
    }
    return { turn, spy }
  }

  // 턴을 첫 이벤트에서 멈춘 상태로 만든다 — 그 지점에서 `this.live` 가 채워져 있다(`:351`).
  async function runtimeWithLive(
    moved = true
  ): Promise<{ runtime: SessionRuntime; spy: ForwardSpy; done: () => Promise<void> }> {
    const { turn, spy } = spiedLive(moved)
    const runtime = new SessionRuntime(adapter(turn))
    const stream = runtime.send(req())[Symbol.asyncIterator]()
    await stream.next()
    return { runtime, spy, done: async () => void (await stream.return?.(undefined)) }
  }

  it('backgroundTask 는 받은 toolUseId 를 그대로 넘기고 반환을 그대로 돌려준다', async () => {
    const { runtime, spy, done } = await runtimeWithLive(true)

    expect(await runtime.backgroundTask('use1')).toBe(true)
    expect(await runtime.backgroundTask('use2')).toBe(true)

    expect(spy.backgroundTask.mock.calls).toEqual([['use1'], ['use2']])
    await done()
  })

  it('backgroundTask 는 live 의 false 를 삼키지 않는다 — 핸들러가 그것으로 reject 한다', async () => {
    const { runtime, spy, done } = await runtimeWithLive(false)

    expect(await runtime.backgroundTask('use1')).toBe(false)
    expect(spy.backgroundTask.mock.calls).toEqual([['use1']])
    await done()
  })

  it('live 가 없으면 포트에 닿지 않고 false 다 — 도달 후 거절과 구분된다', async () => {
    const { turn, spy } = spiedLive(true)
    const runtime = new SessionRuntime(adapter(turn))

    expect(await runtime.backgroundTask('use1')).toBe(false)
    expect(spy.backgroundTask).not.toHaveBeenCalled()
  })

  it('stopTask 는 받은 taskId 를 그대로 넘긴다 (0204 중단 경로)', async () => {
    const { runtime, spy, done } = await runtimeWithLive()

    await runtime.stopTask('task-1')
    await runtime.stopTask('task-2')

    expect(spy.stopTask.mock.calls).toEqual([['task-1'], ['task-2']])
    await done()
  })

  it('setModel·setPermissionMode 도 받은 값을 그대로 넘긴다 — 같은 형상의 형제 홉이다', async () => {
    const { runtime, spy, done } = await runtimeWithLive()

    await runtime.setModel('opus')
    await runtime.setModel('sonnet')
    await runtime.setPermissionMode('plan')
    await runtime.setPermissionMode('acceptEdits')

    expect(spy.setModel.mock.calls).toEqual([['opus'], ['sonnet']])
    expect(spy.setPermissionMode.mock.calls).toEqual([['plan'], ['acceptEdits']])
    await done()
  })
})
