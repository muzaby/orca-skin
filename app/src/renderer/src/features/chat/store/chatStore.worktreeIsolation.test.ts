// 격리 선택이 **`chat:send` 페이로드까지 실제로 나가는지** — AC2 · VP-01 의 `store → schema` hop.
//
// 리듀서(`chatReducer.worktree.test.ts`)와 칩(`CwdPanel.isolation.test.ts`)이 각자 자기 축을
// 잠그지만 그 사이의 페이로드 조립은 어느 쪽도 보지 않았다. 사용자가 칩을 켜고 리듀서가 그것을
// 기록해도 IPC 직전에 조용히 버려지면 worktree 는 만들어지지 않고 오류도 없다(verify r12 D33).
// 형제 `chatStore.extraDirs.test.ts` 와 같은 하네스로 window.orca.chat.send 가 받은 인자를 본다.
//
// 렌더러의 `SendChatMessage` 조립 지점은 셋이다 — 신규 세션·확정 세션(둘 다 `send`)과
// `startHandoff`. D-004 가 격리를 **신규 일반 세션 전용**으로 못박으므로 나머지 둘은 음성 축이고,
// fork draft 는 `continuityDraftSession` 이 원본 선택을 승계하지 않아야 같은 계약이 선다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatActions, useChatStore, NEW_CHAT_KEY } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { initialChatState, type ChatState } from '../reducer/chatReducer'

let chatSend: ReturnType<typeof installChatStoreHarness>['chatSend']

// 확정 세션 축은 하네스 기본 시드(활성 키 's' · sessionId 's')를 그대로 쓴다. 랜딩 축만
// NEW_CHAT_KEY 로 갈아끼운다 — 신규 세션 분기는 `sessionId == null` 로 갈린다.
function seedLanding(): void {
  useChatStore.setState(
    {
      sessions: {
        [NEW_CHAT_KEY]: {
          session: { ...initialChatState, cwd: '/repo' },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      },
      activeKey: NEW_CHAT_KEY,
      pendingNewChatKey: null,
      newChatQueue: [],
      recentsEpoch: 0,
      concurrencyByProjectId: {},
      draftRestore: null
    },
    true
  )
}

function patchActiveSession(patch: Partial<ChatState>): void {
  useChatStore.setState((s) => {
    const entry = s.sessions[s.activeKey]
    return {
      sessions: {
        ...s.sessions,
        [s.activeKey]: { ...entry, session: { ...entry.session, ...patch } }
      }
    }
  })
}

beforeEach(() => {
  ;({ chatSend } = installChatStoreHarness())
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => 'x' as `${string}-${string}-${string}-${string}-${string}`
  )
})

function sentPayload(): Record<string, unknown> {
  return chatSend.mock.calls[0]?.[0] as Record<string, unknown>
}

describe('chatStore — 격리 선택이 chat:send 페이로드로 나간다 (AC2 · VP-01)', () => {
  beforeEach(seedLanding)

  it('칩을 켜면 worktreeIsolation: true 가 실린다', () => {
    chatActions.setWorktreeIsolation(true)

    expect(chatActions.send('안녕')).toBe(true)
    expect(sentPayload().worktreeIsolation).toBe(true)
  })

  it('기본값(off)이면 키 자체가 없다 — main 은 부재를 비격리로 읽는다', () => {
    expect(chatActions.send('안녕')).toBe(true)
    expect(sentPayload()).not.toHaveProperty('worktreeIsolation')
  })

  it('켰다 끄면 키가 없다 — 토글이 페이로드까지 왕복한다', () => {
    chatActions.setWorktreeIsolation(true)
    chatActions.setWorktreeIsolation(false)

    chatActions.send('안녕')
    expect(sentPayload()).not.toHaveProperty('worktreeIsolation')
  })

  it('cwd 와 함께 나간다 — 격리 준비는 source cwd 를 기준점으로 받는다', () => {
    chatActions.setWorktreeIsolation(true)

    chatActions.send('안녕')
    expect(sentPayload()).toMatchObject({
      sessionId: null,
      cwd: '/repo',
      worktreeIsolation: true
    })
  })
})

describe('chatStore — 격리는 신규 일반 세션 전용이다 (AC7 · D-004)', () => {
  it('확정 세션의 send 에는 실리지 않는다 — 상태에 남아 있어도', () => {
    // 확정 세션은 `patchPendingSession` 이 막아 칩으로는 켤 수 없다. 그래도 상태가 켜진 채로
    // 조립되면 schema 가 send 를 거부하므로(AC7), 조립 지점 자신이 그것을 실지 않아야 한다.
    patchActiveSession({ worktreeIsolation: true })

    expect(chatActions.send('안녕')).toBe(true)
    expect(sentPayload()).toMatchObject({ sessionId: 's' })
    expect(sentPayload()).not.toHaveProperty('worktreeIsolation')
  })

  it('fork draft 는 원본의 선택을 승계하지 않는다', () => {
    patchActiveSession({
      worktreeIsolation: true,
      title: '원본 세션',
      messages: [
        { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q' }] },
        { role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'a' }] }
      ]
    })

    expect(chatActions.startForkDraft()).toBe(true)
    expect(chatActions.send('안녕')).toBe(true)
    expect(sentPayload()).toMatchObject({ sessionId: null, forkFrom: 's' })
    expect(sentPayload()).not.toHaveProperty('worktreeIsolation')
  })

  it('핸드오프 send 에는 실리지 않는다', () => {
    patchActiveSession({
      worktreeIsolation: true,
      messages: [
        { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q1' }] },
        { role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'a1' }] },
        { role: 'user', createdAt: 3, parts: [{ type: 'text', text: 'q2' }] }
      ]
    })

    expect(chatActions.startHandoff()).toBe(true)
    expect(sentPayload()).toMatchObject({ sessionId: null, handoffFrom: 's' })
    expect(sentPayload()).not.toHaveProperty('worktreeIsolation')
  })
})
