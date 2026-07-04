// chatStore 의 이벤트 라우팅(델타 → live 슬라이스 / 커밋 → reducer / sessionId 키 라우팅)
// 단위 테스트. IPC(window.orca)를 건드리지 않는 경로만 다룬다 — send/loadSession 등 액션과
// session.updated 의 설정 영속화는 통합/시각 검증 영역.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatActions, ingestChatEvent, useChatStore, NEW_CHAT_KEY } from './chatStore'
import { initialChatState } from '../reducer/chatReducer'
import { partsText } from '../lib/parts'
import type { NormalizedEvent } from '../../../../../shared/ipc'

// 코얼레서가 rAF 로 델타를 배칭한다 — 테스트에선 큐에 모았다가 flushRaf() 로 프레임을 흉내낸다.
// (등록 즉시 실행하는 스텁은 코얼레서의 handle 대입 전에 콜백이 돌아 재예약이 막힌다.)
let rafQueue: FrameRequestCallback[] = []
let chatSend: ReturnType<typeof vi.fn>
let settingsSet: ReturnType<typeof vi.fn>
let permissionRespond: ReturnType<typeof vi.fn>
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
  rafQueue.push(cb)
  return rafQueue.length
})
vi.stubGlobal('cancelAnimationFrame', () => {})
const flushRaf = (): void => {
  const q = rafQueue
  rafQueue = []
  for (const cb of q) cb(0)
}

const delta = (text: string, sessionId = 's'): NormalizedEvent => ({
  type: 'message.delta',
  sessionId,
  delta: { text }
})

const reasoningDelta = (text: string): NormalizedEvent => ({
  type: 'message.reasoning.delta',
  sessionId: 's',
  delta: { text }
})

// 활성 키 's' 에 진행 중 턴 엔트리 1개로 초기화.
beforeEach(() => {
  rafQueue = []
  chatSend = vi.fn().mockResolvedValue(undefined)
  settingsSet = vi.fn().mockResolvedValue({})
  permissionRespond = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('window', {
    orca: {
      chat: { send: chatSend, cancel: vi.fn(), onEvent: vi.fn() },
      settings: { set: settingsSet },
      permission: { respond: permissionRespond, setMode: vi.fn() }
    }
  })
  useChatStore.setState(
    {
      sessions: {
        s: {
          session: { ...initialChatState, sessionId: 's', inflight: true, turnStartedAt: 1 },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      },
      activeKey: 's',
      pendingNewChatKey: null,
      newChatQueue: [],
      recentsEpoch: 0,
      concurrencyByProjectId: {}
    },
    true
  )
})

const entry = (
  key = 's'
): { session: typeof initialChatState; live: { text: string; reasoning: string } } =>
  useChatStore.getState().sessions[key]

describe('chatStore — 델타/커밋 라우팅', () => {
  it('message.delta 는 live.text 에만 누적되고 session 슬라이스 identity 는 불변', () => {
    const before = entry().session
    ingestChatEvent(delta('hel'))
    ingestChatEvent(delta('lo'))
    flushRaf()
    expect(entry().live.text).toBe('hello')
    expect(entry().session).toBe(before) // session 구독자(transcript·Composer)는 깨어나지 않는다
  })

  it('reasoning 델타는 live.reasoning 만 갱신 — live.text 와 격리', () => {
    ingestChatEvent(delta('본문'))
    flushRaf()
    const textBefore = entry().live.text
    ingestChatEvent(reasoningDelta('생각'))
    flushRaf()
    expect(entry().live.reasoning).toBe('생각')
    expect(entry().live.text).toBe(textBefore)
  })

  it('message.completed 가 완성본을 커밋하고 live.text 를 비운다', () => {
    ingestChatEvent(delta('스트리'))
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      message: { text: '스트리밍 완성본' }
    })
    expect(entry().live.text).toBe('')
    expect(partsText(entry().session.messages[0].parts)).toBe('스트리밍 완성본')
  })

  it('telemetry 는 잔여 live.text 를 COMMIT_PENDING_TEXT 로 굳히고 live 를 리셋한다', () => {
    ingestChatEvent(delta('잘린 답'))
    ingestChatEvent(reasoningDelta('미완 사고'))
    ingestChatEvent({
      type: 'telemetry',
      sessionId: 's',
      usage: { inputTokens: 10, outputTokens: 5 }
    })
    expect(entry().live).toEqual({ text: '', reasoning: '' })
    expect(entry().session.inflight).toBe(false)
    expect(partsText(entry().session.messages[0].parts)).toBe('잘린 답')
  })

  it('error 는 잔여 라이브 프리뷰를 커밋 없이 버린다(기존 동작 동형)', () => {
    ingestChatEvent(delta('버려질 텍스트'))
    ingestChatEvent({
      type: 'error',
      sessionId: 's',
      error: { category: 'stream_error', message: 'boom', retryable: true }
    })
    expect(entry().live.text).toBe('')
    expect(entry().session.messages).toHaveLength(0)
    expect(entry().session.error?.message).toBe('boom')
  })

  it('비-델타 이벤트는 버퍼를 먼저 flush 한다 — 텍스트→도구 순서 보존', () => {
    ingestChatEvent(delta('먼저 텍스트'))
    ingestChatEvent({
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 't1',
      toolName: 'Bash',
      args: { command: 'ls' }
    })
    expect(entry().live.text).toBe('먼저 텍스트') // 라이브 텍스트는 유지(완성 이벤트가 굳힘)
    expect(entry().session.messages[0].parts[0]).toMatchObject({
      type: 'tool_call',
      toolRunId: 't1'
    })
  })
})

