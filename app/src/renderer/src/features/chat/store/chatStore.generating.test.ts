import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chatActions,
  ingestChatEvent,
  subscribeGeneratingSessions,
  useChatStore
} from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'

let stop: () => void
beforeEach(() => {
  installChatStoreHarness({ inflight: true })
})
afterEach(() => stop?.())

describe('0254 generating subscription', () => {
  it('emits initially and only when membership changes, never for delta frames', () => {
    const listener = vi.fn()
    stop = subscribeGeneratingSessions(listener)
    expect(listener.mock.calls).toEqual([[new Set(['s'])]])
    for (let index = 0; index < 10; index++) {
      ingestChatEvent({ type: 'message.delta', sessionId: 's', delta: { text: 'x' } })
      flushRaf()
    }
    expect(listener).toHaveBeenCalledTimes(1)
    const entry = useChatStore.getState().sessions.s
    useChatStore.setState({
      sessions: { s: entry, other: { ...entry, session: { ...entry.session, sessionId: 'other' } } }
    })
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener.mock.calls[1][0]).toEqual(new Set(['other', 's']))
    useChatStore.setState({ sessions: { ...useChatStore.getState().sessions } })
    expect(listener).toHaveBeenCalledTimes(2)
    chatActions.handleSessionDeleted('other')
    expect(listener).toHaveBeenCalledTimes(3)
    expect(listener.mock.calls[2][0]).toEqual(new Set(['s']))
    stop()
    chatActions.cancel()
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
