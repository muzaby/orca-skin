import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeSessionAttention } from './useSessionCompletion'
import { chatActions, ingestChatEvent, useChatStore } from '../../features/chat/store/chatStore'
import { flushRaf, installChatStoreHarness } from '../../features/chat/store/chatStore.testHarness'
import { activitySnapshot } from '../../features/chat/activity.testfixture'
import { sessionsActions, useSessionsStore } from '../../features/sessions/store/sessionsStore'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { SessionRow } from '../../features/sessions/components/SessionRow'
import type { NormalizedEvent, PermissionAction, SessionListItem } from '../../../../shared/ipc'
let unsubscribe: () => void
beforeEach(() => {
  installChatStoreHarness({ inflight: true })
  useSessionsStore.setState({ unseenAttention: new Map(), viewedSessionId: null })
  unsubscribe = subscribeSessionAttention()
})
afterEach(() => unsubscribe())
const marked = (): boolean => useSessionsStore.getState().unseenAttention.has('s')
describe('r5 normal completion across app features', () => {
  it('existing turn.ended marks a non-viewed session while preserving its tick', () => {
    sessionsActions.setViewedSession('other')
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(marked()).toBe(true)
    expect(useChatStore.getState().sessions.s.session.turnEndTick).toBe(1)
  })
  it('active chatStore key on another route still counts as non-viewed', () => {
    expect(useChatStore.getState().activeKey).toBe('s')
    sessionsActions.setViewedSession(null)
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(marked()).toBe(true)
  })
  it('viewed route is excluded and viewing later permanently acknowledges it', () => {
    sessionsActions.setViewedSession('s')
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(marked()).toBe(false)
    sessionsActions.setViewedSession(null)
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(marked()).toBe(true)
    sessionsActions.setViewedSession('s')
    sessionsActions.setViewedSession(null)
    expect(marked()).toBe(false)
  })
  it('intermediate and child assistant messages, telemetry, errors and aborts do not create completion', () => {
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      message: { text: 'intermediate' }
    })
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      parentToolRunId: 'child',
      message: { text: 'child' }
    })
    ingestChatEvent({ type: 'telemetry', sessionId: 's' })
    ingestChatEvent({ type: 'turn.aborted', sessionId: 's', reason: 'user_cancelled' })
    ingestChatEvent({
      type: 'error',
      sessionId: 's',
      error: { category: 'stream_error', message: 'failed', retryable: false }
    })
    expect(marked()).toBe(false)
  })
  it('unknown/deleted/identity-less late events and unsubscribed events are ignored', () => {
    ingestChatEvent({ type: 'turn.ended', sessionId: 'unknown' })
    ingestChatEvent({ type: 'turn.ended' })
    expect(useSessionsStore.getState().unseenAttention.size).toBe(0)
    unsubscribe()
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(marked()).toBe(false)
    unsubscribe = subscribeSessionAttention()
    chatActions.handleSessionDeleted('s')
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(marked()).toBe(false)
  })
})

const requestActions: PermissionAction[] = [
  { kind: 'tool_approval', toolName: 'Bash', input: { command: 'echo hello' } },
  { kind: 'ask_question', request: { requestId: 'ask', questions: [] } },
  { kind: 'plan_review', request: { requestId: 'plan', plan: '# Plan' } }
]
function request(
  action: PermissionAction = requestActions[0],
  sessionId?: string
): NormalizedEvent {
  return { type: 'permission.requested', sessionId, approvalId: 'a', origin: 'agent', action }
}
const row: SessionListItem = {
  id: 's',
  backend: 'claude',
  agentKind: 'code',
  title: 'Session',
  updatedAt: 1,
  preview: null,
  projectId: null,
  cwd: null,
  pinnedAt: null
}
function icon(sessionId = row.id, isActive = false): ReturnType<typeof load> {
  // Zustand SSR reads getInitialState; render the actual production event's state and restore it.
  const initial = useSessionsStore.getInitialState()
  const original = { ...initial }
  Object.assign(initial, useSessionsStore.getState())
  try {
    return load(
      renderToStaticMarkup(
        createElement(SessionRow, {
          session: { ...row, id: sessionId },
          isActive,
          appearance: { navIcon: 'terminal2', label: 'chat.agent.code' }
        })
      )
    )
  } finally {
    Object.assign(initial, original)
  }
}

