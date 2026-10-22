import type { SetNativeResource } from '../../../shared/native-resources'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { SkillInfo } from '../../../shared/ipc'

const fixture = vi.hoisted(() => ({
  messages: [] as SDKMessage[],
  query: vi.fn((request: unknown) => {
    void request
    return {
      async *[Symbol.asyncIterator]() {
        for (const message of fixture.messages) yield message
      },
      applyFlagSettings: vi.fn(async () => {}),
      reloadPlugins: vi.fn(async () => ({
        plugins: [] as Array<{ name: string; path: string }>,
        commands: [] as Array<{ name: string; builtin: boolean }>,
        agents: [],
        mcpServers: [],
        error_count: 0
      })),
      mcpServerStatus: async () => [],
      close: vi.fn()
    }
  })
}))
vi.mock('@anthropic-ai/claude-agent-sdk', async (original) => ({
  ...(await original<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query: fixture.query
}))
import { ClaudeAdapter } from './adapter'
import { nativePluginId } from './configured-resources'

let temp: string
let cwd: string
let root: string
let plugin: string
const write = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value))
}
beforeEach(() => {
  fixture.query.mockClear()
  fixture.messages.length = 0
  temp = mkdtempSync(join(tmpdir(), 'orca-native-spawn-'))
  cwd = join(temp, 'project')
  root = join(temp, 'claude')
  plugin = join(temp, 'frontend-design')
  mkdirSync(join(cwd, '.git'), { recursive: true })
  write(join(plugin, '.claude-plugin/plugin.json'), { name: 'frontend-design' })
  write(
    join(plugin, 'skills/frontend-design/SKILL.md'),
    '---\nname: frontend-design\ndescription: Native design\n---\nDesign a page.'
  )
  write(join(root, 'settings.json'), {
    enabledPlugins: { 'frontend@market': true },
    model: 'unwanted-model',
    env: { PRIVATE: 'unwanted-secret' }
  })
  write(join(root, 'plugins/installed_plugins.json'), {
    plugins: { 'frontend@market': [{ scope: 'user', installPath: plugin }] }
  })
})
afterEach(() => rmSync(temp, { recursive: true, force: true }))

const skill = (name: string, enabled: boolean): SkillInfo => ({
  name,
  enabled,
  sourceKind: 'orca',
  sourceId: 'orca',
  sourceLabel: 'Orca',
  description: '',
  canToggle: true,
  canRemove: true,
  skillPath: '/unused/SKILL.md',
  skillDir: '/unused'
})

it.each([null, 'resume-native-B'])(
  'loads enabled native skills for session %s alongside Orca skills',
  async (sessionId) => {
    const injected = join(temp, 'orca')
    write(join(injected, '.claude-plugin/plugin.json'), { name: 'orcinus-orca' })
    fixture.messages.push({
      type: 'system',
      subtype: 'init',
      session_id: 'native-B',
      uuid: 'init-B',
      tools: [],
      mcp_servers: [],
      slash_commands: ['frontend-design:frontend-design', 'orcinus-orca:enabled'],
      plugins: [
        { name: 'frontend-design', path: plugin },
        { name: 'orcinus-orca', path: injected }
      ]
    } as unknown as SDKMessage)
    const request = {
      sessionId,
      cwd,
      text: '/frontend-design:frontend-design existing draft',
      env: { CLAUDE_CONFIG_DIR: root },
      model: 'chosen-model',
      extensions: {
        pluginRoots: [injected],
        skills: [skill('enabled', true), skill('disabled', false)],
        hooks: { normalized: {} }
      }
    }
    const adapter = new ClaudeAdapter()
    const live = adapter.sendMessage(request)
    const options = (fixture.query.mock.calls[0][0] as { options: Options }).options
    expect(options.plugins).toEqual([
      { type: 'local', path: injected },
      { type: 'local', path: plugin }
    ])
    expect(options.skills).toEqual(['orcinus-orca:enabled', 'frontend-design:frontend-design'])
    expect(options.settingSources).toEqual(['project', 'local'])
    expect(JSON.stringify(options)).not.toMatch(/unwanted-model|unwanted-secret/)
    expect(options.model).toBe('chosen-model')
    if (sessionId) expect(options.resume).toBe(sessionId)
    const prompt = (
      fixture.query.mock.calls[0][0] as { prompt: AsyncIterable<{ message: { content: string } }> }
    ).prompt
    expect((await prompt[Symbol.asyncIterator]().next()).value.message.content).toContain(
      '/frontend-design:frontend-design existing draft'
    )
    const events = live.eventBatches[Symbol.asyncIterator]()
    await events.next()
    const result = await live.nativeResources?.()
    expect(result?.commands?.map((command) => command.name)).toEqual([
      'frontend-design:frontend-design'
    ])
    expect(result?.items.map((item) => item.name)).toEqual(['frontend@market'])
    live.close()
    write(join(root, 'settings.json'), { enabledPlugins: { 'frontend@market': false } })
    const resumed = adapter.sendMessage({ ...request, sessionId: 'next-resume' })
    const next = (fixture.query.mock.calls[1][0] as { options: Options }).options
    expect(next.plugins).toEqual([
      { type: 'local', path: injected },
      { type: 'local', path: plugin }
    ])
    expect(JSON.parse(String(next.settings)).enabledPlugins['frontend-design@inline']).toBe(false)
    expect(next.skills).toEqual(['orcinus-orca:enabled', 'frontend-design:frontend-design'])
    resumed.close()
  }
)

