import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import type { NativeResources } from '../../../shared/native-resources'
import { ClaudeAdapter } from '../../adapters/claude/adapter'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { ProjectResourceSync } from '../project-resource-sync'
import { registerSessionResourceHandlers } from './session-resources'
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
let temp = ''
afterEach(() => rmSync(temp, { recursive: true, force: true }))
const write = (p: string, v: unknown): void => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(v))
}
/** Real Claude adapter, native settings file, watcher and IPC read assembly. */
it('reconciles external plugin selections and publishes the final state through the real watcher', async () => {
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
  const reader: { read?: (request: { sessionId: string }) => Promise<NativeResources> } = {}
  const target = {
    backend: 'claude' as const,
    cwd,
    key: cwd,
    request: { sessionId: 'S' },
    runtime: live
  }
  const sync = new ProjectResourceSync({
    resolve: () => target,
    targets: () => [target],
    policy: () => undefined,
    idle: () => true,
    read: (request) => reader.read!(request as { sessionId: string }),
    emit: (_sessionId, value) => snapshots.push(value)
  })
  try {
    reader.read = registerSessionResourceHandlers({
      lookup: (id) => (id === 'S' ? live : undefined),
      projectSync: sync
    }) as typeof reader.read
    sync.tick()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    write(join(cwd, '.claude/settings.local.json'), {
      enabledPlugins: { 'a@m': false, 'b@m': false }
    })
    await vi.waitFor(
      () => {
        expect(
          snapshots.at(-1)?.items.map((item) => [item.name, item.enabled, item.status])
        ).toEqual([
          ['a@m', false, 'disabled'],
          ['b@m', false, 'disabled'],
          ['c@m', true, 'enabled']
        ])
        expect(snapshots.at(-1)?.configurationPending).toBeUndefined()
      },
      { timeout: 5000 }
    )
  } finally {
    sync.close()
    live.close()
  }
}, 20000)
