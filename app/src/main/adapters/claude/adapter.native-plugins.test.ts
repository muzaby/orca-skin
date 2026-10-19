import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
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
    expect(result?.items.map((item) => item.name)).toEqual(['frontend-design'])
    live.close()
    write(join(root, 'settings.json'), { enabledPlugins: { 'frontend@market': false } })
    const resumed = adapter.sendMessage({ ...request, sessionId: 'next-resume' })
    const next = (fixture.query.mock.calls[1][0] as { options: Options }).options
    expect(next.plugins).toEqual([{ type: 'local', path: injected }])
    expect(next.skills).toEqual(['orcinus-orca:enabled'])
    resumed.close()
  }
)
