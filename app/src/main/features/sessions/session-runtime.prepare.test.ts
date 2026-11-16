import { expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnRequest } from '../../adapters/common/turn'
import type { LiveTurn, ProviderMessageBatch } from '../../adapters/common/types'
import type { RuntimeSessionAdapter } from '../../contracts/ports'
import { makeClassifiedError } from '../../infra/errors'
import { getLogger } from '../../infra/log/registry'
import { SessionRuntime } from './session-runtime'

// 0324 EP-7′ — cold spawn 은 준비 → 판정 → `sendMessage` 순서다. 규칙 칸의 분기마다 한 케이스.

function req(overrides: Partial<TurnRequest> = {}): TurnRequest {
  return {
    sessionId: 's1',
    text: 'hi',
    cwd: '/w',
    extensions: { skills: [], hooks: { normalized: {} } },
    ...overrides
  }
}

// 외부에서 이벤트를 밀어 넣는 장수명 채널.
function channel(): { turn: LiveTurn; emit(event: NormalizedEvent): void; pushed: number } {
  const queue: ProviderMessageBatch[] = []
  let wake: (() => void) | null = null
  let closed = false
  let sequence = 0
  const state = {
    pushed: 0,
    emit(event: NormalizedEvent): void {
      queue.push({ sequence: sequence++, events: [event] })
      wake?.()
      wake = null
    },
    turn: {
      eventBatches: (async function* () {
        while (true) {
          while (queue.length > 0) yield queue.shift()!
          if (closed) return
          await new Promise<void>((resolve) => {
            if (closed || queue.length > 0) resolve()
            else wake = resolve
          })
        }
      })(),
      close: () => {
        closed = true
        wake?.()
        wake = null
      },
      pushTurn: async () => {
        state.pushed += 1
        return { kind: 'accepted' as const }
      },
      setPermissionMode: async () => {},
      interrupt: async () => undefined,
      setModel: async () => {},
      stopTask: async () => {},
      backgroundTask: async () => false
    } satisfies LiveTurn
  }
  return state
}

function adapterWith(
  turn: LiveTurn,
  extra: Partial<RuntimeSessionAdapter> = {}
): RuntimeSessionAdapter & { sendMessage: ReturnType<typeof vi.fn> } {
  return {
    id: 'claude',
    complete: async () => '',
    sendMessage: vi.fn<(req: TurnRequest) => LiveTurn>(() => turn),
    classifyError: (err) => makeClassifiedError('stream_error', String(err), { retryable: true }),
    ...extra
  } as RuntimeSessionAdapter & { sendMessage: ReturnType<typeof vi.fn> }
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const item of iterable) out.push(item)
  return out
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const TERMINAL: NormalizedEvent = { type: 'telemetry', sessionId: 's1' }

it('준비가 돌려준 값을 판정 뒤 sendMessage 의 prepared 로 그대로 싣는다', async () => {
  const ch = channel()
  const prepared = { marker: 'prepared-by-adapter' }
  const order: string[] = []
  const adapter = adapterWith(ch.turn, {
    prepareTurn: vi.fn(async () => {
      order.push('prepare')
      return prepared
    })
  })
  adapter.sendMessage.mockImplementation(() => {
    order.push('send')
    return ch.turn
  })
  const runtime = new SessionRuntime(adapter)
  const done = collect(
    runtime.send(
      req({
        canSubmitInitial: () => {
          order.push('admission')
          return true
        }
      })
    )
  )
  await tick()
  ch.emit(TERMINAL)
  await done
  expect(order).toEqual(['prepare', 'admission', 'send'])
  expect(adapter.sendMessage).toHaveBeenCalledOnce()
  expect((adapter.sendMessage.mock.calls[0][0] as TurnRequest).prepared).toBe(prepared)
  runtime.teardownChannel()
})

it('준비 뒤 판정이 거절하면 띄우지 않고 최초 제출을 되돌린다', async () => {
  const adapter = adapterWith(channel().turn, { prepareTurn: async () => ({}) })
  const rollback = vi.fn()
  const runtime = new SessionRuntime(adapter)
  await expect(
    collect(
      runtime.send(req({ canSubmitInitial: () => false, rollbackInitialSubmission: rollback }))
    )
  ).rejects.toThrow('submission_stale:before-spawn')
  expect(adapter.sendMessage).not.toHaveBeenCalled()
  expect(rollback).toHaveBeenCalledOnce()
})

it('준비가 실패하면 같은 오류를 전파하고 띄우지 않는다', async () => {
  const failure = new Error('catalog unreadable')
  const adapter = adapterWith(channel().turn, { prepareTurn: async () => Promise.reject(failure) })
  const rollback = vi.fn()
  const info = vi.spyOn(getLogger().child('engine'), 'info')
  const runtime = new SessionRuntime(adapter)
  try {
    await expect(collect(runtime.send(req({ rollbackInitialSubmission: rollback })))).rejects.toBe(
      failure
    )
    expect(adapter.sendMessage).not.toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledOnce()
    expect(info.mock.calls.map(([event]) => event)).not.toContain('engine.spawn.started')
  } finally {
    info.mockRestore()
  }
})

it('준비 중 취소되면 신호가 abort 되고 띄우지 않는다', async () => {
  let release!: () => void
  let seen: AbortSignal | undefined
  const adapter = adapterWith(channel().turn, {
    prepareTurn: (_req, signal) => {
      seen = signal
      return new Promise<unknown>((resolve) => {
        release = () => resolve({})
      })
    }
  })
  const rollback = vi.fn()
  const runtime = new SessionRuntime(adapter)
  const done = collect(runtime.send(req({ rollbackInitialSubmission: rollback })))
  const settled = expect(done).rejects.toThrow('submission_cancelled:before-spawn')
  await tick()
  expect(seen?.aborted).toBe(false)
  runtime.markAborted('user_cancelled')
  expect(seen?.aborted).toBe(true)
  release()
  await settled
  expect(adapter.sendMessage).not.toHaveBeenCalled()
  expect(rollback).toHaveBeenCalledOnce()
})

it('prepareTurn 이 없는 어댑터는 prepared 없이 그대로 띄운다', async () => {
  const ch = channel()
  const adapter = adapterWith(ch.turn)
  const runtime = new SessionRuntime(adapter)
  const done = collect(runtime.send(req()))
  await tick()
  ch.emit(TERMINAL)
  await done
  expect(adapter.sendMessage).toHaveBeenCalledOnce()
  expect('prepared' in (adapter.sendMessage.mock.calls[0][0] as TurnRequest)).toBe(false)
  runtime.teardownChannel()
})

it('살아 있는 채널의 후속 턴은 준비 단계를 부르지 않는다', async () => {
  const ch = channel()
  const prepareTurn = vi.fn(async () => ({}))
  const adapter = adapterWith(ch.turn, { prepareTurn })
  const runtime = new SessionRuntime(adapter)
  const first = collect(runtime.send(req()))
  await tick()
  ch.emit(TERMINAL)
  await first
  const second = collect(runtime.send(req({ text: 'again' })))
  await tick()
  ch.emit(TERMINAL)
  await second
  expect(ch.pushed).toBe(1)
  expect(adapter.sendMessage).toHaveBeenCalledOnce()
  expect(prepareTurn).toHaveBeenCalledOnce()
  runtime.teardownChannel()
})