describe('0254 생성 중 스피너', () => {
  const state = (active = false, id = 's'): string | undefined =>
    icon(id, active)('[data-context="session-agent-kind"]').attr('data-state')
  const resolve = (): void =>
    ingestChatEvent({
      type: 'permission.resolved',
      sessionId: 's',
      approvalId: 'a',
      resolution: { behavior: 'deny' }
    })
  const ask = (action: PermissionAction): NormalizedEvent => {
    if (action.kind === 'ask_question')
      return request({ ...action, request: { ...action.request, requestId: 'a' } }, 's')
    if (action.kind === 'plan_review')
      return request({ ...action, request: { ...action.request, requestId: 'a' } }, 's')
    return request(action, 's')
  }

  it('projects optimistic send and delta activity to warning dots including viewed rows', () => {
    installChatStoreHarness({ inflight: false })
    expect(state()).toBe('default')
    expect(chatActions.send('hello')).toBe(true)
    expect(state()).toBe('in-progress')
    sessionsActions.setViewedSession('s')
    const $ = icon('s', true)
    const agent = $('[data-context="session-agent-kind"]')
    expect(agent.attr('data-state')).toBe('in-progress')
    expect(agent.attr('role')).toBe('img')
    expect(agent.attr('aria-label')).toBe('코드 · 답변 생성 중')
    expect(agent.hasClass('text-warn')).toBe(true)
    expect($('[data-session-id]').hasClass('text-warn')).toBe(false)
    expect(agent.find('svg')).toHaveLength(0)
    expect(agent.find('[data-spinner="dots"] > span')).toHaveLength(3)
    ingestChatEvent({ type: 'telemetry', sessionId: 's' })
    ingestChatEvent({ type: 'message.delta', sessionId: 's', delta: { text: 'answer' } })
    flushRaf()
    expect(state(true)).toBe('in-progress')
  })

  for (const active of [false, true]) {
    it.each(requestActions)(
      `$kind suspends generation and resumes after resolution; active=${active}`,
      (action) => {
        sessionsActions.setViewedSession(active ? 's' : null)
        expect(state(active)).toBe('in-progress')
        ingestChatEvent(ask(action))
        expect(state(active)).toBe(active ? 'default' : 'awaiting-response')
        resolve()
        expect(state(active)).toBe('in-progress')
      }
    )
  }
  it.each(requestActions)('child $kind also suspends the spinner', (action) => {
    ingestChatEvent(
      ask({
        ...action,
        providerRequest: { requestId: 'child', toolUseId: 'use', agentId: 'agent' }
      })
    )
    expect(state()).toBe('awaiting-response')
    resolve()
    expect(state()).toBe('in-progress')
  })

  it.each(['telemetry', 'turn.aborted', 'error', 'CANCEL_CHAT'] as const)(
    '%s removes generation without completion',
    (type) => {
      if (type === 'CANCEL_CHAT') chatActions.cancel()
      else if (type === 'turn.aborted')
        ingestChatEvent({ type, sessionId: 's', reason: 'user_cancelled' })
      else if (type === 'error')
        ingestChatEvent({
          type,
          sessionId: 's',
          error: { category: 'stream_error', message: 'failed', retryable: false }
        })
      else ingestChatEvent({ type, sessionId: 's' })
      expect(state()).toBe('default')
      expect(marked()).toBe(false)
      ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
      expect(state()).toBe('unseen-complete')
      sessionsActions.setViewedSession('s')
      expect(state(true)).toBe('default')
    }
  )
  it.each(['listening', 'ready'] as const)('%s with no open turn has no spinner', (transport) => {
    ingestChatEvent({ type: 'telemetry', sessionId: 's' })
    ingestChatEvent(activitySnapshot(1, transport, { foreground: 'streaming' }))
    expect(state()).toBe('default')
  })
  it.each(['completed', 'awaiting-response'] as const)(
    'generation precedes retained %s attention without deleting it',
    (attention) => {
      if (attention === 'completed') sessionsActions.markCompleted('s')
      else sessionsActions.markAwaitingResponse('s')
      expect(state()).toBe('in-progress')
      expect(useSessionsStore.getState().unseenAttention.get('s')).toBe(attention)
      ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
      expect(state()).toBe('in-progress')
      ingestChatEvent({ type: 'telemetry', sessionId: 's' })
      expect(state()).toBe('unseen-complete')
    }
  )
  it('observes the full non-viewed state sequence', () => {
    const states = [state()]
    ingestChatEvent(ask(requestActions[0]))
    states.push(state())
    resolve()
    states.push(state())
    ingestChatEvent({ type: 'telemetry', sessionId: 's' })
    states.push(state())
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    states.push(state())
    expect(states).toEqual([
      'in-progress',
      'awaiting-response',
      'in-progress',
      'awaiting-response',
      'unseen-complete'
    ])
  })
  it('does not write the sessions store for repeated delta frames', () => {
    unsubscribe()
    const sink = vi.spyOn(sessionsActions, 'setGeneratingSessions')
    unsubscribe = subscribeSessionAttention()
    sink.mockClear()
    const before = useSessionsStore.getState().generatingSessionIds
    for (let index = 0; index < 10; index++) {
      ingestChatEvent({ type: 'message.delta', sessionId: 's', delta: { text: 'x' } })
      flushRaf()
    }
    expect(sink).not.toHaveBeenCalled()
    expect(useSessionsStore.getState().generatingSessionIds).toBe(before)
    sink.mockRestore()
  })
  it('keeps unknown or identity-less terminal events inert and removes a deleted entry', () => {
    const before = useSessionsStore.getState().generatingSessionIds
    ingestChatEvent({ type: 'turn.ended', sessionId: 'unknown' })
    ingestChatEvent({ type: 'turn.ended' })
    expect(useSessionsStore.getState().generatingSessionIds).toBe(before)
    chatActions.handleSessionDeleted('s')
    expect(useSessionsStore.getState().generatingSessionIds.size).toBe(0)
  })
  it('projects continuity draft keys then replaces them with the promoted session id', () => {
    const entry = useChatStore.getState().sessions.s
    useChatStore.setState({
      sessions: {
        'draft:continuity': { ...entry, session: { ...entry.session, sessionId: null } }
      },
      activeKey: 'draft:continuity',
      pendingNewChatKey: 'draft:continuity'
    })
    expect(state(false, 'draft:continuity')).toBe('in-progress')
    ingestChatEvent({ type: 'session.updated', sessionId: 'promoted', patch: {} })
    expect(useSessionsStore.getState().generatingSessionIds).toEqual(new Set(['promoted']))
    expect(state(false, 'promoted')).toBe('in-progress')
  })
  it('cleans up generation and synchronizes current state immediately on reinstall', () => {
    unsubscribe()
    const before = useSessionsStore.getState().generatingSessionIds
    chatActions.cancel()
    expect(useSessionsStore.getState().generatingSessionIds).toBe(before)
    unsubscribe = subscribeSessionAttention()
    expect(useSessionsStore.getState().generatingSessionIds.size).toBe(0)
  })
})