it('carries plugin controls through the actual adapter and preserves provider flags and generation', async () => {
  const live = new ClaudeAdapter().sendMessage({
    sessionId: null,
    cwd,
    text: 'Hello',
    env: { CLAUDE_CONFIG_DIR: root },
    providerSettings: {
      providerKey: 'p',
      provider: 'p',
      sourceRevision: 'r',
      settings: { enabledPlugins: { 'provider-only@inline': true } }
    },
    extensions: { skills: [], hooks: { normalized: {} } }
  })
  const options = (fixture.query.mock.calls[0][0] as { options: Options }).options
  expect(JSON.parse(String(options.settings)).enabledPlugins).toEqual({
    'provider-only@inline': true,
    'frontend@market': false,
    'frontend-design@inline': true
  })
  const sdk = fixture.query.mock.results[0].value
  const generation = (await live.nativeResources!()).generation!
  const request = {
    sessionId: 'B',
    generation,
    kind: 'plugin' as const,
    id: nativePluginId(plugin),
    enabled: false
  }
  await expect(live.setNativeResource!({ ...request, generation: 'old' })).rejects.toThrow('제어')
  expect(sdk.applyFlagSettings).not.toHaveBeenCalled()
  await live.setNativeResource!(request)
  expect(sdk.applyFlagSettings).toHaveBeenCalledExactlyOnceWith({
    enabledPlugins: {
      'provider-only@inline': true,
      'frontend@market': false,
      'frontend-design@inline': false
    }
  })
  expect(sdk.reloadPlugins).toHaveBeenCalledOnce()
  expect((await live.nativeResources!()).items).toMatchObject([
    { id: nativePluginId(plugin), enabled: false, canToggle: true }
  ])
  live.close()
})

it('exposes runtime-native watch files and applies external project choices only after idle reconciliation', async () => {
  const live = new ClaudeAdapter().sendMessage({
    sessionId: null,
    cwd,
    text: 'Hello',
    env: { CLAUDE_CONFIG_DIR: root },
    extensions: { skills: [], hooks: { normalized: {} } }
  })
  try {
    const policy = live.projectResourcePolicy!()!
    expect(policy.files(cwd)).toContain(join(root, '.claude.json'))
    const file = join(cwd, '.claude/settings.local.json')
    write(file, { enabledPlugins: { 'frontend@market': false }, permissions: { allow: ['Read'] } })
    const bytes = readFileSync(file, 'utf8')
    expect((await live.nativeResources!()).items[0]).toMatchObject({
      enabled: false,
      status: 'enabled'
    })
    const { revision } = await policy.read(cwd)
    expect(await live.reconcileNativeResources!(revision, () => false)).toBe('pending')
    const sdk = fixture.query.mock.results[0].value
    expect(sdk.reloadPlugins).not.toHaveBeenCalled()
    expect(await live.reconcileNativeResources!(revision, () => true)).toBe('applied')
    expect((await live.nativeResources!()).items[0]).toMatchObject({
      enabled: false,
      status: 'disabled'
    })
    expect(readFileSync(file, 'utf8')).toBe(bytes)
  } finally {
    live.close()
  }
})

it('persists both plugin states across follow-up turns, new adapters and cold resumes over provider defaults', async () => {
  const file = join(cwd, '.claude/settings.local.json')
  write(file, { permissions: { allow: ['Read'] }, enabledPlugins: { 'sibling@market': true } })
  const request = {
    sessionId: null,
    cwd,
    text: 'Hello',
    env: { CLAUDE_CONFIG_DIR: root },
    providerSettings: {
      providerKey: 'p',
      provider: 'p',
      sourceRevision: 'r',
      settings: { enabledPlugins: { 'frontend@market': false } }
    },
    extensions: { skills: [], hooks: { normalized: {} } }
  }
  const first = new ClaudeAdapter().sendMessage(request)
  const sdk = fixture.query.mock.results[0].value
  sdk.reloadPlugins.mockResolvedValue({
    plugins: [{ name: 'frontend-design', path: plugin }],
    commands: [{ name: 'frontend-design:frontend-design', builtin: false }],
    agents: [],
    mcpServers: [],
    error_count: 0
  })
  const change = (enabled: boolean): SetNativeResource => ({
    sessionId: 'B',
    generation: first.providerGeneration!,
    kind: 'plugin' as const,
    id: nativePluginId(plugin),
    enabled
  })
  expect((await first.nativeResources!()).items[0].enabled).toBe(false)
  await first.setNativeResource!(change(true))
  await first.pushTurn!({ text: 'continue' })
  expect((await first.nativeResources!()).items[0].enabled).toBe(true)
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
    permissions: { allow: ['Read'] },
    enabledPlugins: { 'sibling@market': true, 'frontend@market': true }
  })
  first.close()
  const resumed = new ClaudeAdapter().sendMessage({ ...request, sessionId: 'cold-resume' })
  const options = (fixture.query.mock.calls[1][0] as { options: Options }).options
  expect(JSON.parse(String(options.settings)).enabledPlugins['frontend-design@inline']).toBe(true)
  expect((await resumed.nativeResources!()).items[0].enabled).toBe(true)
  await resumed.setNativeResource!({ ...change(false), generation: resumed.providerGeneration! })
  resumed.close()
  const restarted = new ClaudeAdapter().sendMessage({
    ...request,
    providerSettings: {
      ...request.providerSettings,
      settings: { enabledPlugins: { 'frontend@market': true } }
    }
  })
  expect((await restarted.nativeResources!()).items[0].enabled).toBe(false)
  expect(JSON.parse(readFileSync(file, 'utf8')).enabledPlugins['sibling@market']).toBe(true)
  expect(
    JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')).enabledPlugins['frontend@market']
  ).toBe(true)
  restarted.close()
})
