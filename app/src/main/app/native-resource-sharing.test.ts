import { expect, it, vi } from 'vitest'
import type { GovernedLiveTurn } from '../contracts/ports'
import type { NativeResources } from '../../shared/native-resources'
import { createNativeResourceSharing, shareNativeResource } from './native-resource-sharing'

it('serializes project mutations across manual and observer callers without blocking another project', async () => {
  const sharing = createNativeResourceSharing({
    session: () => undefined,
    cwd: () => '',
    projectRoot: (_backend, cwd) => cwd,
    runtimes: () => [],
    changed: () => {}
  })
  let finish!: () => void
  const order: string[] = []
  const first = sharing.run!('A', async () => {
    order.push('manual')
    await new Promise<void>((resolve) => {
      finish = resolve
    })
  })
  const second = sharing.run!('A', async () => {
    order.push('observer')
  })
  await sharing.run!('B', async () => {
    order.push('other')
  })
  expect(order).toEqual(['manual', 'other'])
  finish()
  await Promise.all([first, second])
  expect(order).toEqual(['manual', 'other', 'observer'])
})

it('uses the canonical harness project for unassigned sessions, keeping projects and backends isolated', () => {
  const session = vi.fn((id: string) =>
    id === 'missing'
      ? undefined
      : {
          backend: id === 'other-backend' ? ('opencode' as const) : ('claude' as const),
          project_id: null,
          cwd: id === 'other-directory' ? '/elsewhere' : '/project/child'
        }
  )
  const runtimes = ['A', 'B', 'other-backend', 'other-directory', 'missing'].map((sessionId) => ({
    sessionId,
    runtime: {} as GovernedLiveTurn
  }))
  const root = vi.fn((_backend: 'claude' | 'opencode', cwd: string) =>
    cwd.startsWith('/project') ? '/project' : cwd
  )
  const sharing = createNativeResourceSharing({
    session,
    cwd: () => '/default',
    projectRoot: root,
    runtimes: () => runtimes,
    changed: vi.fn()
  })
  const key = sharing.scope('A')!
  expect(sharing.peers(key).map((peer) => peer.sessionId)).toEqual(['A', 'B'])
  expect(root).toHaveBeenCalledWith('claude', '/project/child')
})

it.each(['runtime', 'generation', 'project'])(
  'does not write after a peer %s changes while its metadata is loading',
  async (change) => {
    const source = { setNativeResource: vi.fn(async () => {}) } as unknown as GovernedLiveTurn
    const oldPeer = {
      providerGeneration: 'old',
      setNativeResource: vi.fn(async () => {})
    } as unknown as GovernedLiveTurn
    const replacement = {} as GovernedLiveTurn
    let currentPeer = oldPeer
    const snapshot: NativeResources = {
      state: 'connected',
      generation: 'old',
      items: [
        {
          id: 'server',
          kind: 'mcp',
          name: 'Server',
          status: 'connected',
          enabled: true,
          canToggle: true
        }
      ]
    }
    const changed = vi.fn()
    let peerScope = 'project'
    const sharing = {
      scope: (id: string) => (id === 'B' ? peerScope : 'project'),
      peers: () => [{ sessionId: 'B', runtime: oldPeer }],
      changed
    }
    const lookup = (id: string): GovernedLiveTurn => (id === 'A' ? source : currentPeer)
    await shareNativeResource(
      { sessionId: 'A', generation: 'A-live', kind: 'mcp', id: 'server', enabled: false },
      source,
      'project',
      sharing,
      lookup,
      async (id) => {
        if (id === 'B') {
          if (change === 'runtime') currentPeer = replacement
          if (change === 'generation')
            Object.defineProperty(oldPeer, 'providerGeneration', { value: 'new' })
          if (change === 'project') peerScope = 'other'
        }
        return snapshot
      }
    )
    expect(oldPeer.setNativeResource).not.toHaveBeenCalled()
    expect(changed).toHaveBeenCalledExactlyOnceWith('A', snapshot)
  }
)