describe('chatStore — 멀티세션 키 라우팅 (handoff 0013)', () => {
  it('비활성 세션의 이벤트는 그 엔트리에 백그라운드 누적되고 활성 엔트리는 불변', () => {
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        bg: {
          session: { ...initialChatState, sessionId: 'bg', inflight: true, turnStartedAt: 1 },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      }
    }))
    const activeBefore = entry('s')
    ingestChatEvent(delta('백그라운드', 'bg'))
    flushRaf()
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 'bg',
      message: { text: '백그라운드 완성' }
    })
    expect(entry('s')).toBe(activeBefore) // 활성 엔트리 identity 불변 — UI 재렌더 0
    expect(partsText(entry('bg').session.messages[0].parts)).toBe('백그라운드 완성')
    expect(useChatStore.getState().activeKey).toBe('s')
  })

  it('session.updated 가 새-채팅 엔트리를 sessionId 키로 승격하고 활성이면 activeKey 추종', () => {
    useChatStore.setState({
      sessions: {
        'draft:a': {
          session: { ...initialChatState, inflight: true, turnStartedAt: 1 },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      },
      activeKey: 'draft:a',
      pendingNewChatKey: 'draft:a',
      newChatQueue: [],
      recentsEpoch: 0,
      concurrencyByProjectId: {}
    })
    ingestChatEvent({
      type: 'session.updated',
      sessionId: 'fresh',
      patch: {}
    })
    const st = useChatStore.getState()
    expect(st.sessions['draft:a']).toBeUndefined()
    expect(st.sessions.fresh.session.sessionId).toBe('fresh')
    expect(st.activeKey).toBe('fresh')
    expect(st.recentsEpoch).toBe(1)
  })

  it('미지 sessionId 의 늦은 이벤트(엔트리 삭제 후)는 폐기된다', () => {
    const before = useChatStore.getState()
    ingestChatEvent(delta('유령', 'ghost'))
    flushRaf()
    expect(useChatStore.getState().sessions).toEqual(before.sessions)
  })

  it('sessionId 없는 error 이벤트는 활성 엔트리로 폴백한다', () => {
    ingestChatEvent({
      type: 'error',
      error: { category: 'provider_connection_error', message: '활성 백엔드 없음', retryable: true }
    })
    expect(entry('s').session.error?.message).toBe('활성 백엔드 없음')
  })

  // 비활성 세션 소유 권한 요청이 활성으로 새지 않는다(권한 이벤트 sessionId 누락 회귀).
  // permission.requested 가 sessionId 를 실으면 receive 가 소유 엔트리로 라우팅하고,
  // pendingAsks/pendingPlanReview 는 세션-단위라 활성 세션 카드/우측패널은 불변이다.
  it('비활성 세션의 permission.requested(ask)는 그 엔트리 pendingAsks 로 가고 활성은 불변', () => {
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        bg: {
          session: { ...initialChatState, sessionId: 'bg', inflight: true, turnStartedAt: 1 },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      }
    }))
    ingestChatEvent({
      type: 'permission.requested',
      sessionId: 'bg',
      approvalId: 'ask-1',
      origin: 'agent',
      action: {
        kind: 'ask_question',
        request: { requestId: 'ask-1', questions: [] }
      }
    })
    expect(entry('bg').session.pendingAsks.map((a) => a.requestId)).toEqual(['ask-1'])
    expect(entry('s').session.pendingAsks).toEqual([])
    expect(useChatStore.getState().activeKey).toBe('s')
  })

  it('비활성 세션의 permission.requested(plan_review)는 그 엔트리 plan 상태로만 라우팅된다', () => {
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        bg: {
          session: { ...initialChatState, sessionId: 'bg', inflight: true, turnStartedAt: 1 },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      }
    }))
    ingestChatEvent({
      type: 'permission.requested',
      sessionId: 'bg',
      approvalId: 'plan-1',
      origin: 'agent',
      action: {
        kind: 'plan_review',
        request: { requestId: 'plan-1', plan: '# 백그라운드 계획' }
      }
    })
    expect(entry('bg').session.planContent).toBe('# 백그라운드 계획')
    expect(entry('bg').session.pendingPlanReview?.requestId).toBe('plan-1')
    expect(entry('s').session.planContent).toBeNull()
    expect(entry('s').session.pendingPlanReview).toBeNull()
  })
})

