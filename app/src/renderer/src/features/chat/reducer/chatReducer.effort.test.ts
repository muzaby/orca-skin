import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatAction } from './chatReducer'

const select = (
  modelFamily: string,
  providerKey = 'claude-anthropic'
): Extract<ChatAction, { type: 'SET_MODEL' }> => ({
  type: 'SET_MODEL',
  providerKey,
  modelFamily,
  modelAlias: 'opus',
  adapter: 'claude'
})

describe('0246 AC6·AC7 — model selection resets effort', () => {
  it.each([
    ['claude-opus-5-5', 'medium'],
    ['sonnet', 'medium'],
    ['claude-opus-4-7', 'xhigh'],
    ['my-gateway-model', 'high']
  ])('%s selects its model default', (model, effort) => {
    expect(chatReducer(initialChatState, select(model)).effort).toBe(effort)
  })

  it('preserves manual effort when the same selection is assigned again', () => {
    const selected = chatReducer(initialChatState, select('claude-opus-5-5'))
    const manual = chatReducer(selected, { type: 'SET_EFFORT', effort: 'max' })
    expect(chatReducer(manual, select('claude-opus-5-5')).effort).toBe('max')
    expect(chatReducer(manual, { ...select('claude-opus-5-5'), modelAlias: null }).effort).toBe(
      'max'
    )
  })

  it('replaces manual effort when only the model changes', () => {
    const selected = chatReducer(initialChatState, select('claude-opus-5-5'))
    const manual = chatReducer(selected, { type: 'SET_EFFORT', effort: 'max' })
    expect(chatReducer(manual, select('claude-fable-5-1')).effort).toBe('high')
  })

  it('replaces manual effort when only the provider changes', () => {
    const selected = chatReducer(initialChatState, select('claude-opus-5-5'))
    const manual = chatReducer(selected, { type: 'SET_EFFORT', effort: 'max' })
    expect(chatReducer(manual, select('claude-opus-5-5', 'claude-gateway')).effort).toBe('medium')
  })

  it('preserves effort when a different adapter selection is rejected', () => {
    const state = {
      ...initialChatState,
      sessionId: 's',
      backend: 'claude' as const,
      effort: 'max' as const
    }
    expect(chatReducer(state, { ...select('claude-opus-5-5'), adapter: 'mock' })).toBe(state)
  })

  it('hydrates a loaded session with its model default', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        agentKind: 'code',
        id: 's',
        backend: 'claude',
        title: null,
        providerKey: 'claude-anthropic',
        messages: []
      }
    })
    expect(loaded.effort).toBe('high')
    expect(chatReducer(loaded, select('sonnet')).effort).toBe('medium')
  })
})
