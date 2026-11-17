import { describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { ClientRef } from '../../contracts/client'
import type { TurnContext } from '../../contracts/turn'
import { createPersistenceSender, PERSIST_PEER_LOST } from './persistence-sender'

type Turn = TurnContext<ClientRef>
interface Deferred {
  method: string
  payload: unknown
  resolve(value: unknown): void
  reject(error: Error): void
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup() {
  // 피어로 나간 것과 화면으로 나간 것을 한 줄에 순서대로 적는다.
  const log: Array<[string, unknown]> = []
  const requests: Deferred[] = []
  const closed = new Set<() => void>()
  const failTurn = vi.fn()
  const sender = createPersistenceSender({
    link: {
      notify(method, payload) {
        log.push([method, payload])
        return true
      },
      request(method, payload) {
        log.push([method, payload])
        return new Promise((resolve, reject) => {
          requests.push({ method, payload, resolve, reject })
        })
      },
      onClosed(listener) {
        closed.add(listener)
        return () => closed.delete(listener)
      }
    },
    send: (owner, ev) => void log.push(['screen', { owner, ev }]),
    failTurn
  })
  const peerClosed = (): void => {
    for (const listener of closed) listener()
    for (const request of requests.splice(0)) request.reject(new Error('closed'))
  }
  const methods = (): string[] => log.map(([method]) => method)
  const payloads = (method: string): Array<Record<string, unknown>> =>
    log.filter(([name]) => name === method).map(([, payload]) => payload as Record<string, unknown>)
  return { sender, log, requests, failTurn, peerClosed, methods, payloads }
}

function turnOf(overrides: Record<string, unknown> = {}): Turn {
  return {
    owner: { id: 7 },
    controller: new AbortController(),
    titleAdapter: { id: 'opencode' },
    agentKind: 'code',
    providerKey: 'key-1',
    isNewSession: true,
    pendingUserText: 'hello',
    cwd: '/work',
    dbSessionId: null,
    currentAssistantMessageId: null,
    assistantText: '',
    openToolRuns: new Map(),
    askPendingIds: [],
    pendingAskAnswers: [],
    askResolved: new Map(),
    ...overrides
  } as unknown as Turn
}

const delta = (text: string): NormalizedEvent =>
  ({ type: 'message.delta', sessionId: 's', delta: { text } }) as NormalizedEvent
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe('턴 저장 스트림의 보내는 끝 (EP-15 규칙 칸)', () => {
  it('턴 이벤트 — 시작 1건 뒤 이벤트를 보내고, 응답을 기다리지 않고 화면으로 간다', () => {
    const h = setup()
    const turn = turnOf()
    h.sender.onTurnEvent(turn, delta('a'))
    h.sender.relay(turn, delta('a'))
    h.sender.onTurnEvent(turn, delta('b'))
    h.sender.relay(turn, delta('b'))
    // 응답을 하나도 주지 않았는데 화면 중계가 끝나 있다.
    expect(h.methods()).toEqual(['turn.begin', 'turn.event', 'screen', 'turn.event', 'screen'])
    expect(h.requests).toEqual([])
    const [begin] = h.payloads('turn.begin')
    expect(begin).toEqual({
      turnKey: expect.any(String),
      backend: 'opencode',
      fields: {
        pendingUserText: 'hello',
        agentKind: 'code',
        cwd: '/work',
        dbSessionId: null,
        providerKey: 'key-1',
        isNewSession: true
      }
    })
    expect(h.payloads('turn.event').map((p) => p.turnKey)).toEqual([begin!.turnKey, begin!.turnKey])
    expect(h.payloads('screen')[0]).toEqual({ owner: turn.owner, ev: delta('a') })
  })

  it('세션 id 는 실행 쪽이 같은 이벤트에서 정하고, 바뀐 도중 필드는 다음 입력에만 실린다', () => {
    const h = setup()
    const turn = turnOf()
    h.sender.onTurnEvent(turn, delta('a'))
    h.sender.onTurnEvent(turn, {
      type: 'session.updated',
      sessionId: 'native-9',
      patch: {}
    } as NormalizedEvent)
    h.sender.onTurnEvent(turn, delta('b'))
    expect(turn.dbSessionId).toBe('native-9')
    expect(h.payloads('turn.event').map((p) => p.fields)).toEqual([
      undefined,
      { dbSessionId: 'native-9', providerKey: 'key-1', isNewSession: true },
      undefined
    ])
  })

  it('계획 검토 도구 입력 — 턴 이벤트와 같은 순서 큐로 간다', () => {
    const h = setup()
    const turn = turnOf()
    const review = { type: 'permission.requested', sessionId: 's', action: {} } as NormalizedEvent
    h.sender.onTurnEvent(turn, delta('a'))
    h.sender.persist(turn, review)
    h.sender.onTurnEvent(turn, delta('b'))
    expect(h.payloads('turn.event').map((p) => p.ev)).toEqual([delta('a'), review, delta('b')])
  })

  it('질문 답 — 실행 쪽 턴 상태를 고치고 도구 완료를 중계한 뒤 결과만 보낸다(부모 도구 연결 포함)', () => {
    const h = setup()
    const answer = { toolUseId: 'ask-1', answers: { Q: 'A' }, response: 'free' }
    const other = { toolUseId: 'not-pending', answers: {} }
    const turn = turnOf({
      dbSessionId: 's',
      openToolRuns: new Map([['ask-1', { parentToolRunId: 'task-1' }]]),
      askPendingIds: ['ask-1'],
      pendingAskAnswers: [other, answer]
    })
    h.sender.flushAskAnswers(turn, turn.owner)
    expect(turn.askPendingIds).toEqual([])
    expect(turn.pendingAskAnswers).toEqual([other])
    expect(turn.openToolRuns.has('ask-1')).toBe(false)
    expect(turn.askResolved.get('ask-1')).toBe(answer)
    const output = { answers: { Q: 'A' }, response: 'free' }
    expect(h.methods()).toEqual(['screen', 'turn.begin', 'turn.askAnswers'])
    expect(h.payloads('screen')[0]).toEqual({
      owner: turn.owner,
      ev: {
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 'ask-1',
        result: output,
        isError: false,
        parentToolRunId: 'task-1'
      }
    })
    expect(h.payloads('turn.askAnswers')[0]!.answers).toEqual([
      { toolUseId: 'ask-1', output, parentToolRunId: 'task-1' }
    ])
    // 기다리는 답이 없으면 아무것도 보내지 않는다.
    h.sender.flushAskAnswers(turn, turn.owner)
    expect(h.methods()).toHaveLength(3)
  })

  it('질문 답 — 답이 거꾸로 와도 도구 id 로 짝짓고 각자의 부모 도구를 싣는다', () => {
    const h = setup()
    const turn = turnOf({
      dbSessionId: 's',
      openToolRuns: new Map([
        ['ask-1', { parentToolRunId: 'parent-1' }],
        ['ask-2', { parentToolRunId: 'parent-2' }]
      ]),
      askPendingIds: ['ask-1', 'ask-2'],
      pendingAskAnswers: [
        { toolUseId: 'ask-2', answers: { Second: 'B' } },
        { toolUseId: 'ask-1', answers: { First: 'A' } }
      ]
    })
    h.sender.flushAskAnswers(turn, turn.owner)
    const expected = [
      { toolUseId: 'ask-2', output: { answers: { Second: 'B' } }, parentToolRunId: 'parent-2' },
      { toolUseId: 'ask-1', output: { answers: { First: 'A' } }, parentToolRunId: 'parent-1' }
    ]
    expect(h.payloads('turn.askAnswers')[0]!.answers).toEqual(expected)
    expect(
      h.payloads('screen').map(({ ev }) => {
        const done = ev as { toolRunId: string; result: unknown; parentToolRunId?: string }
        return {
          toolUseId: done.toolRunId,
          output: done.result,
          parentToolRunId: done.parentToolRunId
        }
      })
    ).toEqual(expected)
    expect(turn.askPendingIds).toEqual([])
    expect(turn.pendingAskAnswers).toEqual([])
  })

  it('답을 채운 질문 도구의 늦은 결과는 저장된 답으로 바뀌어 저장과 화면에 같이 간다', () => {
    const h = setup()
    const turn = turnOf({
      askResolved: new Map([['ask-1', { toolUseId: 'ask-1', answers: { Q: 'A' } }]])
    })
    const late = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'ask-1',
      result: '',
      isError: false
    } as NormalizedEvent
    h.sender.onTurnEvent(turn, late)
    h.sender.relay(turn, late)
    expect((h.payloads('turn.event')[0]!.ev as { result: unknown }).result).toEqual({
      answers: { Q: 'A' }
    })
    expect((h.payloads('screen')[0]!.ev as { result: unknown }).result).toEqual({
      answers: { Q: 'A' }
    })
  })

  it('사용자 메시지 커밋 — 응답의 메시지 id 를 돌려주고, 응답이 null 이면 null 이다', async () => {
    const h = setup()
    const turn = turnOf()
    const batch = { text: 'hi', createdAt: 5 }
    const first = h.sender.commitUserMessage!(turn, batch)
    expect(h.payloads('turn.commitUser')[0]).toMatchObject({ batch })
    h.requests[0]!.resolve(41)
    expect(await first).toBe(41)
    const second = h.sender.commitUserMessage!(turn, batch)
    h.requests[1]!.resolve(null)
    expect(await second).toBeNull()
  })

  it('턴 끝 — 끝 1건을 보내고 그 턴 상태를 버린다', () => {
    const h = setup()
    const turn = turnOf()
    h.sender.onTurnEvent(turn, delta('a'))
    h.sender.finalizeTurn!(turn)
    h.sender.finalizeTurn!(turn)
    expect(h.methods()).toEqual(['turn.begin', 'turn.event', 'turn.end'])
    // 시작한 적 없는 턴의 끝은 보내지 않는다.
    h.sender.finalizeTurn!(turnOf())
    expect(h.methods()).toHaveLength(3)
  })

  it('백그라운드 기록 — 응답 뒤에만 공개하고, 실패하면 공개하지 않는다', async () => {
    const h = setup()
    const committed = vi.fn()
    const event = { type: 'background.task', sessionId: 's' } as never
    h.sender.persistProviderEvent(event, committed)
    h.sender.persistProviderEvent(event, committed)
    await flush()
    expect(committed).not.toHaveBeenCalled()
    h.requests[0]!.resolve(true)
    await flush()
    expect(committed).toHaveBeenCalledOnce()
    h.requests[1]!.reject(new Error('gone'))
    await flush()
    expect(committed).toHaveBeenCalledOnce()
    expect(h.payloads('provider.event')).toEqual([event, event])
  })

  it('제공자 세션 잊기 — 그 세션 id 로 1건 보낸다', () => {
    const h = setup()
    h.sender.forgetProviderSession('native-3')
    expect(h.log).toEqual([['provider.forget', { sessionId: 'native-3' }]])
  })

  it('저장 실패 응답 — 그 턴만 취소 1·이후 그 턴의 저장 메시지 0', async () => {
    const h = setup()
    const bad = turnOf()
    const good = turnOf()
    h.sender.onTurnEvent(bad, delta('a'))
    h.sender.onTurnEvent(good, delta('a'))
    const [badKey, goodKey] = h.payloads('turn.begin').map((p) => p.turnKey as string)
    h.sender.onNotify('turn.persistFailed', { turnKey: badKey, message: 'disk full' })
    h.sender.onNotify('turn.persistFailed', { turnKey: badKey, message: 'again' })
    h.sender.onNotify('settings.patch', { turnKey: goodKey, message: 'ignored' })
    expect(h.failTurn.mock.calls).toEqual([[bad, 'disk full']])
    const before = h.log.length
    h.sender.onTurnEvent(bad, delta('b'))
    h.sender.persist(bad, delta('c'))
    bad.askPendingIds.push('q')
    bad.pendingAskAnswers.push({ toolUseId: 'q', answers: {} } as never)
    h.sender.flushAskAnswers(bad, bad.owner)
    expect(await h.sender.commitUserMessage!(bad, { text: 'x', createdAt: 1 })).toBeNull()
    h.sender.finalizeTurn!(bad)
    // 질문 답의 화면 중계 1건뿐이다 — 피어로 간 것은 0이다.
    expect(h.methods().slice(before)).toEqual(['screen'])
    h.sender.onTurnEvent(good, delta('b'))
    expect(h.payloads('turn.event').at(-1)!.turnKey).toBe(goodKey)
  })

  it('피어 포트 닫힘 — 활성 턴 둘을 각각 한 번 끝내고 기다리던 커밋은 실패한다 (AC44)', async () => {
    const h = setup()
    const first = turnOf()
    const second = turnOf()
    const done = turnOf()
    h.sender.onTurnEvent(first, delta('a'))
    h.sender.onTurnEvent(second, delta('a'))
    h.sender.onTurnEvent(done, delta('a'))
    h.sender.finalizeTurn!(done)
    const commit = h.sender.commitUserMessage!(first, { text: 'x', createdAt: 1 })
    const settled = vi.fn()
    void Promise.resolve(commit).then(settled, () => undefined)
    h.peerClosed()
    h.peerClosed()
    await expect(commit).rejects.toThrow('closed')
    expect(settled).not.toHaveBeenCalled()
    expect(h.failTurn.mock.calls).toEqual([
      [first, PERSIST_PEER_LOST],
      [second, PERSIST_PEER_LOST]
    ])
    const before = h.log.length
    h.sender.onTurnEvent(first, delta('b'))
    expect(h.log.length).toBe(before)
  })

  it('산출물 참조 이벤트 — 확인을 기다리고, 같은 턴의 뒤 중계는 그 뒤로 줄을 선다', async () => {
    const h = setup()
    const turn = turnOf()
    const other = turnOf()
    const captured = {
      type: 'output.captured',
      sessionId: 's',
      artifact: { id: 'from-adapter' }
    } as unknown as NormalizedEvent
    h.sender.onTurnEvent(turn, captured)
    h.sender.relay(turn, captured)
    h.sender.onTurnEvent(turn, delta('after'))
    h.sender.relay(turn, delta('after'))
    // 다른 턴은 기다리지 않는다.
    h.sender.onTurnEvent(other, delta('other'))
    h.sender.relay(other, delta('other'))
    expect(h.payloads('screen').map((p) => p.ev)).toEqual([delta('other')])
    h.requests[0]!.resolve({ id: 'confirmed' })
    await flush()
    expect(h.payloads('screen').map((p) => p.ev)).toEqual([
      delta('other'),
      { type: 'output.captured', sessionId: 's', artifact: { id: 'confirmed' } },
      delta('after')
    ])
    // 확인이 없으면 어댑터가 준 참조를 지운 채 중계한다.
    const next = { ...captured, artifact: { id: 'from-adapter' } } as unknown as NormalizedEvent
    h.sender.onTurnEvent(turn, next)
    h.sender.relay(turn, next)
    h.requests[1]!.resolve(null)
    await flush()
    expect(h.payloads('screen').at(-1)!.ev).toEqual({ type: 'output.captured', sessionId: 's' })
  })

  it('게시 영수증이 없는 도구 완료는 기다리지 않고 어댑터가 준 참조를 지운다', () => {
    const h = setup()
    const turn = turnOf()
    const ev = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't',
      result: 'plain',
      isError: false,
      artifact: { id: 'from-adapter' }
    } as unknown as NormalizedEvent
    h.sender.onTurnEvent(turn, ev)
    expect(h.requests).toEqual([])
    expect(h.payloads('turn.event')[0]!.ev).not.toHaveProperty('artifact')
  })
})
