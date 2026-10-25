import { afterEach, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { NativeResources, SetNativeResource } from '../../../shared/native-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { ProjectResourceSync } from '../project-resource-sync'
import { createNativeResourceSharing } from '../native-resource-sharing'
const callbacks = vi.hoisted(
  () => new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
)
vi.mock('electron', () => ({
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() },
  ipcMain: {
    handle: (name: string, callback: (event: unknown, payload: unknown) => Promise<unknown>) =>
      callbacks.set(name, callback)
  }
}))
import { registerSessionResourceHandlers } from './session-resources'

const services: ProjectResourceSync[] = []
afterEach(() => {
  services.splice(0).forEach((service) => service.close())
  callbacks.clear()
})
const flush = async (): Promise<void> => {
  for (let i = 0; i < 60; i++) await Promise.resolve()
}

/** The production assembly: one sharing queue for handler and watcher, a runtime that saves its own toggles. */
function assemble(): {
  toggle(id: string, enabled: boolean): Promise<unknown>
  release(): void
  order: string[]
  snapshots: NativeResources[]
  file: { revision: string }
} {
  const enabled = new Map([
    ['a', true],
    ['b', true],
    ['c', true]
  ])
  const file = { revision: 'initial' }
  const watchers: Array<() => void> = []
  const order: string[] = []
  const snapshots: NativeResources[] = []
  let own = 'initial'
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  let hold = true
  const runtime = {
    providerGeneration: 'g',
    nativeResources: async (): Promise<NativeResources> => ({
      state: 'connected',
      generation: 'g',
      items: [...enabled].map(([id, value]) => ({
        id,
        name: id,
        kind: 'plugin' as const,
        status: value ? ('enabled' as const) : ('disabled' as const),
        enabled: value,
        canToggle: true
      }))
    }),
    setNativeResource: async (request: SetNativeResource) => {
      order.push(`${request.id}:${request.enabled}`)
      enabled.set(request.id, request.enabled)
      // The settings file is saved, then the watcher fires before the queue moves on.
      file.revision = [...enabled].map(([id, value]) => `${id}=${value}`).join(',')
      own = file.revision
      watchers.forEach((callback) => callback())
      if (hold) {
        hold = false
        await held
      }
    },
    reconcileNativeResources: vi.fn(async () => 'pending' as const),
    nativeResourcesApplied: (revision: string) => revision === own
  } as unknown as GovernedLiveTurn
  const lookup = (id: string): GovernedLiveTurn | undefined => (id === 'S' ? runtime : undefined)
  const sharing = createNativeResourceSharing({
    session: () => ({ backend: 'claude', project_id: null, cwd: '/project' }),
    cwd: () => '/project',
    projectRoot: (_backend, cwd) => cwd,
    runtimes: () => [{ sessionId: 'S', runtime }],
    changed: (_sessionId, value) => snapshots.push(value)
  })
  const reader: { read?: (request: { sessionId: string }) => Promise<NativeResources> } = {}
  const target = {
    backend: 'claude' as const,
    cwd: '/project',
    key: sharing.scope('S')!,
    request: { sessionId: 'S' },
    runtime
  }
  const projectSync = new ProjectResourceSync({
    resolve: () => target,
    targets: () => [target],
    policy: () => ({ files: () => ['settings'], read: async () => ({ revision: file.revision }) }),
    idle: () => true,
    read: (request) => reader.read!(request as { sessionId: string }),
    emit: (_sessionId, value) => snapshots.push(value),
    run: (key, action) => sharing.run!(key, action),
    watch: (_path, callback) => {
      watchers.push(callback)
      return () => undefined
    }
  })
  services.push(projectSync)
  reader.read = registerSessionResourceHandlers(
    lookup,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    sharing,
    projectSync
  ) as typeof reader.read
  projectSync.tick()
  return {
    toggle: (id, value) =>
      callbacks.get(CHANNELS.sessionSetNativeResource)!(
        {},
        { sessionId: 'S', generation: 'g', kind: 'plugin', id, enabled: value }
      ),
    release: () => release(),
    order,
    snapshots,
    file
  }
}

it('applies overlapping project toggles in order without a self-write rejection', async () => {
  const fixture = assemble()
  await flush()
  const first = fixture.toggle('a', false)
  await flush()
  const second = fixture.toggle('b', false)
  await flush()
  expect(fixture.order).toEqual(['a:false'])
  fixture.release()
  const results = (await Promise.all([first, second])) as NativeResources[]
  expect(fixture.order).toEqual(['a:false', 'b:false'])
  expect(results[1].items.map((item) => [item.id, item.enabled])).toEqual([
    ['a', false],
    ['b', false],
    ['c', true]
  ])
})

it('never publishes pending or neighbour changes while a toggle completes', async () => {
  const fixture = assemble()
  await flush()
  fixture.snapshots.length = 0
  const first = fixture.toggle('a', false)
  await flush()
  const second = fixture.toggle('b', false)
  fixture.release()
  await Promise.all([first, second])
  await flush()
  expect(fixture.snapshots.length).toBeGreaterThan(0)
  const allowed = new Set(['a=true,b=true', 'a=false,b=true', 'a=false,b=false'])
  for (const value of fixture.snapshots) {
    expect(value.configurationPending).toBeUndefined()
    expect(value.items.every((item) => item.canToggle)).toBe(true)
    const byId = new Map(value.items.map((item) => [item.id, item]))
    expect(allowed).toContain(`a=${byId.get('a')!.enabled},b=${byId.get('b')!.enabled}`)
    expect(byId.get('c')).toMatchObject({ enabled: true, status: 'enabled', canToggle: true })
  }
})
