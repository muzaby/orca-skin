import { describe, expect, it, vi } from 'vitest'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import {
  openCodeNativeCommands,
  openCodeNativeResources,
  openCodeNativeMcp
} from './native-resources'
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import { setRootLogger } from '../../../infra/log/registry'
import { realpath, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('OpenCode native resources', () => {
  it('traces secret-free MCP status classes without changing the returned resources', async () => {
    const debug = vi.fn()
    const logger = { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => logger }
    setRootLogger(logger)
    try {
      const client = createOpencodeClient({
        baseUrl: 'http://fixture.test',
        fetch: async () =>
          new Response(
            JSON.stringify({
              connected: { status: 'connected' },
              timeout: { status: 'failed', error: 'timed out secret-token' },
              refused: {
                status: 'failed',
                error: 'ECONNREFUSED https://sentinel/?token=secret-token'
              },
              auth: { status: 'needs_auth' },
              registration: { status: 'needs_client_registration', error: 'OAuth secret-token' }
            }),
            { headers: { 'content-type': 'application/json' } }
          )
      })
      const resources = await openCodeNativeMcp(client, 'C:/secret-directory')
      expect(resources.map((r) => [r.id, r.status, r.enabled, r.canToggle])).toEqual([
        ['connected', 'connected', true, false],
        ['timeout', 'failed', true, false],
        ['refused', 'failed', true, false],
        ['auth', 'needs-auth', true, false],
        ['registration', 'needs-auth', true, false]
      ])
      const entries = debug.mock.calls.map(([, data]) => data)
      expect(entries.map((data) => data.errorClass)).toEqual([
        undefined,
        'timeout',
        'refused',
        undefined,
        'auth'
      ])
      expect(entries.every((data) => /^[a-f0-9]{12}$/.test(data.mcp))).toBe(true)
      expect(JSON.stringify(debug.mock.calls)).not.toMatch(
        /sentinel|secret-token|secret-directory|https:/
      )
    } finally {
      setRootLogger(null)
    }
  })
  it('classifies only OpenCode and installed-plugin skills from SDK locations, without losing exact dispatch names', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-native-skill-')).then((path) => realpath(path))
    try {
      const plugin = join(root, 'native-plugin')
      await mkdir(plugin)
      await writeFile(join(plugin, 'package.json'), '{}')
      const locations = {
        own: join(root, '.opencode', 'skills', 'own', 'SKILL.md'),
        'vendor:design': join(plugin, 'skills', 'design', 'SKILL.md'),
        foreign: join(root, '.claude', 'skills', 'foreign', 'SKILL.md'),
        agents: join(root, '.agents', 'skills', 'agents', 'SKILL.md')
      }
      const client = {
        command: {
          list: async () => ({
            data: [
              ...Object.keys(locations).map((name) => ({ name, source: 'skill', hints: [] })),
              { name: 'custom', source: 'command', hints: [] }
            ]
          })
        },
        app: {
          skills: async () => ({
            data: Object.entries(locations).map(([name, location]) => ({ name, location }))
          })
        },
        config: { get: async () => ({ data: { plugin: [plugin] } }) }
      } as unknown as OpencodeClient
      const items = await openCodeNativeCommands(client, root, true, {
        XDG_CONFIG_HOME: join(root, 'config')
      })
      expect(items.map(({ name, source, skill }) => ({ name, source, skill }))).toEqual([
        { name: 'own', source: 'harness', skill: true },
        { name: 'vendor:design', source: 'plugin', skill: true },
        { name: 'foreign', source: 'harness', skill: false },
        { name: 'agents', source: 'harness', skill: false },
        { name: 'custom', source: 'harness', skill: false }
      ])
      expect(JSON.stringify(items)).not.toContain(root.replaceAll('\\', '\\\\'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
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
      { throwOnError: false, signal: undefined }
    )
    expect(get).toHaveBeenCalledExactlyOnceWith(
      { directory: 'C:/session-B' },
      { throwOnError: false, signal: undefined }
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
