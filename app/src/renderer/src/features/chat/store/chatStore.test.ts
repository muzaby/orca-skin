// chatStore 의 이벤트 라우팅(델타 → live 슬라이스 / 커밋 → reducer / sessionId 키 라우팅)
// 단위 테스트. IPC(window.orca)를 건드리지 않는 경로만 다룬다 — send/loadSession 등 액션과
// session.updated 의 설정 영속화는 통합/시각 검증 영역.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bootstrapChat,
  chatActions,
  ingestChatEvent,
  useChatStore,
  NEW_CHAT_KEY
} from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'
import { DEFAULT_DIFF_VIEW, initialChatState } from '../reducer/chatReducer'
import { partsText } from '../lib/parts'
import type { DiffRequirementItem, NormalizedEvent } from '../../../../../shared/ipc'

let chatSend: ReturnType<typeof installChatStoreHarness>['chatSend']
let settingsSet: ReturnType<typeof installChatStoreHarness>['settingsSet']
let permissionRespond: ReturnType<typeof installChatStoreHarness>['permissionRespond']

const delta = (text: string, sessionId = 's'): NormalizedEvent => ({
  type: 'message.delta',
  sessionId,
  delta: { text }
})

const reasoningDelta = (text: string, sessionId = 's'): NormalizedEvent => ({
  type: 'message.reasoning.delta',
  sessionId,
  delta: { text }
})

const requirement = (id: string, sessionId = 's'): DiffRequirementItem => ({
  id,
  located: true,
  anchor: {
    sessionId,
    baselineCommit: 'base-oid',
    filePath: 'src/a.ts',
    oldLine: null,
    newLine: 2,
    hunkHeader: '@@ -1,2 +1,3 @@',
    contextBefore: ['before'],
    contextAfter: ['after'],
    comment: `comment ${id}`,
    createdAt: 10
  }
})

// 활성 키 's' 에 진행 중 턴 엔트리 1개로 초기화(하네스는 chatStore.testHarness 공용, 0149).
beforeEach(() => {
  ;({ chatSend, settingsSet, permissionRespond } = installChatStoreHarness({
    inflight: true,
    turnStartedAt: 1
  }))
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

  it('한 프레임의 혼합·멀티세션 delta를 store notification 1회로 반영한다', () => {
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        bg: {
          session: { ...initialChatState, sessionId: 'bg' },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      }
    }))
    let notifications = 0
    const unsubscribe = useChatStore.subscribe(() => {
      notifications += 1
    })

    ingestChatEvent(delta('본문'))
    ingestChatEvent(reasoningDelta('사고'))
    ingestChatEvent(delta('배경', 'bg'))
    flushRaf()
    unsubscribe()

    expect(notifications).toBe(1)
    expect(entry('s').live).toEqual({ text: '본문', reasoning: '사고' })
    expect(entry('bg').live.text).toBe('배경')
    expect(entry('bg').session.inflight).toBe(true)
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
  it('git snapshot 액션은 활성 세션 엔트리만 바꾼다', () => {
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        bg: {
          session: { ...initialChatState, sessionId: 'bg' },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      }
    }))
    chatActions.setDiffComparison({ kind: 'commit', sha: 'abc1234' })
    chatActions.toggleDiffFileExpanded('src/a.ts')

    expect(entry('s').session.gitSnapshot).toMatchObject({
      comparison: { kind: 'commit', sha: 'abc1234' },
      expandedFiles: ['src/a.ts']
    })
    // 다른 세션 엔트리는 손대지 않는다 — 활성 키만 바뀐다.
    expect(entry('bg').session.gitSnapshot).toEqual({
      summary: null,
      patch: null,
      comparison: { kind: 'all' },
      expandedFiles: [],
      sidebarVisible: false,
      view: DEFAULT_DIFF_VIEW
    })
  })

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
    // 0067: 새-채팅 send() 는 UUID 를 [draftKey, clientRequestId] 순서로 2회 소비한다 —
    // 짝수 번째 호출(draftKey)에만 지정 id 를 먹여 'draft:a' 류 기대값을 유지한다.
    let call = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      const isDraftKey = call % 2 === 0
      const id = isDraftKey ? (ids[call / 2] ?? `id-${call}`) : `req-${call}`
      call += 1
      return id as `${string}-${string}-${string}-${string}-${string}`
    })
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
        concurrencyByProjectId: {},
        draftRestore: null
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
    // 턴-시작 낙관 커밋(0068) — 첫 메시지는 즉시 정식 user 버블(pending 항목 아님).
    expect(partsText(st.sessions['draft:a'].session.messages[0].parts)).toBe('첫 번째')
    expect(partsText(st.sessions['draft:b'].session.messages[0].parts)).toBe('두 번째')
    expect(st.sessions['draft:a'].pendingSteer).toEqual([])
    expect(st.sessions['draft:b'].pendingSteer).toEqual([])
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
    // 낙관 커밋 버블(0068)이 승격된 엔트리를 따라간다(엔트리 객체 동일성 보존).
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

