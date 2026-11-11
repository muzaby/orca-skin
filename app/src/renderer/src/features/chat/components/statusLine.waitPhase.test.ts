import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatActivitySnapshot, ChatWaitPhase } from '../../../../../shared/ipc'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import { useChatResidualSteer, useChatStore } from '../store/chatStore'
import { PendingAssistantStatus } from './transcript/PendingAssistantStatus'

vi.mock('../../../shared/ui/elapsed', async (original) => ({
  ...(await original<typeof import('../../../shared/ui/elapsed')>()),
  useElapsed: () => 12
}))

const initial = useChatStore.getInitialState()
const saved = { sessions: initial.sessions, activeKey: initial.activeKey }

afterEach(() => {
  Object.assign(initial, saved)
  useChatStore.setState(saved)
  vi.restoreAllMocks()
})

function activitySnapshot(patch: Partial<ChatActivitySnapshot> = {}): ChatActivitySnapshot {
  return {
    type: 'chat.activity',
    sessionId: 's1',
    revision: 1,
    foreground: 'streaming',
    transport: 'idle',
    queuedCount: 0,
    deliveryPendingCount: 0,
    residualCount: 0,
    backgroundTaskCount: 0,
    ...patch
  }
}

function renderStatusWithSession(session: typeof initialChatState): string {
  const key = 's1'
  const sessions = {
    [key]: { session, live: { text: '', reasoning: '' }, subagentMeta: {} }
  }
  Object.assign(initial, { activeKey: key, sessions })
  useChatStore.setState({ activeKey: key, sessions })
  return renderToStaticMarkup(createElement(PendingAssistantStatus))
}

function ResidualProbe(): React.JSX.Element {
  return createElement('output', null, String(useChatResidualSteer()))
}

