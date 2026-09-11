import { describe, expect, it } from 'vitest'
import type { AgentKind } from '../../../../../shared/agent-kind'
import type { LoadedSession } from '../../../../../shared/ipc'
import { chatReducer, initialChatState } from './chatReducer'

describe('product identity at renderer boundaries', () => {
  it.each([undefined, 'coding'])('normalizes the supported legacy loaded value %s', (agentKind) => {
    const session = { id: 'old', backend: 'claude', title: null, messages: [], agentKind }
    expect(
      chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: session as unknown as LoadedSession
      }).agentKind
    ).toBe('code')
  })
  it('creates a first-run Work draft while legacy loaded sessions remain Code', () => {
    expect(initialChatState.agentKind).toBe('work')
  })

  it('rejects an invalid selection without creating a Code or Work session', () => {
    expect(() =>
      chatReducer(initialChatState, { type: 'SET_AGENT_KIND', kind: 'other' as AgentKind })
    ).toThrow()
  })

  it('rejects an invalid loaded kind instead of treating it as Code', () => {
    expect(() =>
      chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: {
          id: 'invalid',
          backend: 'claude',
          title: null,
          messages: [],
          agentKind: 'other' as AgentKind
        }
      })
    ).toThrow()
  })
})
