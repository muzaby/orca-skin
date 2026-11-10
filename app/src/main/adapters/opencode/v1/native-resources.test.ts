import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { setRootLogger } from '../../../infra/log/registry'
import {
  openCodeNativeCommands,
  openCodeNativeMcp,
  openCodeNativePlugins
} from './native-resources'
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, realpath: vi.fn(actual.realpath) }
})

describe('OpenCode native resources', () => {
  it('starts skill and configuration reads together before either completes', async () => {
    const skills = Promise.withResolvers<Response>()
    const config = Promise.withResolvers<Response>()
    const calls: string[] = []
    const client = createOpencodeClient({
      baseUrl: 'http://fixture.test',
      fetch: async (input) => {
        const path = new URL(input instanceof Request ? input.url : String(input)).pathname
        calls.push(path)
        if (path === '/skill') return skills.promise
        if (path === '/config') return config.promise
        return new Response(JSON.stringify([{ name: 'design', source: 'skill', hints: [] }]), {
          headers: { 'content-type': 'application/json' }
        })
      }
    })
    const reading = openCodeNativeCommands(client, 'C:/work', true)
    try {
      await vi.waitFor(() => expect(calls).toEqual(['/command', '/skill', '/config']))
    } finally {
      skills.resolve(new Response('[]', { headers: { 'content-type': 'application/json' } }))
      config.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } }))
    }
    expect(await reading).toMatchObject([{ name: 'design', skill: false }])
  })
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
    const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-native-skill-')).then((path) =>
      realpath(path)
    )
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
      vi.mocked(realpath).mockClear()
      const items = await openCodeNativeCommands(client, root, true, {
        XDG_CONFIG_HOME: join(root, 'config')
      })
      expect(
        vi
          .mocked(realpath)
          .mock.calls.filter(([path]) => path === join(root, '.opencode', 'skills'))
      ).toHaveLength(1)
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
    const client = { mcp: { status }, config: { get } } as unknown as OpencodeClient
    const items = [
      ...(await openCodeNativeMcp(client, 'C:/session-B')),
      ...(await openCodeNativePlugins(client, 'C:/session-B'))
    ]
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
    await expect(openCodeNativeMcp(client as unknown as OpencodeClient, '/repo')).rejects.toThrow(
      'offline'
    )
  })
})