describe('PendingAssistantStatus waitPhase rendering and reducer wiring (0296 IT-04)', () => {
  // 0308 — 상태줄의 대기 표시는 transport 에서 파생한 점유 값을 받는다(ready 도 점유다).
  it('derives the waiting label from the transport: ready and listening wait, idle does not', () => {
    const render = (transport: 'idle' | 'ready' | 'listening'): string =>
      renderStatusWithSession({
        ...initialChatState,
        sessionId: 's1',
        backend: 'claude',
        turnStartedAt: 1,
        activity: { ...initialChatState.activity, transport }
      })
    const idle = render('idle')
    expect(render('ready')).not.toBe(idle)
    expect(render('ready')).toBe(render('listening'))
  })

  it('잔여 수 selector 는 activity.residualCount 를 낸다', () => {
    renderStatusWithSession({
      ...initialChatState,
      sessionId: 's1',
      activity: {
        ...initialChatState.activity,
        residualCount: 2,
        queuedCount: 5,
        deliveryPendingCount: 3
      }
    })
    expect(renderToStaticMarkup(createElement(ResidualProbe))).toBe('<output>2</output>')
  })

  it('상태 줄은 activity 의 건수 4필드를 각자의 문구로 낸다', () => {
    const html = renderStatusWithSession({
      ...initialChatState,
      sessionId: 's1',
      turnStartedAt: 1,
      activity: {
        ...initialChatState.activity,
        foreground: 'streaming',
        queuedCount: 1,
        deliveryPendingCount: 5,
        residualCount: 2,
        backgroundTaskCount: 4
      }
    })
    // 잔여는 전달 확인의 부분집합이라 차감돼 보인다(5 − 2).
    expect(html).toContain(
      'title="전달 확인 중 3건 · 입력 대기 1건 · 중단 후 전달 대기 2건 · 백그라운드 작업 4건"'
    )
  })

  it('does not invent a wait phase before receiving an activity snapshot', () => {
    const html = renderStatusWithSession({
      ...initialChatState,
      sessionId: 's1',
      backend: 'opencode',
      activity: { ...initialChatState.activity, foreground: 'streaming' },
      turnStartedAt: 1
    })

    expect(html).toContain('생각 중')
    expect(html).not.toContain('OpenCode 서버를 시작하는 중…')
  })

  it('renders the exact Korean text for all 9 ChatWaitPhase variants and falls back to 생각 중 when cleared', () => {
    const cases: Array<{ phase: ChatWaitPhase; expected: string }> = [
      { phase: { kind: 'preparing' }, expected: '응답 준비 중…' },
      { phase: { kind: 'history' }, expected: '이전 대화를 확인하는 중…' },
      { phase: { kind: 'server' }, expected: 'OpenCode 서버를 시작하는 중…' },
      { phase: { kind: 'project' }, expected: '프로젝트를 불러오는 중…' },
      { phase: { kind: 'session' }, expected: '세션을 만드는 중…' },
      { phase: { kind: 'mcp' }, expected: 'MCP 연결을 기다리는 중…' },
      { phase: { kind: 'send' }, expected: '요청을 보내는 중…' },
      { phase: { kind: 'model' }, expected: '모델 응답을 기다리는 중…' },
      { phase: { kind: 'retry', attempt: 2 }, expected: '재시도 대기 중 (2번째)…' }
    ]

    const baseState = {
      ...initialChatState,
      sessionId: 's1',
      backend: 'opencode' as const,
      turnStartedAt: 1
    }

    for (const { phase, expected } of cases) {
      const reduced = chatReducer(baseState, {
        type: 'RECV_EVENT',
        event: activitySnapshot({
          revision: 1,
          foreground:
            phase.kind === 'preparing' || phase.kind === 'history' ? 'preparing' : 'streaming',
          waitPhase: phase
        })
      })
      const html = renderStatusWithSession(reduced)
      expect(html).toContain('aria-live="polite"')
      expect(html).toContain(expected)
    }

    const cleared = chatReducer(baseState, {
      type: 'RECV_EVENT',
      event: activitySnapshot({ revision: 2, foreground: 'streaming' })
    })
    const clearedHtml = renderStatusWithSession(cleared)
    expect(clearedHtml).toContain('생각 중')
  })

  it('renders waiting facts alongside waitPhase and ignores stale activity revisions', () => {
    const baseState = {
      ...initialChatState,
      sessionId: 's1',
      backend: 'opencode' as const,
      turnStartedAt: 1
    }
    const rev1 = chatReducer(baseState, {
      type: 'RECV_EVENT',
      event: activitySnapshot({
        revision: 1,
        foreground: 'streaming',
        queuedCount: 1,
        waitPhase: { kind: 'model' }
      })
    })
    const html = renderStatusWithSession(rev1)
    expect(html).toContain('모델 응답을 기다리는 중…')
    expect(html).toContain('입력 대기 1건')

    // Same or lower revision with different waitPhase is ignored
    const stale = chatReducer(rev1, {
      type: 'RECV_EVENT',
      event: activitySnapshot({
        revision: 1,
        foreground: 'streaming',
        waitPhase: { kind: 'server' }
      })
    })
    expect(stale.activity.waitPhase).toEqual({ kind: 'model' })
  })

  it('hydrates activity.waitPhase on LOAD_SESSION and preserves newer live activity.waitPhase', () => {
    const hydrated = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's1',
        title: 'Loaded',
        cwd: 'C:/work',
        backend: 'opencode',
        agentKind: 'code',
        messages: [],
        activity: activitySnapshot({
          revision: 3,
          foreground: 'streaming',
          waitPhase: { kind: 'model' }
        })
      }
    })
    expect(hydrated.activity.waitPhase).toEqual({ kind: 'model' })

    const liveNewer = chatReducer(hydrated, {
      type: 'RECV_EVENT',
      event: activitySnapshot({
        revision: 5,
        foreground: 'streaming',
        waitPhase: { kind: 'send' }
      })
    })
    const preserved = chatReducer(liveNewer, {
      type: 'LOAD_SESSION',
      session: {
        id: 's1',
        title: 'Loaded',
        cwd: 'C:/work',
        backend: 'opencode',
        agentKind: 'code',
        messages: [],
        activity: activitySnapshot({
          revision: 4,
          foreground: 'streaming',
          waitPhase: { kind: 'server' }
        })
      }
    })
    expect(preserved.activity.waitPhase).toEqual({ kind: 'send' })
    expect(preserved.activity.revision).toBe(5)
  })
})
