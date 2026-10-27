import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it, vi } from 'vitest'
import type { GovernedLiveTurn } from '../contracts/ports'
import type { ChatActivitySnapshot } from '../../shared/ipc'
import {
  ProjectResourceSync,
  projectResourcesIdle,
  type ProjectResourceTarget
} from './project-resource-sync'
import {
  claudeProjectSettingsFiles,
  readClaudeProjectSettings
} from '../adapters/claude/project-settings'
const services: ProjectResourceSync[] = []
afterEach(() => {
  services.splice(0).forEach((service) => service.close())
  vi.useRealTimers()
})
const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) await Promise.resolve()
}
function fixture(): {
  service: ProjectResourceSync
  runtime: GovernedLiveTurn
  emit: ReturnType<typeof vi.fn>
  owner: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>
  stopped: ReturnType<typeof vi.fn>
  changed: Array<() => void>
  peers(): ProjectResourceTarget[]
  update(value: string): void
  select(value: string): void
  busy(value: boolean): void
  fail(value: boolean): void
  replace(value: ProjectResourceTarget[]): void
} {
  const changed: Array<() => void> = [],
    stopped = vi.fn(),
    emit = vi.fn(),
    owner = vi.fn()
  const runtime = {
    reconcileNativeResources: vi.fn(async () => 'applied' as const)
  } as unknown as GovernedLiveTurn
  let busy = false,
    revision = 'initial',
    fail = false
  let peers: ProjectResourceTarget[] = ['A', 'B'].map((sessionId) => ({
    backend: 'claude',
    cwd: '/project',
    key: 'same',
    request: { sessionId },
    runtime: { ...runtime }
  }))
  const service = new ProjectResourceSync({
    resolve: (request) =>
      'sessionId' in request
        ? peers.find(
            (peer) => 'sessionId' in peer.request && peer.request.sessionId === request.sessionId
          )
        : {
            backend: request.backend,
            cwd: request.cwd!,
            key: request.cwd === '/project' ? 'same' : 'other',
            request
          },
    targets: () => peers,
    policy: () => ({
      files: () => ['config'],
      read: async () => {
        if (fail) throw new Error('private')
        return { revision }
      }
    }),
    idle: (peer) => !(busy && 'sessionId' in peer.request && peer.request.sessionId === 'B'),
    read: async () => ({
      state: 'connected',
      generation: 'g',
      items: [
        { id: 'mcp', name: 'mcp', kind: 'mcp', enabled: true, status: 'connected', canToggle: true }
      ]
    }),
    emit,
    run: async (_key, task) => task(),
    watch: (_path, callback) => {
      changed.push(callback)
      return stopped
    }
  })
  services.push(service)
  return {
    service,
    runtime,
    emit,
    owner,
    stopped,
    changed,
    peers: () => peers,
    select: (value: string) => {
      revision = value
    },
    update: (value: string) => {
      revision = value
      changed.forEach((callback) => callback())
    },
    busy: (value: boolean) => {
      busy = value
    },
    fail: (value: boolean) => {
      fail = value
    },
    replace: (value: ProjectResourceTarget[]) => {
      peers = value
    }
  }
}
it('refreshes JSON project selections on change and waits for every project peer before applying', async () => {
  const f = fixture()
  f.replace(f.peers().map((peer) => ({ ...peer, backend: 'opencode' })))
  f.service.tick()
  await flush()
  vi.mocked(f.runtime.reconcileNativeResources!).mockClear()
  f.busy(true)
  f.select('selected-mcp-off')
  f.service.settingsChanged('opencode')
  await flush()
  expect(f.runtime.reconcileNativeResources).not.toHaveBeenCalled()
  expect(f.emit).toHaveBeenLastCalledWith(
    'B',
    expect.objectContaining({ configurationPending: true })
  )
  f.busy(false)
  f.service.tick()
  await flush()
  expect(f.runtime.reconcileNativeResources).toHaveBeenCalledTimes(2)
  expect(f.runtime.reconcileNativeResources).toHaveBeenLastCalledWith(
    'selected-mcp-off',
    expect.any(Function)
  )
})
it('shares one watcher, emits immediately while either peer is busy and reconciles only after all are idle', async () => {
  const f = fixture()
  f.service.tick()
  await flush()
  vi.mocked(f.runtime.reconcileNativeResources!).mockClear()
  f.busy(true)
  f.update('external')
  await flush()
  expect(f.runtime.reconcileNativeResources).not.toHaveBeenCalled()
  expect(f.emit).toHaveBeenLastCalledWith(
    'B',
    expect.objectContaining({
      configurationPending: true,
      items: [expect.objectContaining({ canToggle: false })]
    })
  )
  expect(f.changed).toHaveLength(1)
  f.busy(false)
  f.service.tick()
  await flush()
  expect(f.runtime.reconcileNativeResources).toHaveBeenCalledTimes(2)
  expect(
    f.service.decorate({ sessionId: 'A' }, { state: 'connected', items: [] }).configurationPending
  ).toBeUndefined()
})
it('retains malformed state without applying and retries after correction; revision no-op does not reload', async () => {
  const f = fixture()
  f.service.tick()
  await flush()
  vi.mocked(f.runtime.reconcileNativeResources!).mockClear()
  f.update('initial')
  await flush()
  expect(f.runtime.reconcileNativeResources).not.toHaveBeenCalled()
  f.fail(true)
  f.update('bad')
  await flush()
  expect(f.emit).toHaveBeenLastCalledWith(
    'B',
    expect.objectContaining({ partial: true, configurationPending: true })
  )
  expect(f.runtime.reconcileNativeResources).not.toHaveBeenCalled()
  f.fail(false)
  f.update('corrected')
  await flush()
  expect(f.runtime.reconcileNativeResources).toHaveBeenCalledTimes(2)
})
it('does not repeatedly retry restart-required or reuse old-runtime completion for its replacement', async () => {
  const f = fixture()
  vi.mocked(f.runtime.reconcileNativeResources!).mockResolvedValue('restart-required')
  f.service.tick()
  await flush()
  f.service.tick()
  await flush()
  expect(f.runtime.reconcileNativeResources).toHaveBeenCalledTimes(2)
  let finish!: (result: 'applied') => void
  vi.mocked(f.runtime.reconcileNativeResources!).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  f.update('changed')
  await flush()
  const replacement = {
    reconcileNativeResources: vi.fn(async () => 'applied' as const)
  } as unknown as GovernedLiveTurn
  f.replace([{ ...f.peers()[0], runtime: replacement }])
  finish('applied')
  await flush()
  f.service.tick()
  await flush()
  expect(replacement.reconcileNativeResources).toHaveBeenCalledOnce()
})
it('releases draft watchers on owner release and discards delayed results from a retired scope', async () => {
  const f = fixture()
  f.replace([])
  const request = { backend: 'claude' as const, cwd: '/project', projectId: null }
  f.service.observe('window:owner', request, f.owner)
  await flush()
  expect(f.owner).toHaveBeenCalled()
  f.owner.mockClear()
  f.service.releasePrefix('window:')
  f.update('late')
  await flush()
  expect(f.stopped).toHaveBeenCalledOnce()
  expect(f.owner).not.toHaveBeenCalled()
})
it('detects real file creation and atomic replacement without starting a runtime, and closes its watcher', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'orca-watch-'))
  const cwd = join(temp, 'project'),
    root = join(temp, 'native')
  mkdirSync(join(cwd, '.claude'), { recursive: true })
  mkdirSync(root)
  const request = { backend: 'claude' as const, cwd, projectId: null },
    emit = vi.fn()
  const service = new ProjectResourceSync({
    resolve: () => ({ backend: 'claude', cwd, key: cwd, request }),
    targets: () => [],
    policy: () => ({
      files: () => claudeProjectSettingsFiles(cwd, root),
      read: async () => readClaudeProjectSettings(cwd, root)
    }),
    idle: () => true,
    run: async (_key, action) => action(),
    emit: vi.fn(),
    read: async () => ({
      state: 'disconnected',
      items: [],
      commands: Object.keys(readClaudeProjectSettings(cwd, root).plugins).map((name) => ({
        name,
        description: '',
        argumentHint: '',
        source: 'plugin'
      }))
    })
  })
  services.push(service)
  try {
    service.observe('owner', request, emit)
    await flush()
    emit.mockClear()
    const file = join(cwd, '.claude/settings.local.json')
    writeFileSync(file, JSON.stringify({ enabledPlugins: { first: true } }))
    await vi.waitFor(
      () =>
        expect(emit).toHaveBeenLastCalledWith(
          expect.objectContaining({ commands: [expect.objectContaining({ name: 'first' })] })
        ),
      { timeout: 3000 }
    )
    writeFileSync(file + '.tmp', JSON.stringify({ enabledPlugins: { next: true } }))
    renameSync(file + '.tmp', file)
    await vi.waitFor(
      () =>
        expect(emit).toHaveBeenLastCalledWith(
          expect.objectContaining({ commands: [expect.objectContaining({ name: 'next' })] })
        ),
      { timeout: 3000 }
    )
    service.release('owner')
    service.close()
    emit.mockClear()
    writeFileSync(file, '{}')
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(emit).not.toHaveBeenCalled()
  } finally {
    service.close()
    rmSync(temp, { recursive: true, force: true })
  }
})
it('uses runtime-native configuration roots but shares the idle boundary for the same cwd', async () => {
  const f = fixture()
  const a = f.peers()[0],
    b = f.peers()[1]
  const reconcileA = vi.fn(async () => 'applied' as const),
    reconcileB = vi.fn(async () => 'applied' as const)
  a.runtime = {
    projectResourcePolicy: () => ({
      files: () => ['native-A'],
      read: async () => ({ revision: 'A' })
    }),
    reconcileNativeResources: reconcileA
  } as unknown as GovernedLiveTurn
  b.runtime = {
    projectResourcePolicy: () => ({
      files: () => ['native-B'],
      read: async () => ({ revision: 'B' })
    }),
    reconcileNativeResources: reconcileB
  } as unknown as GovernedLiveTurn
  f.busy(true)
  f.service.tick()
  await flush()
  expect(f.changed).toHaveLength(2)
  expect(reconcileA).not.toHaveBeenCalled()
  expect(reconcileB).not.toHaveBeenCalled()
  f.busy(false)
  f.service.tick()
  await flush()
  expect(reconcileA).toHaveBeenCalledWith('A', expect.any(Function))
  expect(reconcileB).toHaveBeenCalledWith('B', expect.any(Function))
})
it('discards a revision invalidated during reading before any resource push', async () => {
  vi.useFakeTimers()
  const f = fixture()
  const stale = Promise.withResolvers<{ revision: string }>()
  const latest = Promise.withResolvers<{ revision: string }>()
  const policyRead = vi.fn().mockReturnValueOnce(stale.promise).mockReturnValue(latest.promise)
  const peer = f.peers()[0]
  peer.runtime = {
    projectResourcePolicy: () => ({ files: () => ['config'], read: policyRead }),
    reconcileNativeResources: vi.fn(async () => 'applied' as const)
  } as unknown as GovernedLiveTurn
  f.replace([peer])
  f.service.tick()
  expect(policyRead).toHaveBeenCalledOnce()
  f.update('newer')
  stale.resolve({ revision: 'stale' })
  await flush()
  expect(policyRead).toHaveBeenCalledTimes(2)
  expect(f.emit).not.toHaveBeenCalled()
  expect(peer.runtime!.reconcileNativeResources).not.toHaveBeenCalled()
  latest.resolve({ revision: 'latest' })
  await flush()
  expect(f.emit).toHaveBeenCalled()
  expect(peer.runtime!.reconcileNativeResources).toHaveBeenCalledExactlyOnceWith(
    'latest',
    expect.any(Function)
  )
})

