import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEDULE_RUN_ERROR, type ScheduledPromptStart } from '../../../shared/scheduled-tasks'
import { PROMPT_REPORT_TIMEOUT_MS } from './limits'
import { PromptRelay } from './prompt-relay'

const payload = (runId: number): ScheduledPromptStart => ({
  runId,
  projectId: 'project-a',
  text: '요약해 줘',
  execution: {
    backend: 'claude',
    agentKind: 'work',
    providerKey: 'claude:team',
    modelFamily: 'claude-sonnet-5-5',
    effort: 'low',
    permissionMode: 'plan'
  }
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('PromptRelay', () => {
  it('시작 요청을 그대로 보내고 성공 보고의 세션 id 로 끝난다', async () => {
    const sent: ScheduledPromptStart[] = []
    const relay = new PromptRelay((p) => {
      sent.push(p)
      return true
    })
    const started = relay.request(payload(7), new AbortController().signal)
    expect(sent).toEqual([payload(7)])
    relay.report({ runId: 7, ok: true, sessionId: 'session-1' })
    await expect(started).resolves.toEqual({ sessionId: 'session-1' })
  })

  it('보낼 창이 없으면 창 없음으로 실패한다', async () => {
    const relay = new PromptRelay(() => false)
    await expect(relay.request(payload(1), new AbortController().signal)).rejects.toThrow(
      SCHEDULE_RUN_ERROR.noWindow
    )
  })

  it('실패 보고는 그 사유로 실패한다', async () => {
    const relay = new PromptRelay(() => true)
    const started = relay.request(payload(2), new AbortController().signal)
    relay.report({ runId: 2, ok: false, error: '로그인이 필요합니다' })
    await expect(started).rejects.toThrow('로그인이 필요합니다')
  })

  it('제한 시간 안에 보고가 없으면 시간 초과로 실패하고 늦은 보고는 무시한다', async () => {
    const relay = new PromptRelay(() => true)
    const started = relay.request(payload(3), new AbortController().signal)
    const outcome = started.then(
      () => 'resolved',
      (e: Error) => e.message
    )
    await vi.advanceTimersByTimeAsync(PROMPT_REPORT_TIMEOUT_MS - 1)
    relay.report({ runId: 99, ok: true, sessionId: 'other' })
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toBe(SCHEDULE_RUN_ERROR.reportTimeout)
    expect(() => relay.report({ runId: 3, ok: true, sessionId: 'late' })).not.toThrow()
  })

  it('보고는 runId 가 같은 요청만 끝낸다', async () => {
    const relay = new PromptRelay(() => true)
    const first = relay.request(payload(10), new AbortController().signal)
    const second = relay.request(payload(11), new AbortController().signal)
    relay.report({ runId: 11, ok: true, sessionId: 'for-11' })
    relay.report({ runId: 10, ok: true, sessionId: 'for-10' })
    await expect(first).resolves.toEqual({ sessionId: 'for-10' })
    await expect(second).resolves.toEqual({ sessionId: 'for-11' })
  })

  it('중단 신호와 dispose 는 대기를 끝낸다', async () => {
    const relay = new PromptRelay(() => true)
    const controller = new AbortController()
    const aborted = relay.request(payload(20), controller.signal)
    const disposed = relay.request(payload(21), new AbortController().signal)
    controller.abort()
    await expect(aborted).rejects.toThrow(SCHEDULE_RUN_ERROR.cancelled)
    relay.dispose()
    await expect(disposed).rejects.toThrow(SCHEDULE_RUN_ERROR.appQuit)
  })
})
