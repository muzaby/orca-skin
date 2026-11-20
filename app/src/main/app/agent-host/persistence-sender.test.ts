import { describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import { PRODUCT_SLUG } from '../../../shared/product'
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
  let nextId = 0
  const sender = createPersistenceSender({
    newId: () => String(++nextId),
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
    expect(h.payloads('turn.event').map((p) => p.ev)).toEqual([
      { ...delta('a'), messageKey: 'a:1' },
      review,
      { ...delta('b'), messageKey: 'a:1' }
    ])
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
    h.requests[0]!.resolve({ id: 41, created: true })
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

  it('게시 영수증이 붙은 도구 완료는 확인을 기다리고, 같은 턴의 뒤 중계는 그 뒤로 줄을 선다 (D-049)', async () => {
    const h = setup()
    const turn = turnOf()
    const receipt = JSON.stringify({
      type: `${PRODUCT_SLUG}.artifact.published`,
      version: 1,
      publicationId: 'pub-1'
    })
    const ev = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't',
      result: receipt,
      isError: false
    } as unknown as NormalizedEvent
    h.sender.onTurnEvent(turn, ev)
    h.sender.relay(turn, ev)
    h.sender.onTurnEvent(turn, delta('after'))
    h.sender.relay(turn, delta('after'))
    expect(h.requests).toHaveLength(1)
    expect(h.payloads('screen')).toEqual([])
    h.requests[0]!.resolve({ id: 'confirmed' })
    await flush()
    expect(h.payloads('screen').map((p) => p.ev)).toEqual([
      { ...ev, artifact: { id: 'confirmed' } },
      delta('after')
    ])
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

describe('0326 message identity', () => {
  it('k5/k23/k24 changes the key only after a successful new commit', async () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const batch = { text: 'new input', createdAt: 5, messageKey: 'u:new' }
    const emitDelta = (text: string): void => {
      const event = delta(text)
      h.sender.onTurnEvent(turn, event)
      h.sender.relay(turn, event)
    }

    emitDelta('first')
    const created = h.sender.commitUserMessage!(turn, batch)
    emitDelta('before reply')
    h.requests[0]!.resolve({ id: 4, created: true })
    expect(await created).toBe(4)
    emitDelta('after new commit')

    const replayed = h.sender.commitUserMessage!(turn, batch)
    h.requests[1]!.resolve({ id: 4, created: false })
    expect(await replayed).toBe(4)
    const error: NormalizedEvent = {
      type: 'error',
      sessionId: 's',
      error: { category: 'stream_error', message: 'interrupted', retryable: false }
    }
    h.sender.onTurnEvent(turn, error)
    h.sender.relay(turn, error)

    const missing = h.sender.commitUserMessage!(turn, batch)
    h.requests[2]!.resolve(null)
    expect(await missing).toBeNull()
    emitDelta('after null')

    const rejected = h.sender.commitUserMessage!(turn, batch)
    h.requests[3]!.reject(new Error('closed'))
    await expect(rejected).rejects.toThrow('closed')
    emitDelta('after rejection')

    const peerEvents = h.payloads('turn.event').map(({ ev }) => ev)
    expect(peerEvents).toEqual(h.payloads('screen').map(({ ev }) => ev))
    expect(peerEvents.map((ev) => (ev as { messageKey: string }).messageKey)).toEqual([
      'a:1',
      'a:1',
      'a:2',
      'a:2',
      'a:2',
      'a:2'
    ])
  })

  it.each(['artifact-first', 'commit-first'] as const)(
    'k25 keeps question answers and the commit in stream order (%s)',
    async (order) => {
      const h = setup()
      const turn = turnOf({
        dbSessionId: 's',
        askPendingIds: ['question'],
        pendingAskAnswers: [{ toolUseId: 'question', answers: { Question: 'yes' } }]
      })
      const emit = (event: NormalizedEvent): void => {
        h.sender.onTurnEvent(turn, event)
        h.sender.relay(turn, event)
      }
      emit({
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 'publication',
        result: JSON.stringify({
          type: `${PRODUCT_SLUG}.artifact.published`,
          version: 1,
          publicationId: 'pub-1'
        }),
        isError: false
      })
      emit({
        type: 'tool.call.started',
        sessionId: 's',
        toolRunId: 'question',
        toolName: 'AskUserQuestion',
        args: {}
      })
      h.sender.flushAskAnswers(turn, turn.owner)
      const batch = { text: 'steer', createdAt: 5, messageKey: 'u:steer' }
      const commit = Promise.resolve(h.sender.commitUserMessage!(turn, batch)).then((id) => {
        h.sender.relay(turn, {
          type: 'message.committed',
          sessionId: 's',
          messageKey: batch.messageKey,
          ids: ['steer'],
          messageId: id!,
          text: batch.text,
          createdAt: batch.createdAt
        })
        emit(delta('after'))
      })

      if (order === 'artifact-first') {
        h.requests[0]!.resolve(null)
        await flush()
        h.requests[1]!.resolve({ id: 4, created: true })
        await commit
      } else {
        h.requests[1]!.resolve({ id: 4, created: true })
        await commit
        expect(h.payloads('screen')).toHaveLength(0)
        h.requests[0]!.resolve(null)
        await flush()
      }

      expect(h.payloads('turn.askAnswers')[0]?.answers).toMatchObject([{ messageKey: 'a:1' }])
      expect(h.payloads('screen').map(({ ev }) => ev)).toMatchObject([
        { type: 'tool.call.completed', toolRunId: 'publication', messageKey: 'a:1' },
        { type: 'tool.call.started', toolRunId: 'question', messageKey: 'a:1' },
        {
          type: 'tool.call.completed',
          toolRunId: 'question',
          messageKey: 'a:1',
          messageKeySource: 'owner'
        },
        { type: 'message.committed', messageKey: 'u:steer' },
        { type: 'message.delta', messageKey: 'a:2' }
      ])
    }
  )

  // VP-03 exact coordinate test names
  it('part 를 만드는 8종에 원 소유 번호를 붙여 저장과 화면에 같이 보낸다', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const emit = (ev: NormalizedEvent): void => {
      h.sender.onTurnEvent(turn, ev)
      h.sender.relay(turn, ev)
    }
    const events: NormalizedEvent[] = [
      { type: 'message.reasoning', sessionId: 's', text: 'r' },
      { type: 'message.completed', sessionId: 's', message: { text: 't' } },
      { type: 'tool.call.started', sessionId: 's', toolRunId: 't1', toolName: 'Read', args: {} },
      {
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 't1',
        result: 'ok',
        isError: false
      },
      {
        type: 'response.boundary',
        sessionId: 's',
        boundary: { id: 'b1', phase: 'begin', kind: 'work' }
      } as NormalizedEvent,
      {
        type: 'subagent.task',
        sessionId: 's',
        toolUseId: 'sub1',
        phase: 'settled',
        background: true,
        status: 'completed'
      } as NormalizedEvent,
      {
        type: 'session.compacted',
        sessionId: 's',
        trigger: 'auto',
        preTokens: 100
      } as NormalizedEvent,
      {
        type: 'error',
        sessionId: 's',
        error: { category: 'stream_error', message: 'e', retryable: false }
      }
    ]
    for (const ev of events) emit(ev)
    const peerEvs = h.payloads('turn.event').map((p) => p.ev as { messageKey?: string })
    const screenEvs = h.payloads('screen').map((p) => p.ev as { messageKey?: string })
    expect(peerEvs).toHaveLength(8)
    expect(screenEvs).toHaveLength(8)
    for (let i = 0; i < 8; i++) {
      expect(peerEvs[i]?.messageKey).toBe('a:1')
      expect(screenEvs[i]).toBe(peerEvs[i])
    }
  })

  it('확인을 기다리는 산출물 이벤트 뒤 줄 선 중계와 질문 답도 찍힌 번호와 순서를 지킨다', async () => {
    const h = setup()
    const turn = turnOf({
      dbSessionId: 's',
      askPendingIds: ['q1'],
      pendingAskAnswers: [{ toolUseId: 'q1', answers: { q: 'yes' } }]
    })
    const emit = (ev: NormalizedEvent): void => {
      h.sender.onTurnEvent(turn, ev)
      h.sender.relay(turn, ev)
    }
    emit({ type: 'tool.call.started', sessionId: 's', toolRunId: 'y', toolName: 'Write', args: {} })
    emit({
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'y',
      result: JSON.stringify({
        type: `${PRODUCT_SLUG}.artifact.published`,
        version: 1,
        publicationId: 'pub-y'
      }),
      isError: false
    })
    emit({
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 'q1',
      toolName: 'AskUserQuestion',
      args: {}
    })
    h.sender.flushAskAnswers(turn, turn.owner)
    expect(h.payloads('screen')).toHaveLength(1)
    h.requests[0]!.resolve({ publicationId: 'pub-y' })
    await flush()
    expect(
      h
        .payloads('screen')
        .map((p) => p.ev as { type: string; toolRunId?: string; messageKey?: string })
    ).toMatchObject([
      { type: 'tool.call.started', toolRunId: 'y', messageKey: 'a:1' },
      { type: 'tool.call.completed', toolRunId: 'y', messageKey: 'a:1' },
      { type: 'tool.call.started', toolRunId: 'q1', messageKey: 'a:1' },
      { type: 'tool.call.completed', toolRunId: 'q1', messageKey: 'a:1', messageKeySource: 'owner' }
    ])
  })

  it('질문 답의 도구 완료는 화면 이벤트와 답마다 질문 호출의 번호를 싣는다', async () => {
    const h = setup()
    const turn = turnOf({
      dbSessionId: 's',
      askPendingIds: ['q-orig'],
      pendingAskAnswers: [{ toolUseId: 'q-orig', answers: { a: '1' } }]
    })
    h.sender.onTurnEvent(turn, {
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 'q-orig',
      toolName: 'AskUserQuestion',
      args: {}
    })
    h.sender.onTurnEvent(turn, { type: 'telemetry', sessionId: 's' } as NormalizedEvent)
    h.sender.onTurnEvent(turn, delta('next'))
    h.sender.flushAskAnswers(turn, turn.owner)
    const askPayload = h.payloads('turn.askAnswers')[0] as {
      answers: Array<{ messageKey?: string }>
    }
    expect(askPayload.answers[0]?.messageKey).toBe('a:1')
    expect(h.payloads('screen')[0]?.ev).toMatchObject({
      type: 'tool.call.completed',
      toolRunId: 'q-orig',
      messageKey: 'a:1',
      messageKeySource: 'owner'
    })
  })

  it('같은 번호의 완료 이벤트는 번호가 바뀐 첫 delta 보다 먼저 중계된다', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const emit = (ev: NormalizedEvent): void => {
      h.sender.onTurnEvent(turn, ev)
      h.sender.relay(turn, ev)
    }
    emit(delta('part-a'))
    emit({ type: 'message.completed', sessionId: 's', message: { text: 'part-a' } })
    emit({ type: 'telemetry', sessionId: 's' } as NormalizedEvent)
    emit(delta('part-b'))
    const screen = h.payloads('screen').map((p) => p.ev as { type: string; messageKey?: string })
    const idxCompleted = screen.findIndex(
      (e) => e.type === 'message.completed' && e.messageKey === 'a:1'
    )
    const idxNextDelta = screen.findIndex(
      (e) => e.type === 'message.delta' && e.messageKey === 'a:2'
    )
    expect(idxCompleted).toBeGreaterThan(-1)
    expect(idxNextDelta).toBeGreaterThan(idxCompleted)
  })

  it('커밋 통지는 확인 대기 줄 뒤에 서고 두 응답 순서에서 창 순서가 같다', async () => {
    for (const order of ['artifact-first', 'commit-first'] as const) {
      const h = setup()
      const turn = turnOf({
        dbSessionId: 's',
        askPendingIds: ['q'],
        pendingAskAnswers: [{ toolUseId: 'q', answers: { Q: 'ok' } }]
      })
      const emit = (ev: NormalizedEvent): void => {
        h.sender.onTurnEvent(turn, ev)
        h.sender.relay(turn, ev)
      }
      emit({
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 'pub',
        result: JSON.stringify({
          type: `${PRODUCT_SLUG}.artifact.published`,
          version: 1,
          publicationId: 'p1'
        }),
        isError: false
      })
      emit({
        type: 'tool.call.started',
        sessionId: 's',
        toolRunId: 'q',
        toolName: 'AskUserQuestion',
        args: {}
      })
      h.sender.flushAskAnswers(turn, turn.owner)
      const commit = Promise.resolve(
        h.sender.commitUserMessage!(turn, { text: 'steer', createdAt: 2, messageKey: 'u:s1' })
      ).then((id) => {
        h.sender.relay(turn, {
          type: 'message.committed',
          sessionId: 's',
          messageKey: 'u:s1',
          ids: ['s1'],
          messageId: id!,
          text: 'steer',
          createdAt: 2
        })
        emit({ type: 'message.completed', sessionId: 's', message: { text: 'B' } })
      })
      if (order === 'artifact-first') {
        h.requests[0]!.resolve(null)
        await flush()
        h.requests[1]!.resolve({ id: 2, created: true })
        await commit
      } else {
        h.requests[1]!.resolve({ id: 2, created: true })
        await commit
        h.requests[0]!.resolve(null)
        await flush()
      }
      expect(h.payloads('screen').map((p) => (p.ev as { type: string }).type)).toEqual([
        'tool.call.completed',
        'tool.call.started',
        'tool.call.completed',
        'message.committed',
        'message.completed'
      ])
    }
    // Empty queue sends message.committed immediately
    const hEmpty = setup()
    const turnEmpty = turnOf({ dbSessionId: 's' })
    hEmpty.sender.relay(turnEmpty, {
      type: 'message.committed',
      sessionId: 's',
      messageKey: 'u:direct',
      ids: ['direct'],
      messageId: 1,
      text: 'hi',
      createdAt: 1
    })
    expect(hEmpty.payloads('screen')).toHaveLength(1)
  })

  // VP-04 explicit branch symbol tests: k1~k4, k6~k8, k12~k18, k20, k22
  it('k1 stamps each of the 8 part-producing event kinds and keeps the same key in one turn', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const kinds: NormalizedEvent[] = [
      { type: 'message.completed', sessionId: 's', message: { text: 'hi' } },
      { type: 'message.reasoning', sessionId: 's', text: 'r' },
      { type: 'tool.call.started', sessionId: 's', toolRunId: 'c1', toolName: 'Read', args: {} },
      {
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 'c1',
        result: 'ok',
        isError: false
      },
      {
        type: 'response.boundary',
        sessionId: 's',
        boundary: { id: 'rb1', phase: 'begin', kind: 'work' }
      } as NormalizedEvent,
      {
        type: 'subagent.task',
        sessionId: 's',
        toolUseId: 'st1',
        phase: 'settled',
        background: true,
        status: 'completed'
      } as NormalizedEvent,
      {
        type: 'session.compacted',
        sessionId: 's',
        trigger: 'auto',
        preTokens: 1
      } as NormalizedEvent,
      {
        type: 'error',
        sessionId: 's',
        error: { category: 'stream_error', message: 'err', retryable: false }
      }
    ]
    for (const ev of kinds) h.sender.onTurnEvent(turn, ev)
    const keys = h.payloads('turn.event').map((p) => (p.ev as { messageKey?: string }).messageKey)
    expect(keys).toEqual(Array(8).fill('a:1'))
  })

  it('k2 does not stamp non-part non-delta events', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const nonStamped: NormalizedEvent[] = [
      { type: 'telemetry', sessionId: 's' } as NormalizedEvent,
      { type: 'session.updated', sessionId: 's' } as NormalizedEvent,
      {
        type: 'permission.requested',
        sessionId: 's',
        requestId: 'p1',
        toolName: 'Bash',
        args: {}
      } as unknown as NormalizedEvent,
      { type: 'output.captured', sessionId: 's', toolRunId: 't1', output: {} } as NormalizedEvent
    ]
    for (const ev of nonStamped) h.sender.onTurnEvent(turn, ev)
    for (const ev of nonStamped) {
      expect((ev as { messageKey?: string }).messageKey).toBeUndefined()
    }
  })

  it('k3 issues independent keys for two concurrent turns', () => {
    const h = setup()
    const t1 = turnOf({ dbSessionId: 's1' })
    const t2 = turnOf({ dbSessionId: 's2' })
    const e1: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's1',
      message: { text: '1' }
    }
    const e2: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's2',
      message: { text: '2' }
    }
    h.sender.onTurnEvent(t1, e1)
    h.sender.onTurnEvent(t2, e2)
    expect(e1.messageKey).toBe('a:1')
    expect(e2.messageKey).toBe('a:2')
  })

  it('k4 preserves the stamped key across confirmation-queued artifact event and queued relays', async () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const artEv: NormalizedEvent = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'art',
      result: JSON.stringify({
        type: `${PRODUCT_SLUG}.artifact.published`,
        version: 1,
        publicationId: 'p'
      }),
      isError: false
    }
    const followEv: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's',
      message: { text: 'after' }
    }
    h.sender.onTurnEvent(turn, artEv)
    h.sender.relay(turn, artEv)
    h.sender.onTurnEvent(turn, followEv)
    h.sender.relay(turn, followEv)
    h.requests[0]!.resolve(null)
    await flush()
    expect(h.payloads('screen').map((p) => (p.ev as { messageKey?: string }).messageKey)).toEqual([
      'a:1',
      'a:1'
    ])
  })

  it('k6 clears messageKey after telemetry', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const e1: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's',
      message: { text: '1' }
    }
    const e2: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's',
      message: { text: '2' }
    }
    h.sender.onTurnEvent(turn, e1)
    h.sender.onTurnEvent(turn, { type: 'telemetry', sessionId: 's' } as NormalizedEvent)
    h.sender.onTurnEvent(turn, e2)
    expect(e1.messageKey).toBe('a:1')
    expect(e2.messageKey).toBe('a:2')
  })

  it('k7 creates fresh state and new key after finalizeTurn', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const e1: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's',
      message: { text: '1' }
    }
    const e2: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's',
      message: { text: '2' }
    }
    h.sender.onTurnEvent(turn, e1)
    h.sender.finalizeTurn!(turn)
    h.sender.onTurnEvent(turn, e2)
    expect(e1.messageKey).toBe('a:1')
    expect(e2.messageKey).toBe('a:2')
  })

  it('k8 stamps ask answers with call owner key or current key when not in callKeys', () => {
    const h = setup()
    const turn = turnOf({
      dbSessionId: 's',
      askPendingIds: ['q-unseen'],
      pendingAskAnswers: [{ toolUseId: 'q-unseen', answers: { x: '1' } }]
    })
    h.sender.onTurnEvent(turn, delta('hello'))
    h.sender.flushAskAnswers(turn, turn.owner)
    const askPayload = h.payloads('turn.askAnswers')[0] as {
      answers: Array<{ messageKey?: string }>
    }
    expect(askPayload.answers[0]?.messageKey).toBe('a:1')
    expect(h.payloads('screen')[0]?.ev).toMatchObject({
      type: 'tool.call.completed',
      toolRunId: 'q-unseen',
      messageKey: 'a:1'
    })
    expect(
      (h.payloads('screen')[0]?.ev as { messageKeySource?: string }).messageKeySource
    ).toBeUndefined()
  })

  it('k12 attaches late tool.call.completed after B opens back to A callKeys owner', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    h.sender.onTurnEvent(turn, {
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 'x',
      toolName: 'Bash',
      args: {}
    })
    h.sender.onTurnEvent(turn, { type: 'telemetry', sessionId: 's' } as NormalizedEvent)
    const bEv: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's',
      message: { text: 'B' }
    }
    h.sender.onTurnEvent(turn, bEv)
    const lateX: NormalizedEvent = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'x',
      result: 'done',
      isError: false
    }
    h.sender.onTurnEvent(turn, lateX)
    expect(bEv.messageKey).toBe('a:2')
    expect(lateX.messageKey).toBe('a:1')
    expect(lateX.messageKeySource).toBe('owner')
  })

  it('k13 attaches response.boundary end to begin messageKey even across a user commit', async () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const beginEv = {
      type: 'response.boundary',
      sessionId: 's',
      boundary: { id: 'rb-1', phase: 'begin', kind: 'work' }
    } as NormalizedEvent
    h.sender.onTurnEvent(turn, beginEv)
    const commit = h.sender.commitUserMessage!(turn, { text: 'u', createdAt: 1, messageKey: 'u:1' })
    h.requests[0]!.resolve({ id: 1, created: true })
    await commit
    const endEv = {
      type: 'response.boundary',
      sessionId: 's',
      boundary: { id: 'rb-1', phase: 'end', outcome: 'ended' }
    } as NormalizedEvent
    h.sender.onTurnEvent(turn, endEv)
    expect((beginEv as { messageKey?: string }).messageKey).toBe('a:1')
    expect((endEv as { messageKey?: string }).messageKey).toBe('a:1')
    expect((endEv as { messageKeySource?: string }).messageKeySource).toBe('owner')
  })

  it('k14 preserves an existing messageKey on an incoming event', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const preset: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's',
      message: { text: 'preset' },
      messageKey: 'a:preset'
    }
    h.sender.onTurnEvent(turn, preset)
    expect(preset.messageKey).toBe('a:preset')
  })

  it('k15 queues ask answer relay behind pending artifact confirmation in peer order', async () => {
    const h = setup()
    const turn = turnOf({
      dbSessionId: 's',
      askPendingIds: ['q15'],
      pendingAskAnswers: [{ toolUseId: 'q15', answers: { ok: '1' } }]
    })
    const art: NormalizedEvent = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'art15',
      result: JSON.stringify({
        type: `${PRODUCT_SLUG}.artifact.published`,
        version: 1,
        publicationId: 'p15'
      }),
      isError: false
    }
    h.sender.onTurnEvent(turn, art)
    h.sender.relay(turn, art)
    h.sender.flushAskAnswers(turn, turn.owner)
    expect(h.payloads('screen')).toHaveLength(0)
    h.requests[0]!.resolve(null)
    await flush()
    expect(h.payloads('screen').map((p) => (p.ev as { toolRunId?: string }).toolRunId)).toEqual([
      'art15',
      'q15'
    ])
  })

  it('k16 stamps tool.call.completed with unknown toolRunId using current messageKey without owner source', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const ev: NormalizedEvent = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'unknown-call',
      result: 'ok',
      isError: false
    }
    h.sender.onTurnEvent(turn, ev)
    expect(ev.messageKey).toBe('a:1')
    expect(ev.messageKeySource).toBeUndefined()
  })

  it('k17 keeps first callKeys owner on duplicate tool.call.started after B opens', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    h.sender.onTurnEvent(turn, {
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 'dup',
      toolName: 'Bash',
      args: {}
    })
    h.sender.onTurnEvent(turn, { type: 'telemetry', sessionId: 's' } as NormalizedEvent)
    h.sender.onTurnEvent(turn, {
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 'dup',
      toolName: 'Bash',
      args: { retry: true }
    })
    const res: NormalizedEvent = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'dup',
      result: 'ok',
      isError: false
    }
    h.sender.onTurnEvent(turn, res)
    expect(res.messageKey).toBe('a:1')
    expect(res.messageKeySource).toBe('owner')
  })

  it('k18 stamps first text delta with a new key reused by message.completed and resets after telemetry', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const d1 = delta('a')
    const c1: NormalizedEvent = {
      type: 'message.completed',
      sessionId: 's',
      message: { text: 'a' }
    }
    const d2 = delta('b')
    h.sender.onTurnEvent(turn, d1)
    h.sender.onTurnEvent(turn, c1)
    h.sender.onTurnEvent(turn, { type: 'telemetry', sessionId: 's' } as NormalizedEvent)
    h.sender.onTurnEvent(turn, d2)
    expect((d1 as { messageKey?: string }).messageKey).toBe('a:1')
    expect((c1 as { messageKey?: string }).messageKey).toBe('a:1')
    expect((d2 as { messageKey?: string }).messageKey).toBe('a:2')
  })

  it.each(['message.delta', 'message.reasoning.delta'] as const)(
    'preserves a preset %s key and stamps unkeyed deltas with the current message',
    (type) => {
      const h = setup()
      const turn = turnOf({ dbSessionId: 's' })
      const preset = { type, sessionId: 's', delta: { text: 'first' }, messageKey: 'a:upstream' }
      const local: NormalizedEvent = { type, sessionId: 's', delta: { text: 'second' } }
      const done: NormalizedEvent = {
        type: 'message.completed',
        sessionId: 's',
        message: { text: 'third' }
      }
      for (const ev of [preset, local, done]) h.sender.onTurnEvent(turn, ev)
      expect(h.payloads('turn.event').map(({ ev }) => (ev as typeof preset).messageKey)).toEqual([
        'a:upstream',
        'a:1',
        'a:1'
      ])
      expect(done.messageKeySource).toBeUndefined()
    }
  )

  it('k20 sets messageKeySource=owner only for callKeys/boundaryKeys hits and preserves preset source', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    h.sender.onTurnEvent(turn, {
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 't-hit',
      toolName: 'Read',
      args: {}
    })
    const hit: NormalizedEvent = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't-hit',
      result: '1',
      isError: false
    }
    const miss: NormalizedEvent = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't-miss',
      result: '2',
      isError: false
    }
    const preset: NormalizedEvent = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't-hit',
      result: '3',
      isError: false,
      messageKey: 'a:fixed'
    }
    h.sender.onTurnEvent(turn, hit)
    h.sender.onTurnEvent(turn, miss)
    h.sender.onTurnEvent(turn, preset)
    expect(hit.messageKeySource).toBe('owner')
    expect(miss.messageKeySource).toBeUndefined()
    expect(preset.messageKey).toBe('a:fixed')
    expect(preset.messageKeySource).toBeUndefined()
  })

  it('k22 relays A completion before B first delta and handles aborted A without completion', () => {
    const h = setup()
    const turn = turnOf({ dbSessionId: 's' })
    const emit = (ev: NormalizedEvent): void => {
      h.sender.onTurnEvent(turn, ev)
      h.sender.relay(turn, ev)
    }
    emit(delta('a'))
    emit({ type: 'message.completed', sessionId: 's', message: { text: 'a' } })
    emit({ type: 'telemetry', sessionId: 's' } as NormalizedEvent)
    emit(delta('b-aborted'))
    emit({ type: 'telemetry', sessionId: 's' } as NormalizedEvent)
    emit(delta('c'))
    const screen = h.payloads('screen').map((p) => {
      const ev = p.ev as { type: string; messageKey?: string }
      return `${ev.type}:${ev.messageKey ?? ''}`
    })
    expect(screen).toEqual([
      'message.delta:a:1',
      'message.completed:a:1',
      'telemetry:',
      'message.delta:a:2',
      'telemetry:',
      'message.delta:a:3'
    ])
  })
})
