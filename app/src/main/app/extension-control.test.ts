import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { extensionControl } from './extension-control'
import { createSettingsMirror } from './agent-host/settings-mirror'
import { createAgentLink } from './data-host/agent-link'
import { createDataWriteOps } from './data-host/data-ops'
import { createPeerLink } from '../infra/ipc/peer-link'
import { createPeerLoopback } from '../infra/ipc/peer-loopback.testfixture'
import { SettingsStore } from '../infra/settings-store'
import type { DbQueries } from '../infra/db'

vi.mock('electron-store', () => ({ default: class {} }))

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

it('merges concurrent per-harness saves on the data host and publishes each durable revision before replying', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oo-choice-store-'))
  dirs.push(dir)
  const file = join(dir, 'settings.json')
  writeFileSync(file, JSON.stringify({ settingsVersion: 2, language: 'before' }))
  let fail = false
  const backend = {
    get store(): Record<string, unknown> {
      return JSON.parse(readFileSync(file, 'utf8'))
    },
    set store(next: Record<string, unknown>) {
      if (fail) throw new Error('disk full')
      writeFileSync(file, JSON.stringify(next))
    }
  }
  const settings = new SettingsStore('test', backend)
  const db = {} as DbQueries
  const host = createAgentLink({
    settings,
    queryOps: {},
    writeOps: createDataWriteOps({ settings, db, defaultCwd: () => '' }),
    ensureAgent: vi.fn()
  })
  const mirror = createSettingsMirror({ requestWrite: vi.fn() })
  const agent = createPeerLink({
    side: 'agent',
    onRequest: vi.fn(),
    onNotify(method, value) {
      if (method === 'settings.snapshot') mirror.applySnapshot(value)
      if (method === 'settings.patch') mirror.applyPatch(value)
    }
  })
  const control = extensionControl({
    get: () => mirror.getAll().nativeExtensionChoices,
    setChoice: (backend, key, enabled) =>
      agent.request('data.write', { op: 'setNativeExtensionChoice', args: [backend, key, enabled] })
  })
  const ports = createPeerLoopback()
  host.attach(ports.data)
  agent.attach(ports.agent)
  await vi.waitFor(() => expect(mirror.ready()).toBe(true))
  backend.store = { ...backend.store, language: 'external edit' }
  await Promise.all([
    control.setGlobal('claude', 'mcp:same', true),
    control.setGlobal('opencode', 'mcp:same', false),
    control.setGlobal('claude', 'managed:user:same', false)
  ])
  expect(mirror.getAll().nativeExtensionRevision).toBe(3)
  expect(control.global('claude')).toEqual({ 'mcp:same': true, 'managed:user:same': false })
  fail = true
  await expect(control.setGlobal('claude', 'mcp:same', false)).rejects.toThrow('disk full')
  expect(backend.store.nativeExtensionRevision).toBe(3)
  fail = false
  expect(new SettingsStore('test', backend).getAll()).toMatchObject({
    language: 'external edit',
    nativeExtensionRevision: 3,
    nativeExtensionChoices: { claude: control.global('claude'), opencode: { 'mcp:same': false } }
  })
})
