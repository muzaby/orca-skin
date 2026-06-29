import { describe, expect, it } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnRequest } from '../../extensions/types'
import type { SessionRuntime } from '../../lifecycle/session-runtime'
import { drainRuntimeEventsForTest } from './send'

function req(): TurnRequest {
  return {
    sessionId: 's1',
    text: 'hi',
    cwd: '/tmp',
    extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
  }
}

class FakeSessionRuntime implements SessionRuntime {
  state = { state: 'live' as const, abortCause: null }

  constructor(
    private readonly events: NormalizedEvent[],
    private readonly closePolicy: 'oneshot' | 'persistent-like'
  ) {}

  async *send(): AsyncIterable<NormalizedEvent> {
    for (const ev of this.events) yield ev
    void this.closePolicy
  }

  async interrupt(): Promise<void> {
    return undefined
  }
  async setMode(): Promise<void> {
    return undefined
  }
  async setModel(): Promise<void> {
    return undefined
  }
  async stopTask(): Promise<void> {
    return undefined
  }
  async backgroundTask(): Promise<boolean> {
    return false
  }
  push(): void {
    return undefined
  }
  close(): void {
    return undefined
  }
}

describe('send runtime consumer mode invariance', () => {
  it('동일 NormalizedEvent 스트림이면 close policy 와 무관하게 소비 결과가 같다', async () => {
    const events: NormalizedEvent[] = [
      { type: 'message.delta', sessionId: 's1', delta: { text: 'a' } },
      { type: 'telemetry', sessionId: 's1' }
    ]

    await expect(
      drainRuntimeEventsForTest(new FakeSessionRuntime(events, 'oneshot'), req())
    ).resolves.toEqual(events)
    await expect(
      drainRuntimeEventsForTest(new FakeSessionRuntime(events, 'persistent-like'), req())
    ).resolves.toEqual(events)
  })
})
