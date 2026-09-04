import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { gitApi } from '../../../../shared/api/ipc'

export interface GitIdentityRemote {
  phase: 'loading' | 'ready' | 'unavailable' | 'error'
  url: string | null
}

interface GitIdentityRemoteCache {
  getSnapshot: () => GitIdentityRemote
  subscribe: (listener: () => void) => () => void
  ensure: () => Promise<void>
}

/** 하나의 메뉴 owner가 결과와 진행 중 요청을 공유한다. 새 owner에는 이전 결과가 전달되지 않는다. */
export function createGitIdentityRemoteCache(
  cwd: string,
  load: (cwd: string) => Promise<{ githubUrl?: string | null }>
): GitIdentityRemoteCache {
  let snapshot: GitIdentityRemote = { phase: 'loading', url: null }
  let pending: Promise<void> | null = null
  const listeners = new Set<() => void>()
  const publish = (next: GitIdentityRemote): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    ensure: () => {
      if (pending) return pending
      if (snapshot.phase === 'ready' || snapshot.phase === 'unavailable') return Promise.resolve()
      if (snapshot.phase === 'error') publish({ phase: 'loading', url: null })
      pending = Promise.resolve()
        .then(() => load(cwd))
        .then(
          (status) => {
            pending = null
            publish(
              status.githubUrl
                ? { phase: 'ready', url: status.githubUrl }
                : { phase: 'unavailable', url: null }
            )
          },
          () => {
            pending = null
            publish({ phase: 'error', url: null })
          }
        )
      return pending
    }
  }
}

export function useGitIdentityRemote(
  cwd: string | null | undefined,
  menuEpoch: number | undefined,
  fallbackUrl: string | null
): GitIdentityRemote {
  // GitRow keys the menu owner by session/cwd, identity and refresh ticks.
  // Opening another menu changes only menuEpoch, so it keeps this resource.
  const cache = useMemo(
    () => createGitIdentityRemoteCache(cwd ?? '', (directory) => gitApi.status(directory)),
    [cwd]
  )
  const remote = useSyncExternalStore(cache.subscribe, cache.getSnapshot, cache.getSnapshot)
  useEffect(() => {
    if (cwd && menuEpoch !== undefined) void cache.ensure()
  }, [cwd, menuEpoch, cache])
  return cwd ? remote : { phase: fallbackUrl ? 'ready' : 'unavailable', url: fallbackUrl }
}
