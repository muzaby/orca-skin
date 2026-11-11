import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { LiveTurn, ProviderMessageBatch } from '../../adapters/common/types'
import { concurrencyFixture } from './concurrency-identity.testfixture'

// Real buildTurnRequest + SessionRuntime + TurnCoordinator + PendingMessageQueue with a reserved
// initial prompt. Only the SDK stream is replaced.
const terminal: NormalizedEvent = { type: 'telemetry', sessionId: 's1' }

afterEach(() => vi.useRealTimers())

function failingLive(message: string): LiveTurn {
  return {
    eventBatches: (async function* (): AsyncGenerator<ProviderMessageBatch> {
      yield* []
      throw new Error(message)
    })(),
    close: () => {},
    interrupt: vi.fn(async () => undefined),
    setPermissionMode: async () => {},
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
}

function endingLive(...events: NormalizedEvent[]): LiveTurn {
  return {
    eventBatches: (async function* (): AsyncGenerator<ProviderMessageBatch> {
      yield { sequence: 0, events }
    })(),
    close: () => {},
    interrupt: vi.fn(async () => undefined),
    setPermissionMode: async () => {},
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
}

const promptText = (call: unknown): string => (call as [{ text: string }])[0].text

function setup(): ReturnType<typeof concurrencyFixture> & {
  samples: string[]
  errors: () => string[]
  retries: () => number
} {
  vi.useFakeTimers()
  const f = concurrencyFixture({ initial: 'question' })
  const samples: string[] = []
  f.pendingMessages.subscribe(() => {
    samples.push(
      f.pendingMessages.hasSubmitted('s1')
        ? 'submitted'
        : f.pendingMessages.canCommitMany('s1', f.initialBatches())
          ? 'submitting'
          : 'other'
    )
  })
  return Object.assign(f, {
    samples,
    errors: () =>
      f.events
        .filter((ev) => ev.type === 'error')
        .map((ev) => (ev as { error: { message: string } }).error.message),
    retries: () => f.events.filter((ev) => ev.type === 'turn.retrying').length
  })
}

const noStale = (f: ReturnType<typeof setup>): void => {
  expect(f.errors().filter((message) => message.includes('submission_stale:'))).toEqual([])
}

describe('turn retry resends the same reserved input (0301 R-02)', () => {
  it('A retries a zero-event stream failure on a new spawn and completes', async () => {
    const f = setup()
    f.sendMessage.mockImplementationOnce(() => failingLive('stream broke'))
    const running = f.run()
    try {
      await vi.advanceTimersByTimeAsync(0)
      expect(f.retries()).toBe(1)
      const atRetry = f.samples.length
      await vi.advanceTimersByTimeAsync(999)
      expect(f.samples.length).toBe(atRetry)
      await vi.advanceTimersByTimeAsync(1)
      expect(f.sendMessage).toHaveBeenCalledTimes(2)
      f.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'answer' } }, terminal)
      await vi.advanceTimersByTimeAsync(0)
      await running
      expect(f.samples.slice(0, 3)).toEqual(['submitted', 'submitting', 'submitted'])
      expect(f.events.map((ev) => ev.type)).toContain('telemetry')
      expect(f.errors()).toEqual([])
      const prompts = f.sendMessage.mock.calls.map(
        (call) => (call as unknown as [{ promptUuid?: string }])[0].promptUuid
      )
      expect(prompts).toEqual([f.initialBatches()[0].uuid, f.initialBatches()[0].uuid])
      noStale(f)
    } finally {
      f.cleanup()
      await running
    }
  })

  it('B ends with the original error after every retry failed', async () => {
    const f = setup()
    f.sendMessage.mockImplementation(() => failingLive('stream broke'))
    const running = f.run()
    try {
      await vi.runAllTimersAsync()
      await running
      expect(f.retries()).toBe(2)
      expect(f.sendMessage).toHaveBeenCalledTimes(3)
      expect(f.errors()).toEqual([String(new Error('stream broke'))])
      noStale(f)
    } finally {
      f.cleanup()
      await running
    }
  })

  it('C a synchronous spawn failure returns the input to held and shows the original error without a retry', async () => {
    const f = setup()
    f.sendMessage.mockImplementation(() => {
      throw new Error('Claude 네이티브 확장 설정을 읽을 수 없습니다.')
    })
    const running = f.run()
    try {
      await vi.runAllTimersAsync()
      await running
      expect(f.retries()).toBe(0)
      expect(f.sendMessage).toHaveBeenCalledTimes(1)
      expect(f.errors()).toEqual([
        String(new Error('Claude 네이티브 확장 설정을 읽을 수 없습니다.'))
      ])
      expect(f.pendingMessages.pending('s1')).toHaveLength(1)
      noStale(f)
    } finally {
      f.cleanup()
      await running
    }
  })

  it('D a reservation taken by another path during backoff ends with the original error', async () => {
    const f = setup()
    f.sendMessage.mockImplementationOnce(() => failingLive('stream broke'))
    const running = f.run()
    try {
      await vi.advanceTimersByTimeAsync(0)
      expect(f.retries()).toBe(1)
      f.pendingMessages.orphanUnconfirmed('s1')
      await vi.runAllTimersAsync()
      await running
      expect(f.sendMessage).toHaveBeenCalledTimes(1)
      expect(f.errors()).toEqual([String(new Error('stream broke'))])
      noStale(f)
    } finally {
      f.cleanup()
      await running
    }
  })

  it('E a Stop during backoff keeps the reservation submitted without a new spawn', async () => {
    const f = setup()
    f.sendMessage.mockImplementationOnce(() => failingLive('stream broke'))
    const running = f.run()
    try {
      await vi.advanceTimersByTimeAsync(0)
      expect(f.retries()).toBe(1)
      await f.stop()
      await vi.runAllTimersAsync()
      await running
      expect(f.sendMessage).toHaveBeenCalledTimes(1)
      expect(f.pendingMessages.hasSubmitted('s1')).toBe(true)
      expect(f.errors()).toEqual([])
    } finally {
      f.cleanup()
      await running
    }
  })
  // post-turn 가드 I1(0301 ΔV1 VP-18) — 실패 입력의 자동 재전송 차단은 중단되지 않은 턴에만 걸린다.
  it('F a send-now interrupt during a synchronous spawn failure still flushes the returned input', async () => {
    const f = setup()
    f.sendMessage.mockImplementationOnce(() => {
      f.active().abortContinuation = 'send-now'
      f.active().controller.abort()
      throw new Error('spawn failed')
    })
    const running = f.run()
    try {
      await vi.advanceTimersByTimeAsync(0)
      expect(f.sendMessage).toHaveBeenCalledTimes(2)
      expect(promptText(f.sendMessage.mock.calls[1])).toContain('question')
      f.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'answer' } }, terminal)
      await vi.runAllTimersAsync()
      await running
      expect(f.retries()).toBe(0)
    } finally {
      f.cleanup()
      await running
    }
  })

  it('H a flush turn that fails synchronously keeps its own input held and stops the chain', async () => {
    const f = setup()
    f.sendMessage.mockImplementationOnce(() => {
      f.queueHeld('later', 'held-1')
      return endingLive({ type: 'message.delta', sessionId: 's1', delta: { text: 'a' } }, terminal)
    })
    f.sendMessage.mockImplementationOnce(() => {
      throw new Error('flush spawn failed')
    })
    const running = f.run()
    try {
      await vi.runAllTimersAsync()
      await running
      expect(f.sendMessage).toHaveBeenCalledTimes(2)
      expect(promptText(f.sendMessage.mock.calls[1])).toContain('later')
      expect(f.pendingMessages.pending('s1').map((item) => item.id)).toEqual(['held-1'])
      expect(f.errors()).toEqual([String(new Error('flush spawn failed'))])
      expect(f.retries()).toBe(0)
    } finally {
      f.cleanup()
      await running
    }
  })
})
