import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { subscribeSessionCompletions } from './useSessionCompletion'
import { chatActions, ingestChatEvent, useChatStore } from '../../features/chat/store/chatStore'
import { installChatStoreHarness } from '../../features/chat/store/chatStore.testHarness'
import { sessionsActions, useSessionsStore } from '../../features/sessions/store/sessionsStore'
let unsubscribe: () => void
beforeEach(() => {
  installChatStoreHarness({ inflight: true })
  useSessionsStore.setState({ unseenCompletedIds: new Set(), viewedSessionId: null })
  unsubscribe = subscribeSessionCompletions()
})
afterEach(() => unsubscribe())
const marked = (): boolean => useSessionsStore.getState().unseenCompletedIds.has('s')
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
    expect(useSessionsStore.getState().unseenCompletedIds.size).toBe(0)
    unsubscribe()
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(marked()).toBe(false)
    unsubscribe = subscribeSessionCompletions()
    chatActions.handleSessionDeleted('s')
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(marked()).toBe(false)
  })
})
