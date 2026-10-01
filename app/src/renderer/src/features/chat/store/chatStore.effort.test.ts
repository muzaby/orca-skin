import { beforeEach, describe, expect, it } from 'vitest'
import type { EffortLevel } from '../../../../../shared/ipc'
import { chatActions, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'

let harness: ReturnType<typeof installChatStoreHarness>

const active = (): ReturnType<typeof useChatStore.getState>['sessions'][string]['session'] => {
  const state = useChatStore.getState()
  return state.sessions[state.activeKey].session
}

beforeEach(() => {
  harness = installChatStoreHarness()
})

describe('0246 AC6·AC8 — effort payload and continuity', () => {
  it.each<{ model: string; effort: EffortLevel; sessionId: string | null }>([
    { model: 'claude-opus-5-5', effort: 'medium', sessionId: null },
    { model: 'my-gateway-model', effort: 'high', sessionId: null },
    { model: 'opus', effort: 'medium', sessionId: null },
    { model: 'claude-opus-5-5', effort: 'medium', sessionId: 's' },
    { model: 'my-gateway-model', effort: 'high', sessionId: 's' },
    { model: 'opus', effort: 'medium', sessionId: 's' }
  ])('$model → $effort in session $sessionId', ({ model, effort, sessionId }) => {
    harness = installChatStoreHarness({ sessionId, effort: 'max' })
    chatActions.setModel('claude-anthropic', model, 'opus', 'claude')
    expect(active().effort).toBe(effort)
    expect(chatActions.send('hello')).toBe(true)
    expect(harness.chatSend).toHaveBeenCalledWith(expect.objectContaining({ sessionId, effort }))
  })

  it('fork draft copies effort and selection through its first send', () => {
    harness = installChatStoreHarness({
      providerKey: 'claude-anthropic',
      modelFamily: 'opus',
      modelAlias: 'opus',
      effort: 'max'
    })
    expect(chatActions.startForkDraft()).toBe(true)
    expect(active()).toMatchObject({
      effort: 'max',
      providerKey: 'claude-anthropic',
      modelFamily: 'opus',
      modelAlias: 'opus'
    })
    expect(chatActions.send('continue')).toBe(true)
    expect(harness.chatSend).toHaveBeenCalledWith(
      expect.objectContaining({ forkFrom: 's', effort: 'max' })
    )
  })

  it('handoff copies effort and selection without hydration', () => {
    harness = installChatStoreHarness({
      providerKey: 'claude-anthropic',
      modelFamily: 'opus',
      modelAlias: 'opus',
      effort: 'max',
      messages: [1, 2].map((createdAt) => ({
        role: 'user',
        createdAt,
        parts: [{ type: 'text', text: 'question' }]
      }))
    })
    expect(chatActions.startHandoff()).toBe(true)
    expect(active()).toMatchObject({
      effort: 'max',
      providerKey: 'claude-anthropic',
      modelFamily: 'opus',
      modelAlias: 'opus'
    })
    expect(harness.chatSend).toHaveBeenCalledWith(
      expect.objectContaining({ handoffFrom: 's', effort: 'max' })
    )
  })
})