describe('chatStore — diff 요구사항 전송 스냅샷', () => {
  beforeEach(() => {
    ;({ chatSend, settingsSet, permissionRespond } = installChatStoreHarness({
      inflight: false,
      turnStartedAt: null
    }))
  })

  it('send payload에는 wrapper가 아니라 anchors만 들어간다', () => {
    const dirtyRequirement = {
      ...requirement('req-1'),
      anchor: {
        ...requirement('req-1').anchor,
        located: true,
        extra: 'must not cross the wire'
      }
    } as DiffRequirementItem
    chatActions.addDiffRequirement(dirtyRequirement)
    const snapshot = chatActions.captureDiffRequirementSnapshot()

    expect(chatActions.send('요구사항 반영', [], [], snapshot.anchors)).toBe(true)

    const payload = chatSend.mock.calls[0][0] as { requirements?: unknown[] }
    expect(payload.requirements).toEqual([requirement('req-1').anchor])
    expect(Object.keys(payload.requirements![0] as Record<string, unknown>)).toEqual([
      'sessionId',
      'baselineCommit',
      'filePath',
      'oldLine',
      'newLine',
      'hunkHeader',
      'contextBefore',
      'contextAfter',
      'comment',
      'createdAt'
    ])
    expect(payload.requirements![0]).not.toHaveProperty('located')
    expect(payload.requirements![0]).not.toHaveProperty('extra')
  })

  it('async submit 뒤 active session이 바뀌었으면 이전 session anchor 전송을 거부한다', () => {
    chatActions.addDiffRequirement(requirement('req-1', 's'))
    const snapshot = chatActions.captureDiffRequirementSnapshot()
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        other: {
          session: { ...initialChatState, sessionId: 'other', inflight: false },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      },
      activeKey: 'other'
    }))

    expect(chatActions.send('요구사항 반영', [], [], snapshot.anchors)).toBe(false)
    expect(chatSend).not.toHaveBeenCalled()
    expect(useChatStore.getState().sessions.other.session.messages).toEqual([])
  })

  it('성공한 submit snapshot만 그대로면 비우고 false submit은 보존한다', () => {
    chatActions.addDiffRequirement(requirement('req-1'))
    const snapshot = chatActions.captureDiffRequirementSnapshot()

    chatActions.clearDiffRequirementsIfUnchanged(snapshot)
    expect(entry().session.diffRequirements.map((item) => item.id)).toEqual([])

    chatActions.addDiffRequirement(requirement('req-2'))
    const rejected = chatActions.captureDiffRequirementSnapshot()
    expect(chatActions.send('   ', [], [], rejected.anchors)).toBe(false)
    expect(entry().session.diffRequirements.map((item) => item.id)).toEqual(['req-2'])
  })

  it('전송 중 추가·삭제·수정·재anchor가 revision을 바꾸면 late clear가 현재 stack을 지우지 못한다', () => {
    chatActions.addDiffRequirement(requirement('req-1'))
    const snapshot = chatActions.captureDiffRequirementSnapshot()

    chatActions.addDiffRequirement(requirement('req-2'))
    chatActions.clearDiffRequirementsIfUnchanged(snapshot)
    expect(entry().session.diffRequirements.map((item) => item.id)).toEqual(['req-1', 'req-2'])

    chatActions.removeDiffRequirement('req-2')
    // 0211 ΔV4 — 재anchor 는 **패치 도착**이 계기다(D-093). 별도 body 요청 등록이 없다.
    chatActions.beginGitSnapshotQuery({ key: 'k', generation: 2 })
    chatActions.receiveGitPatch(
      { key: 'k', generation: 2 },
      {
        isRepo: true,
        base: { kind: 'worktree-base', oid: 'base-oid', ref: 'main' },
        files: [
          {
            path: 'src/a.ts',
            status: 'modified',
            added: 1,
            removed: 0,
            kind: 'text',
            lines: [
              { type: 'added', oldLine: null, newLine: 2, text: 'target without saved context' }
            ]
          }
        ],
        filesTruncated: false,
        contextLimited: false,
        unavailable: false
      },
      { kind: 'all' }
    )
    chatActions.clearDiffRequirementsIfUnchanged({
      ...snapshot,
      revision: entry().session.diffRequirementsRevision - 1
    })
    expect(entry().session.diffRequirements).toHaveLength(1)
    expect(entry().session.diffRequirements[0].located).toBe(false)

    chatActions.setDiffRequirementDraft({
      key: 'src/a.ts:null:2',
      filePath: 'src/a.ts',
      oldLine: null,
      newLine: 2,
      body: 'draft'
    })
    const afterDraft = chatActions.captureDiffRequirementSnapshot()
    chatActions.setDiffRequirementDraft({
      key: 'src/a.ts:null:2',
      filePath: 'src/a.ts',
      oldLine: null,
      newLine: 2,
      body: 'edited draft'
    })
    chatActions.clearDiffRequirementsIfUnchanged(afterDraft)
    expect(entry().session.diffRequirementDraft?.body).toBe('edited draft')
  })

  it('clear helper routes by the captured session slot, not rediscovered current/session id', () => {
    chatActions.addDiffRequirement(requirement('req-1', 's'))
    const snapshot = chatActions.captureDiffRequirementSnapshot()
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        s: {
          ...state.sessions.s,
          session: {
            ...state.sessions.s.session,
            sessionId: 'renamed',
            diffRequirements: [requirement('req-original', 'renamed')]
          }
        },
        other: {
          session: {
            ...initialChatState,
            sessionId: 's',
            diffRequirements: [requirement('req-other', 's')],
            diffRequirementsRevision: 1
          },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      },
      activeKey: 'other'
    }))

    chatActions.clearDiffRequirementsIfUnchanged(snapshot)

    expect(useChatStore.getState().sessions.s.session.diffRequirements).toEqual([
      requirement('req-original', 'renamed')
    ])
    expect(useChatStore.getState().sessions.other.session.diffRequirements).toEqual([
      requirement('req-other', 's')
    ])
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

  it('자동 메시지가 pending(message.queued)으로 서고 echo 커밋(committed)이 요약보다 앞선다', () => {
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
    expect(chatSend).toHaveBeenCalledWith(
      expect.objectContaining({ handoffFrom: 's', clientKey: draftKey })
    )

    // main 은 enqueue 직후(턴 시작 전, sessionId 미발급) pending 등록을 발행한다(0067).
    ingestChatEvent({
      type: 'message.queued',
      id: 'auto-1',
      text: '/compact [핸드오프] 자동 메시지',
      createdAt: 10
    })
    expect(useChatStore.getState().sessions[draftKey].pendingSteer?.map((i) => i.text)).toEqual([
      '/compact [핸드오프] 자동 메시지'
    ])

    // 스트림 순서: init → echo 커밋(committed, main 이 요약 전에 발신) → 압축 경계 → 요약.
    ingestChatEvent({ type: 'session.updated', sessionId: 'ho', patch: {} })
    ingestChatEvent({
      type: 'message.committed',
      sessionId: 'ho',
      ids: ['auto-1'],
      text: '/compact [핸드오프] 자동 메시지',
      messageId: 1,
      createdAt: 10
    })
    ingestChatEvent({ type: 'session.compacted', sessionId: 'ho', trigger: 'manual' })
    ingestChatEvent({ type: 'message.completed', sessionId: 'ho', message: { text: '압축 요약' } })
    ingestChatEvent({ type: 'telemetry', sessionId: 'ho' })

    const msgs = entry('ho').session.messages
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(partsText(msgs[0].parts)).toBe('/compact [핸드오프] 자동 메시지')
    expect(msgs[1].parts.map((p) => p.type)).toEqual(['compact_boundary', 'text'])
    expect(entry('ho').session.inflight).toBe(false)
    expect(useChatStore.getState().sessions.ho.pendingSteer).toEqual([])
  })

  it('승격이 늦어 committed/요약이 폴백 라우팅돼도 draft 안에서 [user → 요약] 순서가 유지된다', () => {
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

    ingestChatEvent({ type: 'message.queued', id: 'auto-1', text: '/compact 에코', createdAt: 10 })
    // init(session.updated) 전에 committed/요약이 먼저 도착하는 병리적 순서 — entry 없는
    // sessionId 라 pending draft 로 폴백 라우팅되지만 [user → 요약] 순서는 보존된다.
    ingestChatEvent({
      type: 'message.committed',
      sessionId: 'late',
      ids: ['auto-1'],
      text: '/compact 에코',
      messageId: 1,
      createdAt: 10
    })
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

describe('chatStore — pending message lifecycle (0067)', () => {
  it('message.queued 는 pending 버블만 만들고 committed message 로 승격하지 않는다', () => {
    ingestChatEvent({
      type: 'message.queued',
      sessionId: 's',
      id: 'q1',
      text: '추가 피드백',
      createdAt: 10
    })
    expect(entry().session.messages).toHaveLength(0)
    expect(useChatStore.getState().sessions.s.pendingSteer?.map((item) => item.id)).toEqual(['q1'])
  })

  it('message.committed(echo 커밋)는 일반 user 메시지로 승격하고 pending 을 비운다', () => {
    ingestChatEvent({
      type: 'message.queued',
      sessionId: 's',
      id: 'q1',
      text: '추가 피드백',
      createdAt: 10
    })
    ingestChatEvent({
      type: 'message.committed',
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

  it('idle 세션 send 는 낙관 커밋 — 정식 user 버블 즉시 + inflight 전이(0068)', () => {
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        s: { ...s.sessions.s, session: { ...s.sessions.s.session, inflight: false } }
      }
    }))

    expect(chatActions.send('새 메시지')).toBe(true)

    const st = useChatStore.getState()
    // 턴을 여는 메시지는 즉시 정식 버블(clientId=clientRequestId).
    expect(st.sessions.s.session.messages.map((m) => m.role)).toEqual(['user'])
    expect(partsText(st.sessions.s.session.messages[0].parts)).toBe('새 메시지')
    expect(st.sessions.s.session.inflight).toBe(true)
    expect(st.sessions.s.pendingSteer ?? []).toHaveLength(0)
    expect(chatSend).toHaveBeenCalledWith(
      expect.objectContaining({ text: '새 메시지', clientRequestId: expect.any(String) })
    )
    expect(st.sessions.s.session.messages[0].clientId).toBe(
      (chatSend.mock.calls[0][0] as { clientRequestId: string }).clientRequestId
    )
  })

  // 0153 — 구 계약("idle send 는 잔여가 있어도 낙관 커밋, 잔여는 pending 유지")은 **0152 가 main 을
  // 바꾼 뒤로 성립하지 않는다**. main 은 idle send 를 받으면 잔여 held 와 신규를 적재 순서대로
  // 병합해 한 배치로 커밋한다(0152 AC2 — 사용자 확정 "병합 1버블").
  //
  // 구 동작이 만들던 결과는 순서 역전보다 나빴다: 병합 커밋 `ids=[a,b,requestId]` 가 도착하면
  // chatStore 가 a·b 를 pending 에서 지운 뒤 `hasCommittedClientId(requestId)` 로 early return 해
  // **병합 텍스트가 반영되지 않는다** → 잔여 'first'/'second' 가 라이브에서 사라지고 재시작해야
  // 돌아온다. 예약 경로로 보내면 세 항목이 한 커밋으로 정직하게 승격된다.
  it('idle 세션이라도 이월 잔여가 있으면 예약 경로 — 병합 커밋이 잔여를 잃지 않는다 (0153)', () => {
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

    const sent = chatSend.mock.calls[0][0] as { clientRequestId: string }
    let st = useChatStore.getState()
    // 낙관 커밋 없음 — 순서를 정하는 권위는 main 이다.
    expect(st.sessions.s.session.messages).toHaveLength(0)
    expect(st.sessions.s.session.inflight).toBe(false)
    expect(st.sessions.s.pendingSteer?.map((i) => i.text)).toEqual(['first', 'second', '새 메시지'])

    // main 의 병합 배치 커밋 — 적재 순서 그대로 한 버블로 승격되고 pending 은 비워진다.
    ingestChatEvent({
      type: 'message.committed',
      sessionId: 's',
      ids: ['a', 'b', sent.clientRequestId],
      text: 'first\n\nsecond\n\n새 메시지',
      messageId: 11,
      createdAt: 5
    })
    st = useChatStore.getState()
    expect(st.sessions.s.pendingSteer ?? []).toHaveLength(0)
    expect(st.sessions.s.session.messages.map((m) => m.role)).toEqual(['user'])
    expect(partsText(st.sessions.s.session.messages[0].parts)).toBe('first\n\nsecond\n\n새 메시지')
  })

  it('낙관 커밋 뒤 도착한 message.queued/committed 는 멱등 — 이중 버블·pending 없음(0068)', () => {
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        s: { ...s.sessions.s, session: { ...s.sessions.s.session, inflight: false } }
      }
    }))
    chatActions.send('낙관 메시지')
    const clientId = (chatSend.mock.calls[0][0] as { clientRequestId: string }).clientRequestId

    // main 의 pending 등록(id=clientRequestId) — 낙관 커밋 분은 pending 버블을 만들지 않는다.
    ingestChatEvent({
      type: 'message.queued',
      sessionId: 's',
      id: clientId,
      text: '낙관 메시지',
      createdAt: 10
    })
    expect(useChatStore.getState().sessions.s.pendingSteer ?? []).toEqual([])

    // echo 커밋 — clientId 합류로 중복 append 없이 화해만 한다.
    ingestChatEvent({
      type: 'message.committed',
      sessionId: 's',
      ids: [clientId],
      text: '낙관 메시지',
      messageId: 3,
      createdAt: 10
    })
    const msgs = entry().session.messages
    expect(msgs.filter((m) => m.role === 'user')).toHaveLength(1)
    expect(partsText(msgs[0].parts)).toBe('낙관 메시지')
  })

  it('idle send 의 invoke 거부는 낙관 커밋 버블을 롤백한다(0068)', async () => {
    chatSend.mockRejectedValueOnce(new Error('ipc down'))
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        s: { ...s.sessions.s, session: { ...s.sessions.s.session, inflight: false } }
      }
    }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    chatActions.send('실패할 메시지')
    expect(entry().session.messages).toHaveLength(1)
    await Promise.resolve()
    await Promise.resolve()
    expect(entry().session.messages).toEqual([])
  })

  it('busy 세션 send 는 예약 — 진행 중 턴 상태를 건드리지 않고 pending 만 추가한다', () => {
    const liveBefore = { text: '스트리밍 중', reasoning: '' }
    useChatStore.setState((s) => ({
      sessions: { ...s.sessions, s: { ...s.sessions.s, live: liveBefore } }
    }))
    expect(chatActions.send('끼어들기')).toBe(true)
    const st = useChatStore.getState()
    expect(st.sessions.s.pendingSteer?.map((i) => i.text)).toEqual(['끼어들기'])
    expect(st.sessions.s.live).toBe(liveBefore) // resetLive 미발동
    expect(st.sessions.s.session.inflight).toBe(true)
  })

  it('message.cancelled(중단 버튼)는 잔존 pending 을 제거하고 draftRestore 로 텍스트를 복원한다', () => {
    ingestChatEvent({
      type: 'message.queued',
      sessionId: 's',
      id: 'q1',
      text: '남은 피드백',
      createdAt: 10
    })
    ingestChatEvent({ type: 'message.cancelled', sessionId: 's', ids: ['q1'] })
    const st = useChatStore.getState()
    expect(st.sessions.s.pendingSteer).toEqual([])
    expect(st.draftRestore).toMatchObject({ key: 's', text: '남은 피드백' })
  })

  it('hover 단건 취소 후 도착한 message.cancelled 는 no-op(draft 이중 복원 없음)', () => {
    ingestChatEvent({
      type: 'message.queued',
      sessionId: 's',
      id: 'q1',
      text: '취소할 피드백',
      createdAt: 10
    })
    chatActions.cancelSteer('q1') // 낙관 제거 + 로컬 복원(반환값)
    ingestChatEvent({ type: 'message.cancelled', sessionId: 's', ids: ['q1'] })
    expect(useChatStore.getState().draftRestore).toBeNull()
  })

  it('응답-전 → 커밋 → 응답-후 순서로 [assistant][user][assistant] 를 형성한다', () => {
    // echo 시맨틱(0060 D1): 소비 확정(message.committed)은 직전 응답 message.completed 뒤에 온다.
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      message: { text: '응답-전' }
    })
    ingestChatEvent({
      type: 'message.committed',
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

  it('자동 연속 턴 — send 없이 활동 이벤트가 오면 inflight 로 전이한다(AC7)', () => {
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        s: { ...s.sessions.s, session: { ...s.sessions.s.session, inflight: false } }
      }
    }))
    ingestChatEvent({ type: 'message.completed', sessionId: 's', message: { text: '연속 응답' } })
    expect(entry().session.inflight).toBe(true)
    ingestChatEvent({ type: 'telemetry', sessionId: 's' })
    expect(entry().session.inflight).toBe(false)
  })
})

