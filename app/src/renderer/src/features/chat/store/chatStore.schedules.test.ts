import { beforeEach, describe, expect, it } from 'vitest'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import { ingestChatEvent, sessionBusy, sessionResponding, useChatStore } from './chatStore'
import { harnessSession, installChatStoreHarness } from './chatStore.testHarness'
import type { SessionSchedule } from '../../../../../shared/session-schedules'
import { activitySnapshot } from '../activity.testfixture'

const schedules: SessionSchedule[] = [
  { id: 'cron-1', schedule: '*/5 * * * *', recurring: true, prompt: '상태 확인' }
]

describe('session scheduling receive path', () => {
  it('ready 복원은 예약 수신 점유만 유지하고 오래된 복원이나 다른 세션으로 새지 않는다', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        agentKind: 'work',
        backend: 'claude',
        title: null,
        messages: [],
        activity: activitySnapshot(3, 'ready', { sessionSchedules: schedules })
      }
    })
    expect(sessionBusy(loaded)).toBe(true)
    expect(sessionResponding(loaded)).toBe(false)
    expect(loaded.activityTransport).toBe('ready')
    expect(loaded.listenStartedAt).toBeNull()
    expect(loaded.sessionSchedules).toEqual(schedules)
    const stale = chatReducer(loaded, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        agentKind: 'work',
        backend: 'claude',
        title: null,
        messages: [],
        activity: activitySnapshot(2, 'listening', { foreground: 'streaming' })
      }
    })
    expect(sessionResponding(stale)).toBe(false)
    const other = chatReducer(loaded, {
      type: 'LOAD_SESSION',
      session: { id: 'other', agentKind: 'work', backend: 'claude', title: null, messages: [] }
    })
    expect(sessionBusy(other)).toBe(false)
    expect(other.activityTransport).toBe('idle')
    expect(chatReducer(loaded, { type: 'CANCEL_CHAT' }).activityTransport).toBe('idle')
  })

  beforeEach(() => {
    installChatStoreHarness()
  })

  it('distinguishes unobserved schedules, a current snapshot and an explicit empty snapshot', () => {
    expect(harnessSession().sessionSchedules).toBeUndefined()
    ingestChatEvent(activitySnapshot(1, 'idle', { sessionSchedules: schedules }))
    expect(harnessSession().sessionSchedules).toEqual(schedules)
    ingestChatEvent(activitySnapshot(2, 'idle', { sessionSchedules: [] }))
    expect(harnessSession().sessionSchedules).toEqual([])
  })

  it('retains an acknowledged wakeup without inventing a schedule until an ordered snapshot clears it', () => {
    ingestChatEvent(
      activitySnapshot(1, 'listening', { backgroundTaskCount: 0, pendingSessionWakeup: true })
    )
    expect(harnessSession().pendingSessionWakeup).toBe(true)
    expect(harnessSession().sessionSchedules).toBeUndefined()
    const stopped = chatReducer(harnessSession(), { type: 'CANCEL_CHAT' })
    expect(stopped.pendingSessionWakeup).toBe(true)
    ingestChatEvent(activitySnapshot(2, 'listening', { backgroundTaskCount: 0 }))
    expect(harnessSession().pendingSessionWakeup).toBe(true)
    ingestChatEvent(
      activitySnapshot(3, 'idle', { sessionSchedules: [], pendingSessionWakeup: false })
    )
    ingestChatEvent(activitySnapshot(2, 'listening', { pendingSessionWakeup: true }))
    expect(harnessSession().pendingSessionWakeup).toBe(false)
    expect(harnessSession().sessionSchedules).toEqual([])
  })

  it('hydrates the pending wakeup within its session and preserves newer live observations', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        agentKind: 'work',
        backend: 'claude',
        title: null,
        messages: [],
        activity: activitySnapshot(1, 'listening', { pendingSessionWakeup: true })
      }
    })
    expect(loaded.pendingSessionWakeup).toBe(true)
    const omitted = chatReducer(loaded, {
      type: 'LOAD_SESSION',
      session: { id: 's', agentKind: 'work', backend: 'claude', title: null, messages: [] }
    })
    expect(omitted.pendingSessionWakeup).toBe(true)
    expect(chatReducer(loaded, { type: 'NEW_CHAT' }).pendingSessionWakeup).toBeUndefined()
    const other = chatReducer(loaded, {
      type: 'LOAD_SESSION',
      session: { id: 'other', agentKind: 'work', backend: 'claude', title: null, messages: [] }
    })
    expect(other.pendingSessionWakeup).toBeUndefined()
    const cleared = chatReducer(loaded, {
      type: 'RECV_EVENT',
      event: activitySnapshot(3, 'idle', { pendingSessionWakeup: false })
    })
    expect(
      chatReducer(cleared, {
        type: 'LOAD_SESSION',
        session: {
          id: 's',
          agentKind: 'work',
          backend: 'claude',
          title: null,
          messages: [],
          activity: activitySnapshot(2, 'listening', { pendingSessionWakeup: true })
        }
      }).pendingSessionWakeup
    ).toBe(false)
  })

  it('routes background schedule updates to their own session', () => {
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        other: { ...state.sessions.s, session: { ...initialChatState, sessionId: 'other' } }
      }
    }))
    ingestChatEvent(
      activitySnapshot(1, 'idle', { sessionId: 'other', sessionSchedules: schedules })
    )
    expect(harnessSession().sessionSchedules).toBeUndefined()
    expect(useChatStore.getState().sessions.other.session.sessionSchedules).toEqual(schedules)
  })

  it('keeps a received snapshot through the same session hydration without leaking to a new session', () => {
    ingestChatEvent(activitySnapshot(1, 'idle', { sessionSchedules: schedules }))
    const loaded = chatReducer(harnessSession(), {
      type: 'LOAD_SESSION',
      session: { id: 's', agentKind: 'work', backend: 'claude', title: null, messages: [] }
    })
    expect(loaded.sessionSchedules).toEqual(schedules)
    expect(chatReducer(loaded, { type: 'NEW_CHAT' }).sessionSchedules).toBeUndefined()
    expect(
      chatReducer(loaded, {
        type: 'LOAD_SESSION',
        session: { id: 'other', agentKind: 'work', backend: 'claude', title: null, messages: [] }
      }).sessionSchedules
    ).toBeUndefined()
  })

  it('ignores unordered internal schedule events after a newer activity snapshot clears them', () => {
    ingestChatEvent(activitySnapshot(1, 'idle', { sessionSchedules: schedules }))
    ingestChatEvent(activitySnapshot(2, 'idle', { sessionSchedules: [] }))
    ingestChatEvent({ type: 'session.schedules', sessionId: 's', schedules })
    expect(harnessSession().sessionSchedules).toEqual([])
    const current = harnessSession()
    expect(
      chatReducer(current, {
        type: 'RECV_EVENT',
        event: { type: 'session.schedules', sessionId: 's', schedules }
      })
    ).toBe(current)
    ingestChatEvent(activitySnapshot(1, 'idle', { sessionSchedules: schedules }))
    expect(harnessSession().sessionSchedules).toEqual([])
  })

  it('stopping the current response does not claim that future scheduled prompts were deleted', () => {
    ingestChatEvent(activitySnapshot(1, 'listening', { sessionSchedules: schedules }))
    const stopped = chatReducer(harnessSession(), { type: 'CANCEL_CHAT' })
    expect(stopped.inflight).toBe(false)
    expect(stopped.sessionSchedules).toEqual(schedules)
  })

  it('preserves incoming prompt origin in the committed message and deduplicates its receipt', () => {
    const event = {
      type: 'message.committed' as const,
      sessionId: 's',
      ids: ['scheduled-delivery-1'],
      text: '정기 점검을 진행하세요.',
      messageId: 1,
      createdAt: 12,
      origin: { kind: 'scheduled' as const, label: '매일 점검' }
    }
    ingestChatEvent(event)
    ingestChatEvent(event)
    expect(harnessSession().messages).toHaveLength(1)
    expect(harnessSession().messages[0]).toMatchObject({
      role: 'user',
      createdAt: 12,
      parts: [{ type: 'text', text: event.text, origin: event.origin }]
    })
  })

  it('hydrates schedules from the runtime snapshot, keeps omitted fields and clears only explicit empty lists', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        agentKind: 'work',
        backend: 'claude',
        title: null,
        messages: [],
        activity: activitySnapshot(1, 'idle', { sessionSchedules: schedules })
      }
    })
    expect(loaded.sessionSchedules).toEqual(schedules)
    const omitted = chatReducer(loaded, {
      type: 'RECV_EVENT',
      event: activitySnapshot(2, 'idle')
    })
    expect(omitted.sessionSchedules).toEqual(schedules)
    const cleared = chatReducer(omitted, {
      type: 'RECV_EVENT',
      event: activitySnapshot(3, 'idle', { sessionSchedules: [] })
    })
    expect(cleared.sessionSchedules).toEqual([])
    const olderLoad = chatReducer(cleared, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        agentKind: 'work',
        backend: 'claude',
        title: null,
        messages: [],
        activity: activitySnapshot(2, 'idle', { sessionSchedules: schedules })
      }
    })
    expect(olderLoad.sessionSchedules).toEqual([])
  })
})