describe('0249 response attention across app features', () => {
  it.each(requestActions)('$kind uses the same blue icon as completion', (action) => {
    ingestChatEvent(request(action, 's'))
    expect(useSessionsStore.getState().unseenAttention.get('s')).toBe('awaiting-response')
    const awaiting = icon()('[data-context="session-agent-kind"]')
    expect(awaiting.attr('data-state')).toBe('awaiting-response')
    expect(awaiting.hasClass('text-selected')).toBe(true)
    expect(awaiting.attr('class')).toContain('[&_svg]:[stroke-width:40]')
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    const completed = icon()('[data-context="session-agent-kind"]')
    expect(completed.attr('data-state')).toBe('unseen-complete')
    expect(completed.attr('class')).toBe(awaiting.attr('class'))
  })
  it('viewed requests stay unmarked and opening acknowledges a request permanently', () => {
    sessionsActions.setViewedSession('s')
    ingestChatEvent(request(requestActions[0], 's'))
    expect(marked()).toBe(false)
    sessionsActions.setViewedSession(null)
    ingestChatEvent(request(requestActions[1], 's'))
    expect(marked()).toBe(true)
    sessionsActions.setViewedSession('s')
    sessionsActions.setViewedSession(null)
    expect(marked()).toBe(false)
    expect(icon()('[data-context="session-agent-kind"]').attr('data-state')).toBe('default')
  })
  it('unknown, absent, mismatched, pending-fallback, deleted and unsubscribed requests are ignored', () => {
    ingestChatEvent(request(requestActions[0], 'unknown'))
    ingestChatEvent(request())
    const entry = useChatStore.getState().sessions.s
    useChatStore.setState({
      sessions: { s: { ...entry, session: { ...entry.session, sessionId: 'different' } } }
    })
    ingestChatEvent(request(requestActions[0], 's'))
    useChatStore.setState({
      sessions: { draft: { ...entry, session: { ...entry.session, sessionId: null } } },
      pendingNewChatKey: 'draft',
      activeKey: 'draft'
    })
    ingestChatEvent(request(requestActions[0], 'future'))
    expect(useSessionsStore.getState().unseenAttention.size).toBe(0)
    installChatStoreHarness({ inflight: true })
    unsubscribe()
    ingestChatEvent(request(requestActions[0], 's'))
    expect(marked()).toBe(false)
    unsubscribe = subscribeSessionAttention()
    chatActions.handleSessionDeleted('s')
    ingestChatEvent(request(requestActions[0], 's'))
    expect(marked()).toBe(false)
  })
  it('the mounted app effect installs the attention subscription', () => {
    const source = readFileSync(new URL('./useSessionCompletion.ts', import.meta.url), 'utf8')
    expect(source).toContain('useEffect(subscribeSessionAttention, [])')
    expect(source).not.toContain('subscribeSessionCompletions')
  })
})

