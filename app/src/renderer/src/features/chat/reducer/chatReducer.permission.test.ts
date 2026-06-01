import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState } from './chatReducer'

describe('chatReducer — 권한 모드', () => {
  it('기본값은 plan', () => {
    expect(initialChatState.permissionMode).toBe('plan')
  })

  it('SET_PERMISSION_MODE 가 모드를 갱신', () => {
    const s = chatReducer(initialChatState, { type: 'SET_PERMISSION_MODE', mode: 'acceptEdits' })
    expect(s.permissionMode).toBe('acceptEdits')
  })

  it('NEW_CHAT 는 모드를 plan 으로 리셋', () => {
    const edited = chatReducer(initialChatState, {
      type: 'SET_PERMISSION_MODE',
      mode: 'acceptEdits'
    })
    expect(edited.permissionMode).toBe('acceptEdits')
    const fresh = chatReducer(edited, { type: 'NEW_CHAT' })
    expect(fresh.permissionMode).toBe('plan')
  })

  it('SEND_USER_MESSAGE 는 현재 모드를 유지', () => {
    const edited = chatReducer(initialChatState, {
      type: 'SET_PERMISSION_MODE',
      mode: 'acceptEdits'
    })
    const sent = chatReducer(edited, { type: 'SEND_USER_MESSAGE', text: 'hi' })
    expect(sent.permissionMode).toBe('acceptEdits')
  })
})