describe('chatStore — 0040 새-채팅 직렬 디스패치 게이트', () => {
  function mockDraftIds(...ids: string[]): void {
    let i = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => (ids[i++] ?? `id-${i}`) as `${string}-${string}-${string}-${string}-${string}`
    )
  }

  beforeEach(() => {
    useChatStore.setState(
      {
        sessions: {
          [NEW_CHAT_KEY]: {
            session: { ...initialChatState },
            live: { text: '', reasoning: '' },
            subagentMeta: {}
          }
        },
        activeKey: NEW_CHAT_KEY,
        pendingNewChatKey: null,
        newChatQueue: [],
        recentsEpoch: 0,
        concurrencyByProjectId: {}
      },
      true
    )
  })

  it('pending cwd 는 첫 전송 payload 에 스냅샷되고 다음 새 대화는 default 로 리셋된다', () => {
    mockDraftIds('a')
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        [NEW_CHAT_KEY]: {
          ...s.sessions[NEW_CHAT_KEY],
          session: { ...s.sessions[NEW_CHAT_KEY].session, cwd: '/repo/custom' }
        }
      }
    }))

    expect(chatActions.send('첫 번째')).toBe(true)

    const st = useChatStore.getState()
    expect(chatSend).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/repo/custom' }))
    expect(st.sessions['draft:a'].session.cwd).toBe('/repo/custom')
    expect(st.sessions[NEW_CHAT_KEY].session.cwd).toBeNull()
  })

  it('새-채팅 A 미승격 상태에서 B 전송은 화면 draft 로 보존하고 main dispatch 는 큐잉한다', () => {
    mockDraftIds('a', 'b')
    expect(chatActions.send('첫 번째')).toBe(true)
    chatActions.newChat()
    expect(chatActions.send('두 번째')).toBe(true)

    const st = useChatStore.getState()
    expect(chatSend).toHaveBeenCalledTimes(1)
    expect(chatSend).toHaveBeenLastCalledWith(expect.objectContaining({ text: '첫 번째' }))
    expect(st.pendingNewChatKey).toBe('draft:a')
    expect(st.newChatQueue.map((item) => item.key)).toEqual(['draft:b'])
    expect(partsText(st.sessions['draft:a'].session.messages[0].parts)).toBe('첫 번째')
    expect(partsText(st.sessions['draft:b'].session.messages[0].parts)).toBe('두 번째')
    expect(st.activeKey).toBe('draft:b')
  })

  it('session.updated 는 pending draft 만 승격하고 다음 draft 를 snapshot payload 로 FIFO dispatch 한다', () => {
    mockDraftIds('a', 'b')
    chatActions.send('첫 번째')
    chatActions.newChat()
    chatActions.send('두 번째')

    ingestChatEvent({ type: 'session.updated', sessionId: 's-a', patch: {} })

    const st = useChatStore.getState()
    expect(st.sessions['draft:a']).toBeUndefined()
    expect(st.sessions['s-a'].session.sessionId).toBe('s-a')
    expect(st.pendingNewChatKey).toBe('draft:b')
    expect(st.newChatQueue).toEqual([])
    expect(st.activeKey).toBe('draft:b')
    expect(st.recentsEpoch).toBe(1)
    expect(chatSend).toHaveBeenCalledTimes(2)
    expect(chatSend).toHaveBeenNthCalledWith(2, expect.objectContaining({ text: '두 번째' }))
  })

  it('n개 연속 새-채팅을 순서대로 하나씩 dispatch 하고 모두 승격한다', () => {
    mockDraftIds('a', 'b', 'c')
    chatActions.send('A')
    chatActions.newChat()
    chatActions.send('B')
    chatActions.newChat()
    chatActions.send('C')
    expect(chatSend).toHaveBeenCalledTimes(1)
    expect(useChatStore.getState().newChatQueue.map((item) => item.key)).toEqual([
      'draft:b',
      'draft:c'
    ])

    ingestChatEvent({ type: 'session.updated', sessionId: 's-a', patch: {} })
    ingestChatEvent({ type: 'session.updated', sessionId: 's-b', patch: {} })
    ingestChatEvent({ type: 'session.updated', sessionId: 's-c', patch: {} })

    const st = useChatStore.getState()
    expect(chatSend).toHaveBeenCalledTimes(3)
    expect(st.pendingNewChatKey).toBeNull()
    expect(st.newChatQueue).toEqual([])
    expect(
      ['s-a', 's-b', 's-c'].map((key) => partsText(st.sessions[key].session.messages[0].parts))
    ).toEqual(['A', 'B', 'C'])
  })

  it('init 전 sessionId 없는 error 는 pending draft 에 라우팅하고 큐를 진행한다', () => {
    mockDraftIds('a', 'b')
    chatActions.send('A')
    chatActions.newChat()
    chatActions.send('B')

    ingestChatEvent({
      type: 'error',
      error: { category: 'stream_error', message: 'pre-init boom', retryable: true }
    })

    const st = useChatStore.getState()
    expect(st.sessions['draft:a'].session.error?.message).toBe('pre-init boom')
    expect(st.pendingNewChatKey).toBe('draft:b')
    expect(st.newChatQueue).toEqual([])
    expect(chatSend).toHaveBeenCalledTimes(2)
    expect(chatSend).toHaveBeenNthCalledWith(2, expect.objectContaining({ text: 'B' }))
  })

  it('pending draft cancel 은 gate 를 해제하지 않고 실제 terminal 수신 때 큐를 진행한다', () => {
    mockDraftIds('a', 'b')
    chatActions.send('A')
    chatActions.newChat()
    chatActions.send('B')
    useChatStore.setState({ activeKey: 'draft:a' })

    chatActions.cancel()
    expect(useChatStore.getState().pendingNewChatKey).toBe('draft:a')
    expect(chatSend).toHaveBeenCalledTimes(1)

    ingestChatEvent({
      type: 'turn.aborted',
      reason: 'user_cancelled'
    })
    expect(useChatStore.getState().pendingNewChatKey).toBe('draft:b')
    expect(chatSend).toHaveBeenCalledTimes(2)
  })

  it('대기 draft cancel 은 큐와 엔트리만 제거하고 main dispatch 를 늘리지 않는다', () => {
    mockDraftIds('a', 'b')
    chatActions.send('A')
    chatActions.newChat()
    chatActions.send('B')

    chatActions.cancel()

    const st = useChatStore.getState()
    expect(st.sessions['draft:b']).toBeUndefined()
    expect(st.activeKey).toBe(NEW_CHAT_KEY)
    expect(st.pendingNewChatKey).toBe('draft:a')
    expect(st.newChatQueue).toEqual([])
    expect(chatSend).toHaveBeenCalledTimes(1)
  })

  it('이미 존재하는 session.updated 는 pending draft 를 승격하지 않는다', () => {
    mockDraftIds('a')
    chatActions.send('A')
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        existing: {
          session: { ...initialChatState, sessionId: 'existing' },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      }
    }))

    ingestChatEvent({ type: 'session.updated', sessionId: 'existing', patch: {} })

    const st = useChatStore.getState()
    expect(st.pendingNewChatKey).toBe('draft:a')
    expect(st.sessions['draft:a']).toBeDefined()
    expect(st.recentsEpoch).toBe(0)
  })
})

