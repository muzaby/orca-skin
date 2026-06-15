import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState } from './chatReducer'

describe('chatReducer — 권한 모드', () => {
  it('기본값은 plan', () => {
    expect(initialChatState.permissionMode).toBe('plan')
  })

  it('SET_PERMISSION_MODE 가 모드를 갱신', () => {
    const s = chatReducer(initialChatState, { type: 'SET_PERMISSION_MODE', mode: 'accept_edits' })
    expect(s.permissionMode).toBe('accept_edits')
  })

  it('NEW_CHAT 는 모드를 plan 으로 리셋', () => {
    const edited = chatReducer(initialChatState, {
      type: 'SET_PERMISSION_MODE',
      mode: 'accept_edits'
    })
    expect(edited.permissionMode).toBe('accept_edits')
    const fresh = chatReducer(edited, { type: 'NEW_CHAT' })
    expect(fresh.permissionMode).toBe('plan')
  })

  it('SEND_USER_MESSAGE 는 현재 모드를 유지', () => {
    const edited = chatReducer(initialChatState, {
      type: 'SET_PERMISSION_MODE',
      mode: 'accept_edits'
    })
    const sent = chatReducer(edited, { type: 'SEND_USER_MESSAGE', text: 'hi' })
    expect(sent.permissionMode).toBe('accept_edits')
  })
})

describe('chatReducer — 모델 선택', () => {
  it('세션 전에는 provider/model 선택을 자유롭게 갱신한다', () => {
    const s = chatReducer(initialChatState, {
      type: 'SET_MODEL',
      providerKey: 'claude-code-bedrock',
      modelFamily: 'sonnet',
      adapter: 'claude-code'
    })
    expect(s.providerKey).toBe('claude-code-bedrock')
    expect(s.modelFamily).toBe('sonnet')
  })

  it('세션 후에는 타 adapter 선택을 차단하고 같은 adapter provider 전환은 허용한다', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's1',
        backend: 'claude-code',
        title: null,
        providerKey: 'claude-code',
        messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'hi' }] }]
      }
    })
    const blocked = chatReducer(loaded, {
      type: 'SET_MODEL',
      providerKey: 'opencode-openai',
      modelFamily: 'gpt',
      adapter: 'opencode'
    })
    expect(blocked.providerKey).toBe('claude-code')

    const switched = chatReducer(loaded, {
      type: 'SET_MODEL',
      providerKey: 'claude-code-bedrock',
      modelFamily: 'sonnet',
      adapter: 'claude-code'
    })
    expect(switched.providerKey).toBe('claude-code-bedrock')
    expect(switched.modelFamily).toBe('sonnet')
  })

  it('NEW_CHAT 는 모델 선택을 리셋하고 LOAD_SESSION 은 providerKey 를 복원한다', () => {
    const selected = chatReducer(initialChatState, {
      type: 'SET_MODEL',
      providerKey: 'claude-code-bedrock',
      modelFamily: 'sonnet',
      adapter: 'claude-code'
    })
    expect(chatReducer(selected, { type: 'NEW_CHAT' }).providerKey).toBeNull()

    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's1',
        backend: 'claude-code',
        title: null,
        providerKey: 'claude-code-bedrock',
        messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'hi' }] }]
      }
    })
    expect(loaded.providerKey).toBe('claude-code-bedrock')
    expect(loaded.modelFamily).toBeNull()
  })
})

describe('chatReducer — effort', () => {
  it('기본 작업량은 high 이고 SET_EFFORT 로 변경된다', () => {
    expect(initialChatState.effort).toBe('high')
    const s = chatReducer(initialChatState, { type: 'SET_EFFORT', effort: 'xhigh' })
    expect(s.effort).toBe('xhigh')
  })
})
