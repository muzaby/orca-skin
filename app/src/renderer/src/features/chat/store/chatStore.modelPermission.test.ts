// 0215 VP-13 (R-04 ↔ AT-13 · §10 EP-14) — 모델 전환으로 권한이 강등되면 **main 도** 그 값을 읽는다.
//
// reducer(상태 정본)만 고치면 controller 와 진행 중 턴이 '자동'을 계속 믿는다. 그래서 강등이
// 실제로 일어난 경우에만 `orca:permission:setMode` 가 나가는지를 본다 — 호출 여부가 아니라
// **어떤 값으로** 나갔는지가 계약이다.
import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'

let harness: ReturnType<typeof installChatStoreHarness>

const mode = (): string =>
  useChatStore.getState().sessions[useChatStore.getState().activeKey].session.permissionMode

beforeEach(() => {
  harness = installChatStoreHarness({ permissionMode: 'auto_classified' })
})

describe('setModel — 강등 시 main 동기화 (AT-13)', () => {
  it('haiku 로 바꾸면 accept_edits 로 상태와 IPC 가 함께 간다', () => {
    chatActions.setModel('claude-anthropic', 'claude-haiku-4-5', 'haiku', 'claude')
    expect(mode()).toBe('accept_edits')
    expect(harness.permissionSetMode).toHaveBeenCalledTimes(1)
    expect(harness.permissionSetMode).toHaveBeenCalledWith({
      sessionId: 's',
      mode: 'accept_edits'
    })
  })

  it('강등이 없으면 IPC 를 발행하지 않는다 — 음성 짝', () => {
    chatActions.setModel('claude-anthropic', 'claude-sonnet-4-6', 'sonnet', 'claude')
    expect(mode()).toBe('auto_classified')
    expect(harness.permissionSetMode).not.toHaveBeenCalled()
  })

  it('이미 accept_edits 면 같은 값으로 다시 보내지 않는다', () => {
    installChatStoreHarness({ permissionMode: 'accept_edits' })
    chatActions.setModel('claude-anthropic', 'claude-haiku-4-5', 'haiku', 'claude')
    expect(mode()).toBe('accept_edits')
  })
})
