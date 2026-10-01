import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

const { queryMock, applyFlagSettings, calls } = vi.hoisted(() => {
  const calls: string[] = []
  const applyFlagSettings = vi.fn(async (_settings: { effortLevel: string }) => {
    void _settings
    calls.push('apply')
  })
  return {
    calls,
    applyFlagSettings,
    queryMock: vi.fn((_req: unknown) => {
      void _req
      return {
        async *[Symbol.asyncIterator]() {
          yield* []
        },
        setPermissionMode: vi.fn(),
        interrupt: vi.fn(),
        setModel: vi.fn(),
        close: vi.fn(),
        applyFlagSettings
      }
    })
  }
})

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }))
vi.mock('./streaming-input', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./streaming-input')>()
  return {
    ...actual,
    createSessionInputStream: (...args: Parameters<typeof actual.createSessionInputStream>) => {
      const input = actual.createSessionInputStream(...args)
      return {
        ...input,
        push: (...next: Parameters<typeof input.push>) => {
          calls.push('push')
          return input.push(...next)
        }
      }
    }
  }
})

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'
import type { LiveTurn } from './types'

const baseReq = (): TurnRequest => ({
  sessionId: null,
  text: 'hello',
  cwd: '/tmp',
  extensions: {
    skills: [],
    hooks: { normalized: {} }
  }
})

const channels: LiveTurn[] = []
const spawn = (effort: TurnRequest['effort'] = 'high'): LiveTurn => {
  const channel = new ClaudeAdapter().sendMessage({ ...baseReq(), ...(effort ? { effort } : {}) })
  channels.push(channel)
  return channel
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  applyFlagSettings.mockImplementation(async () => {
    calls.push('apply')
  })
})
afterEach(() => {
  for (const channel of channels.splice(0)) channel.close()
})

describe('ClaudeAdapter — effort', () => {
  it('TurnRequest.effort 를 SDK query options 로 전달한다', () => {
    spawn('xhigh')
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock.mock.calls[0]?.[0]).toHaveProperty('options.effort', 'xhigh')
  })

  it('0246 AC10 — same spawn effort and undefined do not apply settings', async () => {
    const channel = spawn('medium')
    await channel.pushTurn!({ text: 'same', effort: 'medium' })
    await channel.pushTurn!({ text: 'unspecified' })
    expect(applyFlagSettings).not.toHaveBeenCalled()
    expect(calls).toEqual(['push', 'push'])
  })

  it('0246 AC10 — applies a changed effort exactly once before pushing input', async () => {
    const channel = spawn()
    expect(await channel.pushTurn!({ text: 'next', effort: 'low' })).toEqual({ kind: 'accepted' })
    expect(applyFlagSettings).toHaveBeenCalledExactlyOnceWith({ effortLevel: 'low' })
    expect(calls).toEqual(['apply', 'push'])
    await channel.pushTurn!({ text: 'same', effort: 'low' })
    expect(applyFlagSettings).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['apply', 'push', 'push'])
  })

  it('0246 AC10 — rejected setter leaves input unsubmitted and retries the same value', async () => {
    const channel = spawn()
    applyFlagSettings.mockRejectedValueOnce(new Error('fixture setter failure'))
    await expect(channel.pushTurn!({ text: 'retry', effort: 'low' })).rejects.toThrow(
      'fixture setter failure'
    )
    expect(calls).toEqual([])
    expect(await channel.pushTurn!({ text: 'retry', effort: 'low' })).toEqual({ kind: 'accepted' })
    expect(applyFlagSettings).toHaveBeenCalledTimes(2)
    expect(calls).toEqual(['apply', 'push'])
  })

  it('keeps applied effort local to each channel and waits for setter acknowledgement', async () => {
    const first = spawn()
    const second = spawn()
    let acknowledge: (() => void) | undefined
    applyFlagSettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve
        })
    )
    const pending = first.pushTurn!({ text: 'next', effort: 'low' })
    expect(calls).toEqual([])
    acknowledge!()
    await pending
    expect(calls).toEqual(['push'])
    await second.pushTurn!({ text: 'next', effort: 'low' })
    expect(applyFlagSettings).toHaveBeenCalledTimes(2)
    expect(calls).toEqual(['push', 'apply', 'push'])
  })
})