describe('0249 ΔV3.1 — draft 승격 뒤 승인 주의 표시', () => {
  function pendingDraft(action: PermissionAction): void {
    const state = useChatStore.getState()
    const entry = state.sessions.s
    useChatStore.setState({
      sessions: {
        ...state.sessions,
        draft: { ...entry, session: { ...entry.session, sessionId: null } }
      },
      pendingNewChatKey: 'draft'
    })
    const pendingAction: PermissionAction =
      action.kind === 'ask_question'
        ? { ...action, request: { ...action.request, requestId: 'a' } }
        : action.kind === 'plan_review'
          ? { ...action, request: { ...action.request, requestId: 'a' } }
          : action
    ingestChatEvent(request(pendingAction))
  }

  it.each(requestActions)(
    '$kind는 noid 순간 표시 없이 승격한 실제 세션에 같은 파랑을 만든다',
    (action) => {
      pendingDraft(action)
      expect(useSessionsStore.getState().unseenAttention.size).toBe(0)
      ingestChatEvent({ type: 'session.updated', sessionId: 'promoted', patch: {} })
      expect(useSessionsStore.getState().unseenAttention.get('promoted')).toBe('awaiting-response')
      expect(useSessionsStore.getState().unseenAttention.has('s')).toBe(false)
      const awaiting = icon('promoted')('[data-context="session-agent-kind"]')
      expect(awaiting.attr('data-state')).toBe('awaiting-response')
      expect(awaiting.hasClass('text-selected')).toBe(true)
      expect(awaiting.attr('class')).toContain('[&_svg]:[stroke-width:40]')
      const attention = useSessionsStore.getState().unseenAttention
      ingestChatEvent({
        type: 'session.updated',
        sessionId: 'promoted',
        patch: { permissionMode: 'plan' }
      })
      expect(useSessionsStore.getState().unseenAttention).toBe(attention)
      sessionsActions.setViewedSession('promoted')
      sessionsActions.setViewedSession(null)
      ingestChatEvent({ type: 'session.updated', sessionId: 'promoted', patch: {} })
      expect(useSessionsStore.getState().unseenAttention.size).toBe(0)
      expect(icon('promoted')('[data-context="session-agent-kind"]').attr('data-state')).toBe(
        'default'
      )
    }
  )

  it.each(requestActions)(
    '$kind를 init 전에 해결하면 승격은 대기 표시를 만들지 않는다',
    (action) => {
      pendingDraft(action)
      ingestChatEvent({
        type: 'permission.resolved',
        approvalId: 'a',
        resolution: { behavior: 'deny' }
      })
      ingestChatEvent({ type: 'session.updated', sessionId: 'promoted', patch: {} })
      expect(useSessionsStore.getState().unseenAttention.size).toBe(0)
    }
  )

  it('실제 열람 가드는 승격 대기를 억제하고 activeKey만 같은 다른 route에서는 표시한다', () => {
    pendingDraft(requestActions[2])
    sessionsActions.setViewedSession('promoted')
    ingestChatEvent({ type: 'session.updated', sessionId: 'promoted', patch: {} })
    expect(useSessionsStore.getState().unseenAttention.size).toBe(0)
    installChatStoreHarness({ inflight: true })
    sessionsActions.setViewedSession(null)
    pendingDraft(requestActions[2])
    useChatStore.setState({ activeKey: 'draft' })
    ingestChatEvent({ type: 'session.updated', sessionId: 'route-away', patch: {} })
    expect(useChatStore.getState().activeKey).toBe('route-away')
    expect(useSessionsStore.getState().unseenAttention.get('route-away')).toBe('awaiting-response')
  })

  it('구독을 해제한 뒤의 승격과 승인 없는 새 세션은 표시를 만들지 않는다', () => {
    pendingDraft(requestActions[2])
    unsubscribe()
    ingestChatEvent({ type: 'session.updated', sessionId: 'promoted', patch: {} })
    expect(useSessionsStore.getState().unseenAttention.size).toBe(0)
    installChatStoreHarness({ inflight: true })
    unsubscribe = subscribeSessionAttention()
    const state = useChatStore.getState()
    useChatStore.setState({
      sessions: {
        ...state.sessions,
        draft: { ...state.sessions.s, session: { ...state.sessions.s.session, sessionId: null } }
      },
      pendingNewChatKey: 'draft'
    })
    ingestChatEvent({ type: 'session.updated', sessionId: 'without-approval', patch: {} })
    expect(useSessionsStore.getState().unseenAttention.size).toBe(0)
  })
})
