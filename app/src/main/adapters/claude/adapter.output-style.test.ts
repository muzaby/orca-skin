import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

const { queryMock, applyFlagSettings, calls } = vi.hoisted(() => {
  const calls: string[] = []
  const applyFlagSettings = vi.fn(async (_settings: { outputStyle: string }) => {
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

import { ClaudeAdapter } from './adapter'
import type { TurnRequest } from '../common/turn'
import type { LiveTurn } from '../common/types'

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

describe('Claude output style', () => {
  const spawnStyle = (
    preferences?: () => import('../../../shared/harness').ClaudePreferences,
    providerStyle = 'Learning'
  ): LiveTurn => {
    const channel = new ClaudeAdapter(undefined, undefined, preferences).sendMessage({
      ...baseReq(),
      providerSettings: {
        providerKey: 'fixture',
        provider: 'fixture',
        sourceRevision: '1',
        settings: { outputStyle: providerStyle, sentinel: 'kept' }
      }
    })
    channels.push(channel)
    return channel
  }
  it('starts new queries with the configured style over provider settings', () => {
    spawnStyle(() => ({ instructions: '', outputStyle: 'Proactive' }))
    const options = (queryMock.mock.calls[0][0] as { options: { settings: string } }).options
    expect(JSON.parse(options.settings)).toMatchObject({
      outputStyle: 'Proactive',
      sentinel: 'kept'
    })
    spawnStyle()
    expect(
      JSON.parse((queryMock.mock.calls[1][0] as { options: { settings: string } }).options.settings)
        .outputStyle
    ).toBe('Concise')
  })
  it('applies a changed style once before the next turn input', async () => {
    let outputStyle: import('../../../shared/harness').ClaudeOutputStyle = 'Concise'
    const channel = spawnStyle(() => ({ instructions: '', outputStyle }))
    await channel.pushTurn!({ text: 'unchanged' })
    expect(applyFlagSettings).not.toHaveBeenCalled()
    calls.length = 0
    outputStyle = 'Explanatory'
    await channel.pushTurn!({ text: 'next' })
    expect(applyFlagSettings).toHaveBeenCalledExactlyOnceWith({ outputStyle: 'Explanatory' })
    expect(calls).toEqual(['apply', 'push'])
    await channel.pushTurn!({ text: 'same' })
    expect(applyFlagSettings).toHaveBeenCalledTimes(1)
    outputStyle = 'Concise'
    await channel.pushTurn!({ text: 'back' })
    expect(applyFlagSettings).toHaveBeenLastCalledWith({ outputStyle: 'Concise' })
  })
  it('leaves the one-shot completion without a style', async () => {
    await new ClaudeAdapter(undefined, undefined, () => ({
      instructions: '',
      outputStyle: 'Learning'
    })).complete({ prompt: 'title' })
    const options = (queryMock.mock.calls[0][0] as { options: { settings?: string } }).options
    expect(JSON.parse(options.settings ?? '{}')).not.toHaveProperty('outputStyle')
  })
  it('does not push or remember a rejected style update', async () => {
    let outputStyle: import('../../../shared/harness').ClaudeOutputStyle = 'Concise'
    const channel = spawnStyle(() => ({ instructions: '', outputStyle }))
    outputStyle = 'Learning'
    applyFlagSettings.mockRejectedValueOnce(new Error('style rejected'))
    await expect(channel.pushTurn!({ text: 'next' })).rejects.toThrow('style rejected')
    expect(calls).toEqual([])
    await channel.pushTurn!({ text: 'retry' })
    expect(calls).toEqual(['apply', 'push'])
  })
})
