import { useEffect, useState } from 'react'
import type { Backend } from '../../../../../shared/ipc'
import type {
  DraftNativeResourcesRequest,
  NativeResource,
  NativeResources
} from '../../../../../shared/native-resources'
import { sessionApi } from '../../../shared/api/ipc'
import { reportError } from '../../../shared/errors'

const scope = (backend: Backend): DraftNativeResourcesRequest => ({
  backend,
  cwd: null,
  projectId: null
})
let nextOwner = 0
export function useNativeMcpCatalog(): {
  list: { backend: Backend; resource: NativeResource }[]
  open: (backend: Backend, resource: NativeResource) => Promise<void>
} {
  const [list, setList] = useState<{ backend: Backend; resource: NativeResource }[]>([])
  useEffect(() => {
    let cancelled = false
    const owner = `mcp-page:${++nextOwner}`
    const pushed = new Set<Backend>()
    const accept = (backend: Backend, value: NativeResources): void => {
      if (cancelled) return
      const items = value.items
        .filter((resource) => resource.kind === 'mcp' && resource.origin !== 'orca')
        .map((resource) => ({ backend, resource }))
      setList((previous) => {
        const ids = new Set(items.map(({ resource }) => resource.id))
        return [
          ...previous.filter(
            (item) => item.backend !== backend || (value.partial && !ids.has(item.resource.id))
          ),
          ...items
        ]
      })
    }
    const stop = window.orca?.session?.onNativeResourcesChanged?.((event) => {
      if (!event.scope || event.scope.cwd !== null || event.scope.projectId !== null) return
      pushed.add(event.scope.backend)
      accept(event.scope.backend, event.resources)
    })
    for (const backend of ['claude', 'opencode'] as const) {
      void sessionApi
        .nativeResources(scope(backend), { owner: `${owner}:${backend}`, active: true })
        .catch(() => undefined)
      void sessionApi
        .nativeResources(scope(backend))
        .then((value) => {
          if (!pushed.has(backend)) accept(backend, value)
        })
        .catch(() => undefined)
    }
    return () => {
      cancelled = true
      stop?.()
      for (const backend of ['claude', 'opencode'] as const)
        void sessionApi
          .nativeResources(scope(backend), { owner: `${owner}:${backend}`, active: false })
          .catch(() => undefined)
    }
  }, [])
  return {
    list,
    open: async (backend, resource) => {
      try {
        await sessionApi.openNativePlugin({ ...scope(backend), id: resource.id, kind: 'mcp' })
      } catch (error) {
        reportError({
          event: 'skills.native-mcp.open-failed',
          scope: 'native-resources',
          title: 'openFailed',
          error
        })
      }
    }
  }
}
