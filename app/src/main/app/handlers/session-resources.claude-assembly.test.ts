import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
const fx = vi.hoisted(() => ({
  enabled: new Set<string>(),
  messages: [] as SDKMessage[],
  query: vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      for (const m of fx.messages) yield m
    },
    applyFlagSettings: vi.fn(async (s: { enabledPlugins?: Record<string, boolean> }) => {
      for (const [k, v] of Object.entries(s.enabledPlugins ?? {})) {
        const name = k.replace('@inline', '')
        if (v) fx.enabled.add(name)
        else fx.enabled.delete(name)
      }
    }),
    reloadPlugins: vi.fn(async () => ({
      plugins: [...fx.enabled].map((name) => ({ name, path: join(fx.root, name) })),
      commands: [],
      agents: [],
      mcpServers: [],
      error_count: 0
    })),
    mcpServerStatus: async () => [],
    supportedCommands: async () => [],
    close: vi.fn()
  })),
  root: ''
}))
vi.mock('@anthropic-ai/claude-agent-sdk', async (o) => ({
  ...(await o<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query: fx.query
}))
const callbacks = vi.hoisted(() => new Map<string, (e: unknown, p: unknown) => Promise<unknown>>())
vi.mock('electron', () => ({
  shell: {},
  ipcMain: {
    handle: (n: string, c: (e: unknown, p: unknown) => Promise<unknown>) => callbacks.set(n, c)
  }
}))
import { ClaudeAdapter } from '../../adapters/claude/adapter'
import { nativePluginId } from '../../adapters/claude/configured-resources'
import { CHANNELS } from '../../../shared/ipc'
import { ProjectResourceSync } from '../project-resource-sync'
import { createNativeResourceSharing } from '../native-resource-sharing'
import { registerSessionResourceHandlers } from './session-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
import type { NativeResources } from '../../../shared/native-resources'
let temp = ''
afterEach(() => rmSync(temp, { recursive: true, force: true }))
const write = (p: string, v: unknown): void => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(v))
}
/** Real Claude adapter + real polling watcher: the watcher lags behind the runtime's own save. */
it('keeps every toggle while overlapping plugin toggles save through the real watcher', async () => {
  temp = mkdtempSync(join(tmpdir(), 'orca-toggle-assembly-'))
  const cwd = join(temp, 'desk'),
    root = join(temp, 'claude')
  fx.root = join(temp, 'plugins')
  mkdirSync(cwd, { recursive: true })
  const names = ['a', 'b', 'c']
  for (const name of names) {
    write(join(fx.root, name, '.claude-plugin/plugin.json'), { name })
    fx.enabled.add(name)
  }
  write(join(root, 'settings.json'), {
    enabledPlugins: Object.fromEntries(names.map((name) => [`${name}@m`, true]))
  })
  write(join(root, 'plugins/installed_plugins.json'), {
    plugins: Object.fromEntries(
      names.map((name) => [`${name}@m`, [{ scope: 'user', installPath: join(fx.root, name) }]])
    )
  })
  const live = new ClaudeAdapter().sendMessage({
    sessionId: null,
    cwd,
    text: 'x',
    env: { CLAUDE_CONFIG_DIR: root },
    extensions: { skills: [], hooks: { normalized: {} } }
  }) as unknown as GovernedLiveTurn
  const snapshots: NativeResources[] = []
  const sharing = createNativeResourceSharing({
    session: () => ({ backend: 'claude', project_id: null, cwd }),
    cwd: () => cwd,
    projectRoot: (_backend, value) => value,
    runtimes: () => [{ sessionId: 'S', runtime: live }],
    changed: (_sessionId, value) => snapshots.push(value)
  })
  const reader: { read?: (request: { sessionId: string }) => Promise<NativeResources> } = {}
  const target = {
    backend: 'claude' as const,
    cwd,
    key: sharing.scope('S')!,
    request: { sessionId: 'S' },
    runtime: live
  }
  const sync = new ProjectResourceSync({
    resolve: () => target,
    targets: () => [target],
    policy: () => undefined,
    idle: () => true,
    read: (request) => reader.read!(request as { sessionId: string }),
    emit: (_sessionId, value) => snapshots.push(value),
    run: (key, action) => sharing.run!(key, action)
  })
  try {
    reader.read = registerSessionResourceHandlers(
      (id) => (id === 'S' ? live : undefined),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      sharing,
      sync
    ) as typeof reader.read
    sync.tick()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const toggle = (name: string): Promise<unknown> =>
      callbacks.get(CHANNELS.sessionSetNativeResource)!(
        {},
        {
          sessionId: 'S',
          generation: live.providerGeneration,
          kind: 'plugin',
          id: nativePluginId(join(fx.root, name)),
          enabled: false
        }
      )
    const results = await Promise.allSettled([toggle('a'), toggle('b')])
    await new Promise((resolve) => setTimeout(resolve, 1000))
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled'])
    expect(snapshots.length).toBeGreaterThan(0)
    for (const value of snapshots) {
      expect(value.configurationPending).toBeUndefined()
      expect(
        value.items.filter((item) => item.kind === 'plugin').every((item) => item.canToggle)
      ).toBe(true)
    }
  } finally {
    sync.close()
    live.close()
  }
}, 20000)
