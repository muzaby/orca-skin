import { describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../shared/ipc'
import { makeClassifiedError } from '../runtime-errors/classifier'
import type { TurnRequest } from '../extensions/types'
import type { RuntimeLiveTurn, RuntimeSessionAdapter } from './ports'
import { OneShotSessionRuntime } from './session-runtime'

function req(): TurnRequest {
  return {
    sessionId: 's1',
    text: 'hi',
    cwd: '/w',
    extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
  }
}

function live(events: NormalizedEvent[], close = vi.fn()): RuntimeLiveTurn {
  return {
    events: (async function* () {
      for (const ev of events) yield ev
    })(),
    close,
    setPermissionMode: async () => {},
    interrupt: async () => {},
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
}

function adapter(turn: RuntimeLiveTurn): RuntimeSessionAdapter {
  return {
    id: 'claude',
    complete: async () => '',
    sendMessage: () => turn,
    classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
  }
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const item of iterable) out.push(item)
  return out
}

describe('OneShotSessionRuntime', () => {
  it('closes the live turn when a terminal event is observed', async () => {
    const close = vi.fn()
    const runtime = new OneShotSessionRuntime(
      adapter(live([{ type: 'telemetry', sessionId: 's1' }], close))
    )
    await collect(runtime.send(req()))
    expect(close).toHaveBeenCalled()
    expect(runtime.state).toBe('live')
  })

  it('keeps retry ownership outside by allowing another send after an empty failed attempt', async () => {
    let calls = 0
    const runtime = new OneShotSessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: () => {
        calls += 1
        if (calls === 1) throw new Error('retryable')
        return live([{ type: 'telemetry', sessionId: 's1' }])
      },
      classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true })
    })

    await expect(collect(runtime.send(req()))).rejects.toThrow('retryable')
    await collect(runtime.send(req()))
    expect(calls).toBe(2)
    expect(runtime.state).toBe('live')
  })
})