describe('chatStore — 0064 r4 핸드오프 에코 순서', () => {
  const userMsg = (
    text: string,
    createdAt: number
  ): (typeof initialChatState)['messages'][number] => ({
    role: 'user',
    createdAt,
    parts: [{ type: 'text', text }]
  })
  const assistantMsg = (
    text: string,
    createdAt: number
  ): (typeof initialChatState)['messages'][number] => ({
    role: 'assistant',
    createdAt,
    parts: [{ type: 'text', text }]
  })

  it('조기 에코(sessionId 없는 message.user)가 pending draft 에 커밋되고 압축 요약보다 앞선다', () => {
    // 확정 세션 s(사용자 턴 2회, 턴 비진행) — startHandoff 가드 통과 상태.
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        s: {
          ...st.sessions.s,
          session: {
            ...st.sessions.s.session,
            inflight: false,
            turnStartedAt: null,
            messages: [userMsg('q1', 1), assistantMsg('a1', 2), userMsg('q2', 3)]
          }
        }
      }
    }))

    expect(chatActions.startHandoff()).toBe(true)
    const draftKey = useChatStore.getState().pendingNewChatKey!
    expect(draftKey).toMatch(/^draft:/)
    expect(chatSend).toHaveBeenCalledWith(expect.objectContaining({ handoffFrom: 's' }))

    // main 은 send 수리 직후(턴 시작 전, sessionId 미발급) 에코를 발행한다(r4).
    ingestChatEvent({
      type: 'message.user',
      text: '/compact [핸드오프] 자동 메시지',
      createdAt: 10
    })
    expect(partsText(entry(draftKey).session.messages[0].parts)).toBe(
      '/compact [핸드오프] 자동 메시지'
    )

    // 이후 SDK 이벤트가 어떤 순서로 오든 user 버블이 항상 요약보다 앞이다.
    ingestChatEvent({ type: 'session.updated', sessionId: 'ho', patch: {} })
    ingestChatEvent({ type: 'session.compacted', sessionId: 'ho', trigger: 'manual' })
    ingestChatEvent({ type: 'message.completed', sessionId: 'ho', message: { text: '압축 요약' } })
    ingestChatEvent({ type: 'telemetry', sessionId: 'ho' })

    const msgs = entry('ho').session.messages
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(partsText(msgs[0].parts)).toBe('/compact [핸드오프] 자동 메시지')
    expect(msgs[1].parts.map((p) => p.type)).toEqual(['compact_boundary', 'text'])
    expect(entry('ho').session.inflight).toBe(false)
  })

  it('승격이 늦어 요약이 폴백 라우팅돼도 draft 안에서 [user 에코 → 요약] 순서가 유지된다', () => {
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        s: {
          ...st.sessions.s,
          session: {
            ...st.sessions.s.session,
            inflight: false,
            turnStartedAt: null,
            messages: [userMsg('q1', 1), assistantMsg('a1', 2), userMsg('q2', 3)]
          }
        }
      }
    }))
    chatActions.startHandoff()
    const draftKey = useChatStore.getState().pendingNewChatKey!

    ingestChatEvent({ type: 'message.user', text: '/compact 에코', createdAt: 10 })
    // init(session.updated) 이 오기 전에 요약이 먼저 도착하는 병리적 순서 — entry 없는
    // sessionId 라 pending draft 로 폴백 라우팅되지만 에코 뒤에 붙는다.
    ingestChatEvent({ type: 'message.completed', sessionId: 'late', message: { text: '요약' } })
    ingestChatEvent({ type: 'session.updated', sessionId: 'late', patch: {} })

    const msgs = entry('late').session.messages
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(partsText(msgs[0].parts)).toBe('/compact 에코')
    expect(partsText(msgs[1].parts)).toBe('요약')
    expect(useChatStore.getState().sessions[draftKey]).toBeUndefined()
  })
})

