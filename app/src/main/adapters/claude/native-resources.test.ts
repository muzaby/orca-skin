import { describe, expect, it, vi } from 'vitest'
import type { McpServerStatus } from '@anthropic-ai/claude-agent-sdk'
import { claudeNativeResources } from './native-resources'
import { nativePluginId } from './configured-resources'

describe('Claude native resources', () => {
  it('projects exact supported slash commands and descriptions while excluding builtins and injected plugins', async () => {
    const resources = claudeNativeResources(
      {
        mcpServerStatus: async () => [],
        toggleMcpServer: async () => {},
        supportedCommands: async () => [
          { name: 'native:review', description: 'Review code', argumentHint: '<file>' },
          { name: 'mcp__docs__search', description: 'Search docs', argumentHint: '<query>' },
          { name: 'orca:private', description: '', argumentHint: '' },
          { name: 'mcp__runtime__private', description: '', argumentHint: '' },
          { name: 'mcp__plugin:orca:tools__private', description: '', argumentHint: '' },
          { name: 'compact', description: '', argumentHint: '', builtin: true }
        ]
      },
      ['/injected'],
      ['runtime']
    )
    resources.observePlugins([{ name: 'orca', path: '/injected' }])
    expect(await resources.commands()).toEqual([
      {
        name: 'native:review',
        description: 'Review code',
        argumentHint: '<file>',
        source: 'plugin'
      },
      {
        name: 'mcp__docs__search',
        description: 'Search docs',
        argumentHint: '<query>',
        source: 'mcp'
      }
    ])
  })
  const servers: McpServerStatus[] = [
    {
      name: 'native',
      status: 'connected',
      scope: 'user',
      config: { type: 'http', url: 'https://private', headers: { Authorization: 'secret' } }
    },
    { name: 'off', status: 'disabled' },
    { name: 'auth', status: 'needs-auth' },
    { name: 'sdk', status: 'connected', scope: 'dynamic', source: 'sdk' },
    { name: 'runtime', status: 'connected' },
    { name: 'plugin:orca:tools', status: 'connected', source: 'plugin' }
  ]
  function fixture(): {
    query: {
      mcpServerStatus: ReturnType<typeof vi.fn<() => Promise<McpServerStatus[]>>>
      toggleMcpServer: ReturnType<typeof vi.fn<(name: string, enabled: boolean) => Promise<void>>>
    }
    resources: ReturnType<typeof claudeNativeResources>
  } {
    const query = {
      mcpServerStatus: vi.fn(async () => servers),
      toggleMcpServer: vi.fn<(name: string, enabled: boolean) => Promise<void>>(async () => {})
    }
    const resources = claudeNativeResources(query, ['/injected'], ['runtime'])
    resources.observePlugins([
      { name: 'native-plugin', path: '/private/plugin' },
      { name: 'orca', path: '/injected' }
    ])
    return { query, resources }
  }
  it('projects statuses and loaded plugins without injected resources or private configuration', async () => {
    const { resources } = fixture()
    const items = await resources.list()
    expect(await resources.directory(nativePluginId('/private/plugin'))).toBe('/private/plugin')
    expect(await resources.directory(nativePluginId('/injected'))).toBeUndefined()
    expect(await resources.directory('/private/plugin')).toBeUndefined()
    expect(items).toEqual([
      {
        id: 'native',
        name: 'native',
        kind: 'mcp',
        status: 'connected',
        enabled: true,
        canToggle: true
      },
      { id: 'off', name: 'off', kind: 'mcp', status: 'disabled', enabled: false, canToggle: true },
      {
        id: 'auth',
        name: 'auth',
        kind: 'mcp',
        status: 'needs-auth',
        enabled: true,
        canToggle: true
      },
      {
        id: nativePluginId('/private/plugin'),
        name: 'native-plugin',
        kind: 'plugin',
        status: 'enabled',
        enabled: true,
        canToggle: false
      }
    ])
    expect(JSON.stringify(items)).not.toMatch(/private|secret|Authorization|injected/)
  })
  it('passes both enable values to the same Query and rejects injected or unknown MCP', async () => {
    const { query, resources } = fixture()
    await resources.set('native', false)
    await resources.set('off', true)
    expect(query.toggleMcpServer.mock.calls).toEqual([
      ['native', false],
      ['off', true]
    ])
    for (const id of ['sdk', 'runtime', 'plugin:orca:tools', 'missing'])
      await expect(resources.set(id, false)).rejects.toThrow()
    expect(query.toggleMcpServer).toHaveBeenCalledTimes(2)
    query.toggleMcpServer.mockRejectedValueOnce(new Error('provider rejected'))
    await expect(resources.set('native', false)).rejects.toThrow('provider rejected')
  })
})