it('counts foreground, queued, delivered, residual, background and wakeup activity as busy', () => {
  const idle = {
    foreground: 'idle',
    queuedCount: 0,
    deliveryPendingCount: 0,
    residualCount: 0,
    backgroundTaskCount: 0,
    pendingSessionWakeup: false
  } as ChatActivitySnapshot
  const runtime = { responding: false } as GovernedLiveTurn
  expect(projectResourcesIdle(idle, runtime)).toBe(true)
  for (const change of [
    { foreground: 'preparing' },
    { queuedCount: 1 },
    { deliveryPendingCount: 1 },
    { residualCount: 1 },
    { backgroundTaskCount: 1 },
    { pendingSessionWakeup: true }
  ])
    expect(projectResourcesIdle({ ...idle, ...change } as ChatActivitySnapshot, runtime)).toBe(
      false
    )
  expect(projectResourcesIdle(idle, { responding: true } as GovernedLiveTurn)).toBe(false)
})

it('holds watcher broadcasts behind an in-flight project mutation', async () => {
  let revision = 'before'
  let appliedRevision = 'before'
  const changed: Array<() => void> = []
  const emit = vi.fn()
  let tail: Promise<unknown> = Promise.resolve()
  const run = <T>(_key: string, task: () => Promise<T>): Promise<T> => {
    const next = tail.catch(() => undefined).then(task)
    tail = next
    return next
  }
  const runtime = {
    reconcileNativeResources: vi.fn(async () => 'pending' as const),
    nativeResourcesApplied: (value: string) => value === appliedRevision
  } as unknown as GovernedLiveTurn
  const target: ProjectResourceTarget = {
    backend: 'claude',
    cwd: '/project',
    key: 'same',
    request: { sessionId: 'A' },
    runtime
  }
  const service = new ProjectResourceSync({
    resolve: () => target,
    targets: () => [target],
    policy: () => ({ files: () => ['config'], read: async () => ({ revision }) }),
    idle: () => true,
    read: async () => ({
      state: 'connected',
      generation: 'g',
      items: [
        { id: 'a', name: 'a', kind: 'plugin', enabled: true, status: 'enabled', canToggle: true },
        { id: 'b', name: 'b', kind: 'plugin', enabled: true, status: 'enabled', canToggle: true }
      ]
    }),
    emit,
    run,
    watch: (_path, callback) => {
      changed.push(callback)
      return () => undefined
    }
  })
  services.push(service)
  service.tick()
  await flush()
  emit.mockClear()
  let release!: () => void
  const mutation = run('same', () => new Promise<void>((resolve) => (release = resolve)))
  revision = 'own-first'
  appliedRevision = 'own-first'
  changed.forEach((callback) => callback())
  await flush()
  expect(emit).not.toHaveBeenCalled()
  // A second own save completes before the polling watcher sees its file notification.
  revision = 'own-second'
  appliedRevision = 'own-second'
  release()
  await mutation
  await flush()
  expect(emit).toHaveBeenCalled()
  for (const [, value] of emit.mock.calls) {
    expect(value.configurationPending).toBeUndefined()
    expect(value.items.every((item: { canToggle: boolean }) => item.canToggle)).toBe(true)
  }
  expect(runtime.reconcileNativeResources).not.toHaveBeenCalledWith('own-second', expect.anything())
})
