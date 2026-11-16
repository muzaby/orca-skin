// 예약 프롬프트 릴레이 — main 의 시작 요청이 실제 chat store 의 새 대화 전송까지
// 변형 없이 가고, 결과가 보고로 돌아온다. 대체한 것은 IPC 브리지(window.oo)뿐이다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduledPromptStart } from '../../../../shared/scheduled-tasks'
import { chatActions, useChatSession } from '../../features/chat'
import { ingestChatEvent } from '../../features/chat/store/chatStore'
import {
  flushRaf,
  installChatStoreHarness,
  type ChatStoreHarness
} from '../../features/chat/store/chatStore.testHarness'
import { relayScheduledPrompt } from './useScheduledPromptRelay'

void useChatSession

const payload: ScheduledPromptStart = {
  runId: 41,
  projectId: 'project-a',
  text: '새 버그를 요약해 줘',
  execution: {
    backend: 'claude',
    agentKind: 'work',
    providerKey: 'claude:team',
    modelFamily: 'claude-sonnet-5-5',
    effort: 'low',
    permissionMode: 'plan'
  }
}

let harness: ChatStoreHarness
beforeEach(() => {
  harness = installChatStoreHarness()
})

describe('relayScheduledPrompt', () => {
  it('시작 요청의 프로젝트·본문·실행 설정이 chat:send payload 까지 그대로 간다', async () => {
    const report = vi.fn().mockResolvedValue(undefined)
    const relayed = relayScheduledPrompt(payload, { start: chatActions.startDetachedChat, report })
    expect(harness.chatSend.mock.calls[0]![0]).toMatchObject({
      sessionId: null,
      projectId: 'project-a',
      text: '새 버그를 요약해 줘',
      backend: 'claude',
      agentKind: 'work',
      providerKey: 'claude:team',
      modelFamily: 'claude-sonnet-5-5',
      effort: 'low',
      permissionMode: 'plan'
    })
    ingestChatEvent({ type: 'session.updated', sessionId: 'session-77', patch: {} })
    flushRaf()
    await relayed
    expect(report).toHaveBeenCalledExactlyOnceWith({
      runId: 41,
      ok: true,
      sessionId: 'session-77'
    })
  })

  it('시작이 실패하면 같은 runId 로 사유를 보고한다', async () => {
    const report = vi.fn().mockResolvedValue(undefined)
    await relayScheduledPrompt(payload, {
      start: () => Promise.reject(new Error('로그인이 필요합니다')),
      report
    })
    expect(report).toHaveBeenCalledExactlyOnceWith({
      runId: 41,
      ok: false,
      error: '로그인이 필요합니다'
    })
  })

  it('긴 사유는 보고 상한으로 자른다', async () => {
    const report = vi.fn().mockResolvedValue(undefined)
    await relayScheduledPrompt(payload, {
      start: () => Promise.reject(new Error('x'.repeat(5000))),
      report
    })
    expect(report.mock.calls[0]![0].error).toHaveLength(2000)
  })

  // 정리는 새 대화 시작(startDetachedChat)이 한다 — 릴레이는 받은 본문을 그대로 넘긴다.
  it('시작 요청의 본문을 앞뒤 공백까지 그대로 시작 함수에 넘긴다', async () => {
    const start = vi.fn().mockResolvedValue({ sessionId: 'session-1' })
    await relayScheduledPrompt(
      { ...payload, text: '  점검 \n' },
      { start, report: vi.fn().mockResolvedValue(undefined) }
    )
    expect(start).toHaveBeenCalledExactlyOnceWith({
      projectId: 'project-a',
      text: '  점검 \n',
      execution: payload.execution
    })
  })
})