describe('chatStore — 0064 r4 continuity draft nav', () => {
  const seedForkableSource = (): void => {
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        s: {
          ...st.sessions.s,
          session: {
            ...st.sessions.s.session,
            inflight: false,
            turnStartedAt: null,
            title: '원본 세션',
            messages: [
              { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q' }] },
              { role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'a' }] }
            ]
          }
        }
      }
    }))
  }

  it('startForkDraft 는 draft 를 즉시 만들고, 같은 부모의 이전 미전송 draft 를 교체한다', () => {
    seedForkableSource()
    expect(chatActions.startForkDraft()).toBe(true)
    const firstKey = useChatStore.getState().activeKey
    expect(firstKey).toMatch(/^draft:/)
    expect(useChatStore.getState().sessions[firstKey].session.title).toBe('[분기] 원본 세션')
    // 프리필 이력 끝에 '분기된 지점' 구분선 합성(r5) — 물질화 영속분(fork_boundary)과 위치 일치.
    const draftMsgs = useChatStore.getState().sessions[firstKey].session.messages
    expect(draftMsgs).toHaveLength(3)
    expect(draftMsgs[2].parts).toEqual([{ type: 'fork_boundary' }])

    // 부모로 돌아가 다시 fork — 이전 미전송 draft 는 교체 정리된다(중복 nav 행 방지).
    useChatStore.setState({ activeKey: 's' })
    expect(chatActions.startForkDraft()).toBe(true)
    const secondKey = useChatStore.getState().activeKey
    expect(secondKey).not.toBe(firstKey)
    expect(useChatStore.getState().sessions[firstKey]).toBeUndefined()
    expect(useChatStore.getState().sessions[secondKey]).toBeDefined()
  })

  it('다른 세션으로 이탈해도 draft 는 살아남고(nav 행 유지), activate 로 복귀한다', () => {
    seedForkableSource()
    chatActions.startForkDraft()
    const draftKey = useChatStore.getState().activeKey

    // 다른 확정 세션으로 전환(구 r2 는 여기서 prune — r4 부터 보존).
    void chatActions.loadSession('s')
    expect(useChatStore.getState().activeKey).toBe('s')
    expect(useChatStore.getState().sessions[draftKey]).toBeDefined()

    expect(chatActions.activateContinuityDraft(draftKey)).toBe('s')
    expect(useChatStore.getState().activeKey).toBe(draftKey)
  })

  it('discardContinuityDraft — 활성 draft 삭제 시 부모 엔트리로 복귀, pending 중엔 거부', () => {
    seedForkableSource()
    chatActions.startForkDraft()
    const draftKey = useChatStore.getState().activeKey

    expect(chatActions.discardContinuityDraft(draftKey)).toBe(true)
    expect(useChatStore.getState().sessions[draftKey]).toBeUndefined()
    expect(useChatStore.getState().activeKey).toBe('s')

    // 전송 진행(pending) 중인 handoff draft 는 삭제 거부 — 승격 게이트 보호.
    seedForkableSource()
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        'draft:pending': {
          session: { ...initialChatState, handoffFrom: 's', inflight: true, turnStartedAt: 1 },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      },
      pendingNewChatKey: 'draft:pending'
    }))
    expect(chatActions.discardContinuityDraft('draft:pending')).toBe(false)
    expect(useChatStore.getState().sessions['draft:pending']).toBeDefined()
  })
})

