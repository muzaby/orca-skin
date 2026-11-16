// 분리 시작 — 예약 프롬프트가 보고 있는 대화를 바꾸지 않고 새 대화를 시작한다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromptExecution } from '../../../../../shared/scheduled-tasks'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { flushRaf, installChatStoreHarness, type ChatStoreHarness } from './chatStore.testHarness'

// 기본값(code·high·auto_classified)과 전부 다른 값 — 하나라도 기본값으로 새면 단언이 깨진다.
const execution: PromptExecution = {
  backend: 'claude',
  agentKind: 'work',
  providerKey: 'claude:team',
  modelFamily: 'claude-sonnet-5-5',
  effort: 'low',
  permissionMode: 'bypass'
}
const input = { projectId: 'project-a', text: '  새 버그를 요약해 줘  ', execution }

let harness: ChatStoreHarness
beforeEach(() => {
  harness = installChatStoreHarness()
})

const draftKeys = (): string[] =>
  Object.keys(useChatStore.getState().sessions).filter((key) => key.startsWith('draft:'))

describe('chatActions.startDetachedChat', () => {
  it('작업의 설정 그대로 새 대화를 전송하고 보고 있는 대화는 바꾸지 않는다', () => {
    void chatActions.startDetachedChat(input).catch(() => undefined)
    const [draftKey] = draftKeys()
    expect(draftKey).toBeDefined()
    expect(harness.chatSend).toHaveBeenCalledTimes(1)
    expect(harness.chatSend.mock.calls[0]![0]).toEqual({
      agentKind: 'work',
      backend: 'claude',
      sessionId: null,
      projectId: 'project-a',
      text: '새 버그를 요약해 줘',
      permissionMode: 'bypass',
      providerKey: 'claude:team',
      modelFamily: 'claude-sonnet-5-5',
      effort: 'low',
      attachments: [],
      attachmentViews: [],
      cwd: null,
      clientKey: draftKey,
      clientRequestId: expect.any(String)
    })
    const state = useChatStore.getState()
    expect(state.activeKey).toBe('s')
    expect(state.pendingNewChatKey).toBe(draftKey)
    // draft 는 첫 사용자 메시지가 커밋된 진행 중 대화다.
    const draft = state.sessions[draftKey!]!.session
    expect(draft.inflight).toBe(true)
    expect(draft.pendingProjectId).toBe('project-a')
    expect(draft.messages.map((message) => message.role)).toEqual(['user'])
    // 앞뒤 공백 정리는 여기 한 곳이다 — 전송 payload 와 낙관 커밋한 메시지가 같은 본문이다.
    expect(draft.messages[0]!.parts).toEqual([{ type: 'text', text: '새 버그를 요약해 줘' }])
  })

  it('노력을 지정하지 않으면 payload 에 싣지 않는다', () => {
    const rest = { ...execution, effort: undefined }
    void chatActions.startDetachedChat({ ...input, execution: rest }).catch(() => undefined)
    expect(harness.chatSend.mock.calls[0]![0]).not.toHaveProperty('effort')
  })

  it('세션 id 가 발급되면 그 id 로 끝나고 활성 대화는 그대로다', async () => {
    const started = chatActions.startDetachedChat(input)
    ingestChatEvent({ type: 'session.updated', sessionId: 'session-new', patch: {} })
    flushRaf()
    await expect(started).resolves.toEqual({ sessionId: 'session-new' })
    const state = useChatStore.getState()
    expect(state.activeKey).toBe('s')
    expect(state.pendingNewChatKey).toBeNull()
    expect(state.sessions['session-new']).toBeDefined()
    expect(draftKeys()).toEqual([])
  })

  it('세션을 얻지 못하고 오류로 끝나면 그 사유로 실패한다', async () => {
    const started = chatActions.startDetachedChat(input)
    ingestChatEvent({
      type: 'error',
      error: { kind: 'provider_connection_error', message: '로그인이 필요합니다', retryable: false }
    } as never)
    flushRaf()
    await expect(started).rejects.toThrow('로그인이 필요합니다')
    expect(useChatStore.getState().activeKey).toBe('s')
    expect(useChatStore.getState().pendingNewChatKey).toBeNull()
  })

  it('세션 id 없이 대화가 지워지면 실패한다', async () => {
    const started = chatActions.startDetachedChat(input)
    const [draftKey] = draftKeys()
    useChatStore.setState((state) => {
      const sessions = { ...state.sessions }
      delete sessions[draftKey!]
      return { sessions }
    })
    await expect(started).rejects.toThrow('start_failed')
  })

  it('결말이 난 뒤에는 스토어 구독을 남기지 않는다', async () => {
    const stops: ReturnType<typeof vi.fn>[] = []
    const subscribe = useChatStore.subscribe
    const spy = vi.spyOn(useChatStore, 'subscribe').mockImplementation((listener) => {
      const stop = vi.fn(subscribe(listener))
      stops.push(stop)
      return stop
    })
    try {
      const started = chatActions.startDetachedChat(input)
      expect(stops).toHaveLength(1)
      expect(stops[0]).not.toHaveBeenCalled()
      ingestChatEvent({ type: 'session.updated', sessionId: 'session-new', patch: {} })
      flushRaf()
      await started
      expect(stops[0]).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('다른 새 대화가 준비 중이면 순서를 기다렸다가 전송한다', async () => {
    const first = chatActions.startDetachedChat(input)
    const second = chatActions.startDetachedChat({ ...input, text: '두 번째' })
    expect(harness.chatSend).toHaveBeenCalledTimes(1)
    expect(useChatStore.getState().newChatQueue).toHaveLength(1)

    ingestChatEvent({ type: 'session.updated', sessionId: 'session-1', patch: {} })
    flushRaf()
    await expect(first).resolves.toEqual({ sessionId: 'session-1' })
    expect(harness.chatSend).toHaveBeenCalledTimes(2)
    expect(harness.chatSend.mock.calls[1]![0]).toMatchObject({ text: '두 번째' })

    ingestChatEvent({ type: 'session.updated', sessionId: 'session-2', patch: {} })
    flushRaf()
    await expect(second).resolves.toEqual({ sessionId: 'session-2' })
    expect(useChatStore.getState().activeKey).toBe('s')
  })

  it('빈 본문은 전송하지 않는다', async () => {
    await expect(chatActions.startDetachedChat({ ...input, text: '   ' })).rejects.toThrow()
    expect(harness.chatSend).not.toHaveBeenCalled()
  })
})