// 0119 — busy 세션에서 provider 경계를 넘는 모델이 선택된 동안 steer 예약을 거부한다
// (Composer 게이트의 main-호출 직전 이중 방어). 본래 provider 로 되돌리면 통과.
describe('chatStore — steer provider 경계 게이트(0119)', () => {
  const seedBusyWithProvider = (selectedKey: string): void => {
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        s: {
          ...st.sessions.s,
          session: {
            ...st.sessions.s.session,
            backend: 'claude',
            providerKey: selectedKey,
            turnProviderKey: 'claude-anthropic'
          }
        }
      }
    }))
  }

  it('경계 선택 중 send 는 false — pendingSteer 미적재 + IPC 미호출', () => {
    seedBusyWithProvider('claude-zai')
    expect(chatActions.send('끼어들기 시도')).toBe(false)
    expect(useChatStore.getState().sessions.s.pendingSteer ?? []).toEqual([])
    expect(chatSend).not.toHaveBeenCalled()
  })

  it('본래 provider 로 되돌리면 steer 예약이 정상 동작한다', () => {
    seedBusyWithProvider('claude-anthropic')
    expect(chatActions.send('정상 피드백')).toBe(true)
    expect(useChatStore.getState().sessions.s.pendingSteer?.map((p) => p.text)).toEqual([
      '정상 피드백'
    ])
    expect(chatSend).toHaveBeenCalledTimes(1)
  })
})