describe('chatStore — 계획 거부(rejectPlan)', () => {
  beforeEach(() => {
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        s: {
          ...st.sessions.s,
          session: {
            ...st.sessions.s.session,
            pendingPlanReview: { requestId: 'rid', plan: '# 계획' }
          }
        }
      }
    }))
  })

  it('clean deny(interrupt 없음)로 응답해 deny 가 모델에 전달되게 한다', () => {
    chatActions.rejectPlan('rid')
    expect(permissionRespond).toHaveBeenCalledTimes(1)
    expect(permissionRespond).toHaveBeenCalledWith({
      approvalId: 'rid',
      resolution: { behavior: 'deny' }
    })
  })

  it('RESOLVE_PLAN 으로 카드를 닫되 inflight 는 유지(턴 자연 종료)', () => {
    expect(entry().session.inflight).toBe(true)
    chatActions.rejectPlan('rid')
    // 카드/코멘트는 비우고, 턴은 abort 하지 않아 모델이 거부를 인지하고 응답할 수 있다.
    expect(entry().session.pendingPlanReview).toBeNull()
    expect(entry().session.inflight).toBe(true)
  })
})

describe('chatStore — steer feedback lifecycle', () => {
  it('steer.queued 는 pending 버블만 만들고 committed message 로 승격하지 않는다', () => {
    ingestChatEvent({
      type: 'steer.queued',
      sessionId: 's',
      id: 'q1',
      text: '추가 피드백',
      createdAt: 10
    })
    expect(entry().session.messages).toHaveLength(0)
    expect(useChatStore.getState().sessions.s.pendingSteer?.map((item) => item.id)).toEqual(['q1'])
  })

  it('steer.flushed 는 즉시 일반 user 메시지로 커밋하고 pending 을 비운다', () => {
    ingestChatEvent({
      type: 'steer.queued',
      sessionId: 's',
      id: 'q1',
      text: '추가 피드백',
      createdAt: 10
    })
    ingestChatEvent({
      type: 'steer.flushed',
      sessionId: 's',
      ids: ['q1'],
      text: '추가 피드백',
      messageId: 7,
      createdAt: 10
    })

    expect(entry().session.messages.map((m) => m.role)).toEqual(['user'])
    expect(partsText(entry().session.messages[0].parts)).toBe('추가 피드백')
    expect(useChatStore.getState().sessions.s.pendingSteer).toEqual([])
  })

  it('idle 세션 send 는 잔여 pendingSteer 를 새 메시지보다 앞서 로컬 커밋한다(0060 D2 carryover)', () => {
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        s: {
          ...s.sessions.s,
          session: { ...s.sessions.s.session, inflight: false },
          pendingSteer: [
            { id: 'a', text: 'first', createdAt: 5 },
            { id: 'b', text: 'second', createdAt: 6 }
          ]
        }
      }
    }))

    expect(chatActions.send('새 메시지')).toBe(true)

    const st = useChatStore.getState()
    // main 은 이 send 에서 steer row 를 앞에 영속하고 steer.flushed 를 보내지 않는다 —
    // renderer 로컬 커밋이 [steer 병합][새 메시지] 순서를 만든다(재로드 정렬과 일치).
    expect(st.sessions.s.pendingSteer).toEqual([])
    const msgs = st.sessions.s.session.messages
    expect(msgs.map((m) => m.role)).toEqual(['user', 'user'])
    expect(partsText(msgs[0].parts)).toBe('first\n\nsecond')
    expect(partsText(msgs[1].parts)).toBe('새 메시지')
    // 프롬프트 병합은 main 책임 — renderer payload 는 타이핑 텍스트 그대로.
    expect(chatSend).toHaveBeenCalledWith(expect.objectContaining({ text: '새 메시지' }))
  })

  it('응답-전 → flush → 응답-후 순서로 [assistant][user steer][assistant] 를 형성한다', () => {
    // echo 시맨틱(0060 D1): 소비 확정(steer.flushed)은 직전 응답 message.completed 뒤에 온다.
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      message: { text: '응답-전' }
    })
    ingestChatEvent({
      type: 'steer.flushed',
      sessionId: 's',
      ids: ['q1'],
      text: '추가 피드백',
      messageId: 7,
      createdAt: 10
    })
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      message: { text: '응답-후' }
    })

    expect(entry().session.messages.map((m) => m.role)).toEqual(['assistant', 'user', 'assistant'])
    expect(partsText(entry().session.messages[0].parts)).toBe('응답-전')
    expect(partsText(entry().session.messages[1].parts)).toBe('추가 피드백')
    expect(partsText(entry().session.messages[2].parts)).toBe('응답-후')
    expect(useChatStore.getState().sessions.s.pendingSteer).toEqual([])
  })
})
