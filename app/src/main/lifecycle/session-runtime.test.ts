import { describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../shared/ipc'
import { OneShotSessionRuntime, type RuntimeAdapterPort } from './session-runtime'
import type { TurnRequest } from '../extensions/types'

function req(): TurnRequest {
  return {
    sessionId: 's1',
    text: 'hi',
    cwd: '/tmp',
    extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
  }
}

function adapterFor(events: NormalizedEvent[], close = vi.fn()): RuntimeAdapterPort {
  return {
    sendMessage: () => ({
      events: (async function* () {
        for (const ev of events) yield ev
      })(),
      setPermissionMode: async () => {},
      interrupt: async () => {},
      setModel: async () => {},
      stopTask: async () => {},
      backgroundTask: async () => false,
      close
    })
  }
}

describe('OneShotSessionRuntime', () => {
  it('consumes only NormalizedEvent stream and closes on terminal event', async () => {
    const close = vi.fn()
    const runtime = new OneShotSessionRuntime(
      adapterFor([{ type: 'telemetry', sessionId: 's1' }], close)
    )

    const seen: NormalizedEvent[] = []
    for await (const ev of runtime.send(req())) seen.push(ev)

    expect(seen).toEqual([{ type: 'telemetry', sessionId: 's1' }])
    expect(runtime.state.state).toBe('live')
    expect(close).toHaveBeenCalled()
  })

  it('keeps consumer behavior mode-invariant for alternate close policies', async () => {
    const events: NormalizedEvent[] = [
      { type: 'message.delta', sessionId: 's1', delta: { text: 'a' } },
      { type: 'telemetry', sessionId: 's1' }
    ]
    const oneShot = new OneShotSessionRuntime(adapterFor(events))
    const fakePersistent = new OneShotSessionRuntime(adapterFor(events, vi.fn()))

    const consume = async (runtime: OneShotSessionRuntime): Promise<string[]> => {
      const out: string[] = []
      for await (const ev of runtime.send(req())) {
        out.push(ev.type)
      }
      return out
    }

    await expect(consume(oneShot)).resolves.toEqual(['message.delta', 'telemetry'])
    await expect(consume(fakePersistent)).resolves.toEqual(['message.delta', 'telemetry'])
  })
})
