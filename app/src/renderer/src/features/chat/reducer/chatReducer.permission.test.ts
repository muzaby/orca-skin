import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

// 0067 pending-first — 구 SEND_USER_MESSAGE 의 테스트 등가물(BEGIN_TURN + echo 커밋 승격).
const sendUser = (s: ChatState, text: string): ChatState =>
  chatReducer(chatReducer(s, { type: 'BEGIN_TURN' }), {
    type: 'APPEND_COMMITTED_USER_MESSAGE',
    text
  })

describe('chatReducer — 권한 모드', () => {
  it('기본값은 auto_classified', () => {
    expect(initialChatState.permissionMode).toBe('auto_classified')
  })

  it('SET_PERMISSION_MODE 가 모드를 갱신', () => {
    const s = chatReducer(initialChatState, { type: 'SET_PERMISSION_MODE', mode: 'accept_edits' })
    expect(s.permissionMode).toBe('accept_edits')
  })

  it('NEW_CHAT 는 모드를 기본값으로 리셋', () => {
    const edited = chatReducer(initialChatState, {
      type: 'SET_PERMISSION_MODE',
      mode: 'accept_edits'
    })
    expect(edited.permissionMode).toBe('accept_edits')
    const fresh = chatReducer(edited, { type: 'NEW_CHAT' })
    expect(fresh.permissionMode).toBe('auto_classified')
  })

  it('턴 시작(BEGIN_TURN)·커밋은 현재 모드를 유지', () => {
    const edited = chatReducer(initialChatState, {
      type: 'SET_PERMISSION_MODE',
      mode: 'accept_edits'
    })
    const sent = sendUser(edited, 'hi')
    expect(sent.permissionMode).toBe('accept_edits')
  })
})

describe('chatReducer — 모델 선택', () => {
  it('세션 전에는 provider/model 선택을 자유롭게 갱신한다', () => {
    const s = chatReducer(initialChatState, {
      type: 'SET_MODEL',
      providerKey: 'claude-bedrock',
      modelFamily: 'sonnet',
      modelAlias: null,
      adapter: 'claude'
    })
    expect(s.providerKey).toBe('claude-bedrock')
    expect(s.modelFamily).toBe('sonnet')
  })

  it('세션 후에는 타 adapter 선택을 차단하고 같은 adapter provider 전환은 허용한다', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's1',
        backend: 'claude',
        title: null,
        providerKey: 'claude',
        messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'hi' }] }]
      }
    })
    const blocked = chatReducer(loaded, {
      type: 'SET_MODEL',
      providerKey: 'opencode-openai',
      modelFamily: 'gpt',
      modelAlias: null,
      adapter: 'opencode'
    })
    expect(blocked.providerKey).toBe('claude')

    const switched = chatReducer(loaded, {
      type: 'SET_MODEL',
      providerKey: 'claude-bedrock',
      modelFamily: 'sonnet',
      modelAlias: null,
      adapter: 'claude'
    })
    expect(switched.providerKey).toBe('claude-bedrock')
    expect(switched.modelFamily).toBe('sonnet')
  })

  it('NEW_CHAT 는 모델 선택을 리셋하고 LOAD_SESSION 은 providerKey 를 복원한다', () => {
    const selected = chatReducer(initialChatState, {
      type: 'SET_MODEL',
      providerKey: 'claude-bedrock',
      modelFamily: 'sonnet',
      modelAlias: null,
      adapter: 'claude'
    })
    expect(chatReducer(selected, { type: 'NEW_CHAT' }).providerKey).toBeNull()

    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's1',
        backend: 'claude',
        title: null,
        providerKey: 'claude-bedrock',
        messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'hi' }] }]
      }
    })
    expect(loaded.providerKey).toBe('claude-bedrock')
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

// 0215 VP-13 (R-04 ↔ AT-12 · §10 EP-13) — 모델 전환이 지원하지 않는 모드를 내려앉힌다.
describe('SET_MODEL — 자동 권한 강등 (AT-12 · D-010)', () => {
  const withMode = (mode: 'auto_classified' | 'plan'): ChatState => ({
    ...initialChatState,
    permissionMode: mode
  })
  const pick = (state: ChatState, modelFamily: string, modelAlias: string): ChatState =>
    chatReducer(state, {
      type: 'SET_MODEL',
      providerKey: 'claude-anthropic',
      modelFamily,
      modelAlias
    })

  it('자동 상태에서 haiku 로 바꾸면 편집 자동 수락이 된다', () => {
    expect(pick(withMode('auto_classified'), 'claude-haiku-4-5', 'haiku').permissionMode).toBe(
      'accept_edits'
    )
  })

  it('이름에 haiku 가 없어도 alias 가 haiku 면 강등된다 — alias 축', () => {
    expect(pick(withMode('auto_classified'), 'corp-fast-1', 'haiku').permissionMode).toBe(
      'accept_edits'
    )
  })

  it('양성 짝 — 비-haiku 로 바꾸면 자동이 유지된다', () => {
    expect(pick(withMode('auto_classified'), 'claude-sonnet-4-6', 'sonnet').permissionMode).toBe(
      'auto_classified'
    )
  })

  it('자동이 아닌 모드는 haiku 로 바꿔도 그대로다', () => {
    expect(pick(withMode('plan'), 'claude-haiku-4-5', 'haiku').permissionMode).toBe('plan')
  })

  it('선택 alias 가 상태에 남는다 — 다음 판정의 입력이다', () => {
    expect(pick(withMode('plan'), 'corp-fast-1', 'haiku').modelAlias).toBe('haiku')
  })
})