describe('chatStore — continuityLang 스냅샷 (0127)', () => {
  // bootstrapChat 의 settingsApi.get() 시드 경로를 실제로 태워 languageCache 를 채운다.
  // languageCache 는 모듈 전역이라 afterEach 에서 ko 로 재시드해 다른 테스트를 오염하지 않는다.
  const seedLanguage = async (language: string): Promise<void> => {
    vi.stubGlobal('window', {
      orca: {
        chat: { send: chatSend, cancel: vi.fn(), cancelSteer: vi.fn(), onEvent: vi.fn() },
        settings: { get: vi.fn().mockResolvedValue({ language }), set: settingsSet },
        permission: { respond: permissionRespond, setMode: vi.fn() },
        session: { cwd: vi.fn().mockResolvedValue('/w'), onTitle: vi.fn() },
        concurrency: { onEvent: vi.fn() }
      }
    })
    bootstrapChat()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  const seedSource = (): void => {
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
              { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q1' }] },
              { role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'a1' }] },
              { role: 'user', createdAt: 3, parts: [{ type: 'text', text: 'q2' }] }
            ]
          }
        }
      }
    }))
  }

  afterEach(async () => {
    await seedLanguage('한국어')
  })

  it('en 시드 시 fork draft 제목이 [Fork] 이고 send payload 에 continuityLang 이 실린다', async () => {
    await seedLanguage('English')
    seedSource()
    expect(chatActions.startForkDraft()).toBe(true)
    const draftKey = useChatStore.getState().activeKey
    const draft = useChatStore.getState().sessions[draftKey].session
    expect(draft.title).toBe('[Fork] 원본 세션')
    expect(draft.continuityLang).toBe('en')

    expect(chatActions.send('물질화')).toBe(true)
    expect(chatSend).toHaveBeenCalledWith(
      expect.objectContaining({ forkFrom: 's', continuityLang: 'en' })
    )
  })

  it('en 시드 시 handoff draft 제목이 [Handoff] 이고 payload 에 continuityLang 이 실린다', async () => {
    await seedLanguage('English')
    seedSource()
    expect(chatActions.startHandoff()).toBe(true)
    const draftKey = useChatStore.getState().pendingNewChatKey!
    expect(useChatStore.getState().sessions[draftKey].session.title).toBe('[Handoff] 원본 세션')
    expect(chatSend).toHaveBeenCalledWith(
      expect.objectContaining({ handoffFrom: 's', continuityLang: 'en' })
    )
  })

  it('ko 시드(기본)면 기존 한글 마커·payload continuityLang=ko — 문자열 무회귀', async () => {
    await seedLanguage('한국어')
    seedSource()
    expect(chatActions.startForkDraft()).toBe(true)
    const draftKey = useChatStore.getState().activeKey
    expect(useChatStore.getState().sessions[draftKey].session.title).toBe('[분기] 원본 세션')
    expect(chatActions.send('물질화')).toBe(true)
    expect(chatSend).toHaveBeenCalledWith(
      expect.objectContaining({ forkFrom: 's', continuityLang: 'ko' })
    )
  })
})
