import type { Backend } from '../../shared/ipc'
import type { NativeResources, SetNativeResource } from '../../shared/native-resources'
import type { GovernedLiveTurn } from '../contracts/ports'
import { resourceQuery } from '../adapters/common/resource-query'

export interface NativeResourcePeer {
  sessionId: string
  runtime: GovernedLiveTurn
}
export interface NativeResourceSharing {
  scope(sessionId: string): string | undefined
  peers(scope: string): NativeResourcePeer[]
  changed(sessionId: string, resources: NativeResources): void
}

export function createNativeResourceSharing(deps: {
  session(
    id: string
  ): { backend: Backend; project_id: string | null; cwd: string | null } | undefined
  cwd(projectId: string | null): string
  projectRoot(backend: Backend, cwd: string): string
  runtimes(): NativeResourcePeer[]
  changed: NativeResourceSharing['changed']
}): NativeResourceSharing {
  const scope = (id: string): string | undefined => {
    const session = deps.session(id)
    if (!session) return undefined
    return JSON.stringify([
      session.backend,
      session.project_id ? 'project' : 'directory',
      session.project_id ?? deps.projectRoot(session.backend, session.cwd ?? deps.cwd(null))
    ])
  }
  return {
    scope,
    peers: (key) => deps.runtimes().filter((peer) => scope(peer.sessionId) === key),
    changed: deps.changed
  }
}

/** The source is validated by the IPC owner; peers are checked against their own live generation. */
export async function shareNativeResource(
  request: SetNativeResource,
  source: GovernedLiveTurn,
  scope: string | undefined,
  sharing: NativeResourceSharing | undefined,
  lookup: (id: string) => GovernedLiveTurn | undefined,
  read: (id: string, runtime: GovernedLiveTurn) => Promise<NativeResources>
): Promise<NativeResources> {
  await source.setNativeResource!(request)
  const touched: NativeResourcePeer[] = [{ sessionId: request.sessionId, runtime: source }]
  let failed = false
  if (scope && sharing) {
    for (const peer of sharing.peers(scope)) {
      if (peer.runtime === source || !peer.runtime.setNativeResource) continue
      try {
        const current = await resourceQuery(() => read(peer.sessionId, peer.runtime))
        if (lookup(peer.sessionId) !== peer.runtime || sharing.scope(peer.sessionId) !== scope)
          continue
        if (
          !current?.generation ||
          (peer.runtime.providerGeneration &&
            peer.runtime.providerGeneration !== current.generation)
        )
          continue
        const resource = current.items.find(
          (item) => item.kind === request.kind && item.id === request.id && item.canToggle
        )
        if (!resource) continue
        touched.push(peer)
        await peer.runtime.setNativeResource({
          ...request,
          sessionId: peer.sessionId,
          generation: current.generation
        })
      } catch {
        if (lookup(peer.sessionId) === peer.runtime) failed = true
      }
    }
  }
  let result: NativeResources | undefined
  for (const peer of touched) {
    if (lookup(peer.sessionId) !== peer.runtime) continue
    try {
      const value = await read(peer.sessionId, peer.runtime)
      if (scope && sharing?.scope(peer.sessionId) !== scope) continue
      sharing?.changed(peer.sessionId, value)
      if (peer.runtime === source) result = value
    } catch {
      failed = true
    }
  }
  if (failed)
    throw new Error(
      '일부 세션에 변경을 적용하지 못했습니다. 실제 상태를 확인하고 다시 시도해 주세요.'
    )
  if (!result) throw new Error('하네스 연결이 바뀌었습니다. 메뉴를 다시 열어 주세요.')
  return result
}
