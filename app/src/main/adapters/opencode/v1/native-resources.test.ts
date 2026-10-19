import { describe, expect, it, vi } from 'vitest'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { openCodeNativeCommands, openCodeNativeResources } from './native-resources'

describe('OpenCode native resources', () => {
  it('projects exact command names, hints and descriptions without templates or provider configuration', async () => {
    const list = vi.fn(async () => ({
      data: [
        {
          name: 'docs:find',
          description: 'Find documentation',
          hints: ['query'],
          source: 'mcp',
          template: 'private prompt'
        },
        { name: 'review', hints: [], source: 'command', model: 'private model' }
      ]
    }))
    expect(
      await openCodeNativeCommands({ command: { list } } as unknown as OpencodeClient, 'C:/B')
    ).toEqual([
      {
        name: 'docs:find',
        description: 'Find documentation',
        argumentHint: 'query',
        source: 'mcp'
      },
      { name: 'review', description: '', argumentHint: '', source: 'harness' }
    ])
    expect(list).toHaveBeenCalledWith(
      { directory: 'C:/B' },
      expect.objectContaining({ throwOnError: true })
    )
  })
  it('reads the channel directory and returns only read-only projected resources', async () => {
    const status = vi.fn(async () => ({
      data: {
        live: { status: 'connected' },
        off: { status: 'disabled' },
        auth: { status: 'needs_auth' },
        bad: { status: 'failed', error: 'private detail' }
      }
    }))
    const get = vi.fn(async () => ({
      data: {
        plugin: [
          '@vendor/native@2',
          ['file:///private/plugin.js?token=secret', { secret: 'key' }],
          './local/relative.js'
        ],
        provider: { secret: 'key' }
      }
    }))
    const items = await openCodeNativeResources(
      { mcp: { status }, config: { get } } as unknown as OpencodeClient,
      'C:/session-B'
    )
    expect(status).toHaveBeenCalledExactlyOnceWith(
      { directory: 'C:/session-B' },
      { throwOnError: true }
    )
    expect(get).toHaveBeenCalledExactlyOnceWith(
      { directory: 'C:/session-B' },
      { throwOnError: true }
    )
    expect(
      items.map(({ name, status, enabled, canToggle }) => [name, status, enabled, canToggle])
    ).toEqual([
      ['live', 'connected', true, false],
      ['off', 'disabled', false, false],
      ['auth', 'needs-auth', true, false],
      ['bad', 'failed', true, false],
      ['@vendor/native@2', 'enabled', true, false],
      ['plugin.js', 'enabled', true, false],
      ['relative.js', 'enabled', true, false]
    ])
    expect(JSON.stringify(items)).not.toMatch(/private|secret|token|local|provider/)
  })
  it('does not turn a failed native read into an empty success', async () => {
    const client = {
      mcp: { status: vi.fn().mockRejectedValue(new Error('offline')) },
      config: { get: vi.fn().mockResolvedValue({ data: {} }) }
    }
    await expect(
      openCodeNativeResources(client as unknown as OpencodeClient, '/repo')
    ).rejects.toThrow('offline')
  })
})
