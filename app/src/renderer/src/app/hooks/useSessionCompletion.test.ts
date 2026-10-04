import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { subscribeSessionAttention } from './useSessionCompletion'
import { chatActions, ingestChatEvent, useChatStore } from '../../features/chat/store/chatStore'
import { installChatStoreHarness } from '../../features/chat/store/chatStore.testHarness'
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
function icon(): ReturnType<typeof load> {
  // Zustand SSR reads getInitialState; render the actual production event's state and restore it.
  const initial = useSessionsStore.getInitialState()
  const original = { ...initial }
  Object.assign(initial, useSessionsStore.getState())
  try {
    return load(
      renderToStaticMarkup(
        createElement(SessionRow, {
          session: row,
          isActive: false,
          appearance: { navIcon: 'terminal2', label: 'chat.agent.code' }
        })
      )
    )
  } finally {
    Object.assign(initial, original)
  }
}

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
