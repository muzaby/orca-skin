import { describe, expect, it } from 'vitest'
import { chatActions, ingestChatEvent, otherProjectTurnCount, useChatStore } from './chatStore'
import { installConcurrencyHarness } from './chatStore.concurrency.testfixture'

const other = { sessionId: 'different', clientKey: 'draft:other' }

describe('concurrency store transport and identity', () => {
  it('S1 stores full snapshots by project, including an empty replacement', () => {
    const f = installConcurrencyHarness()
    try {
      f.emit({ projectId: 'p2', turns: [other, { sessionId: 'third', clientKey: null }] })
      f.emit({ projectId: 'p1', turns: [other] })
      expect(useChatStore.getState().concurrencyByProjectId).toEqual({
        p1: [other],
        p2: [other, { sessionId: 'third', clientKey: null }]
      })
      f.emit({ projectId: 'p1', turns: [] })
      expect(useChatStore.getState().concurrencyByProjectId.p1).toEqual([])
      expect(useChatStore.getState().concurrencyByProjectId.p2).toHaveLength(2)
    } finally {
      f.cleanup()
    }
  })

  it.each(['send', 'handoff'] as const)('S2/S3/S4 %s keeps clientKey after promotion', (action) => {
    const f = installConcurrencyHarness({
      newSession: action === 'send',
      handoffSource: action === 'handoff'
    })
    try {
      expect(action === 'send' ? chatActions.send('work') : chatActions.startHandoff()).toBe(true)
      const state = useChatStore.getState()
      const key = state.activeKey
      const payload = f.chatSend.mock.calls[0][0]
      expect(key.startsWith('draft:')).toBe(true)
      expect(payload.clientKey).toBe(key)
      expect(state.sessions[key].clientKey).toBe(key)
      ingestChatEvent({ type: 'session.updated', sessionId: 'confirmed', patch: {} })
      expect(useChatStore.getState().activeKey).toBe('confirmed')
      expect(useChatStore.getState().sessions.confirmed.clientKey).toBe(key)
      f.emit({ projectId: 'p1', turns: [{ sessionId: null, clientKey: key }] })
      expect(otherProjectTurnCount(useChatStore.getState(), 'p1')).toBe(0)
    } finally {
      f.cleanup()
    }
  })

  it('existing send does not record a new clientKey', () => {
    const f = installConcurrencyHarness()
    try {
      expect(chatActions.send('work')).toBe(true)
      expect(useChatStore.getState().sessions.s1.clientKey).toBeUndefined()
    } finally {
      f.cleanup()
    }
  })

  it.each([undefined, 'managed', 'intent'] as const)(
    'S5 selector uses displayed identity/isolation %s',
    (isolation) => {
      const f = installConcurrencyHarness({ isolation })
      try {
        f.emit({ projectId: 'p1', turns: [{ sessionId: 's1', clientKey: null }, other] })
        expect(otherProjectTurnCount(useChatStore.getState(), 'p1')).toBe(isolation ? 0 : 1)
        expect(otherProjectTurnCount(useChatStore.getState(), null)).toBe(0)
        expect(otherProjectTurnCount(useChatStore.getState(), 'missing')).toBe(0)
      } finally {
        f.cleanup()
      }
    }
  )
})
