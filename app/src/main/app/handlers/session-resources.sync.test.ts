import { afterEach, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { NativeResources } from '../../../shared/native-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { ProjectResourceSync } from '../project-resource-sync'
import { registerSessionResourceHandlers } from './session-resources'
import { invokeChannel } from '../../infra/ipc/test-transport.testfixture'
const services: ProjectResourceSync[] = []
afterEach(() => {
  services.splice(0).forEach((service) => service.close())
})
const flush = async (): Promise<void> => {
  for (let i = 0; i < 80; i++) await Promise.resolve()
}
it('publishes configured changes through the real read handler and waits for idle reconciliation', async () => {
  let revision = 'initial',
    applied = 'initial',
    idle = true
  const changed: Array<() => void> = []
  const emit = vi.fn()
  const runtime = {
    nativeResources: async (): Promise<NativeResources> => ({
      state: 'connected',
      generation: 'g',
      items: [
        {
          id: 'a',
          name: 'a',
          kind: 'plugin',
          enabled: applied === 'initial',
          status: applied === 'initial' ? 'enabled' : 'disabled',
          canToggle: true
        }
      ]
    }),
    nativeResourcesApplied: (value: string) => value === applied,
    reconcileNativeResources: vi.fn(async (value: string) => {
      applied = value
      return 'applied' as const
    })
  } as unknown as GovernedLiveTurn
  const target = {
    backend: 'claude' as const,
    cwd: '/project',
    key: 'project',
    request: { sessionId: 'S' },
    runtime
  }
  const sync = new ProjectResourceSync({
    resolve: () => target,
    targets: () => [target],
    policy: () => ({ files: () => ['settings'], read: async () => ({ revision }) }),
    idle: () => idle,
    read: (request) => read(request),
    emit,
    watch: (_file, callback) => {
      changed.push(callback)
      return () => undefined
    }
  })
  services.push(sync)
  const read = registerSessionResourceHandlers({ lookup: () => runtime, projectSync: sync })
  sync.tick()
  await flush()
  emit.mockClear()
  idle = false
  revision = 'external'
  changed.forEach((callback) => callback())
  await flush()
  const query = (): Promise<unknown> =>
    invokeChannel(CHANNELS.sessionNativeResources, { sessionId: 'S' })
  expect(await query()).toMatchObject({ configurationPending: true, items: [{ canToggle: false }] })
  expect(runtime.reconcileNativeResources).not.toHaveBeenCalled()
  idle = true
  sync.tick()
  await flush()
  expect(runtime.reconcileNativeResources).toHaveBeenCalledExactlyOnceWith(
    'external',
    expect.any(Function)
  )
  expect(await query()).toMatchObject({
    items: [{ enabled: false, status: 'disabled', canToggle: true }]
  })
  expect(((await query()) as NativeResources).configurationPending).toBeUndefined()
  expect(emit).toHaveBeenLastCalledWith('S', await query())
})
