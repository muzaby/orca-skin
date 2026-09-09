import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

// 0067 pending-first — 구 SEND_USER_MESSAGE 의 테스트 등가물(BEGIN_TURN + echo 커밋 승격).
const sendUser = (s: ChatState, text: string): ChatState =>
  chatReducer(chatReducer(s, { type: 'BEGIN_TURN' }), {
    type: 'APPEND_COMMITTED_USER_MESSAGE',
    text
  })

describe('chatReducer — 권한 모드', () => {
  it('모델 선택 전 기본은 accept_edits', () => {
    expect(initialChatState.permissionMode).toBe('accept_edits')
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
    expect(fresh.permissionMode).toBe('accept_edits')
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

describe('r4 kind and permission transitions', () => {
  it('Coding plan becomes Work manual, then Coding retains manual', () => {
    const plan = {
      ...initialChatState,
      permissionMode: 'plan' as const,
      modelFamily: 'claude-sonnet-4-6'
    }
    const work = chatReducer(plan, { type: 'SET_AGENT_KIND', kind: 'work' })
    expect(work.permissionMode).toBe('default')
    expect(chatReducer(work, { type: 'SET_AGENT_KIND', kind: 'coding' }).permissionMode).toBe(
      'default'
    )
  })
  it('Work accepted edits and plan cannot become hidden modes', () => {
    const work = { ...initialChatState, agentKind: 'work' as const }
    for (const mode of ['accept_edits', 'plan', 'dont_ask'] as const)
      expect(chatReducer(work, { type: 'SET_PERMISSION_MODE', mode }).permissionMode).toBe(
        'default'
      )
  })
  it('Work supported auto falls back to manual on model change', () => {
    const work = {
      ...initialChatState,
      agentKind: 'work' as const,
      permissionMode: 'auto_classified' as const
    }
    expect(
      chatReducer(work, {
        type: 'SET_MODEL',
        providerKey: 'claude',
        modelFamily: 'claude-sonnet-4-5',
        modelAlias: 'sonnet'
      }).permissionMode
    ).toBe('default')
  })
  it('loaded Work starts manual and a Main settled mode updates its chip state', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: { id: 'w', backend: 'claude', agentKind: 'work', title: null, messages: [] }
    })
    expect(loaded.permissionMode).toBe('default')
    expect(
      chatReducer(
        { ...loaded, permissionMode: 'auto_classified' },
        {
          type: 'RECV_EVENT',
          event: { type: 'session.updated', sessionId: 'w', patch: { permissionMode: 'default' } }
        }
      ).permissionMode
    ).toBe('default')
  })
})

describe('r4 applied permission is distinct from next-model selection', () => {
  it('adopts actual applied mode and unrelated session patches preserve it', () => {
    const state = {
      ...initialChatState,
      agentKind: 'work' as const,
      modelFamily: 'custom',
      permissionModeError: true
    }
    const applied = chatReducer(state, { type: 'APPLY_PERMISSION_MODE', mode: 'auto_classified' })
    expect(applied.permissionMode).toBe('auto_classified')
    expect(applied.permissionModeError).toBe(false)
    const cwd = chatReducer(applied, {
      type: 'RECV_EVENT',
      event: { type: 'session.updated', sessionId: 's', patch: { cwd: '/work' } }
    })
    expect(cwd.permissionMode).toBe('auto_classified')
  })
  it('next send settled mode clears failure, metadata-only patch does not', () => {
    const state = { ...initialChatState, permissionModeError: true }
    expect(
      chatReducer(state, {
        type: 'RECV_EVENT',
        event: { type: 'session.updated', sessionId: 's', patch: { cwd: '/work' } }
      }).permissionModeError
    ).toBe(true)
    expect(
      chatReducer(state, {
        type: 'RECV_EVENT',
        event: {
          type: 'session.updated',
          sessionId: 's',
          patch: { permissionMode: 'accept_edits' }
        }
      }).permissionModeError
    ).toBe(false)
  })
})
