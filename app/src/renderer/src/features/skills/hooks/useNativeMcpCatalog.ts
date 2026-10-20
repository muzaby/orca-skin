import { useEffect, useState } from 'react'
import type { Backend } from '../../../../../shared/ipc'
import type {
  DraftNativeResourcesRequest,
  NativeResource
} from '../../../../../shared/native-resources'
import { sessionApi } from '../../../shared/api/ipc'
import { reportError } from '../../../shared/errors'

const scope = (backend: Backend): DraftNativeResourcesRequest => ({
  backend,
  cwd: null,
  projectId: null
})
export function useNativeMcpCatalog(): {
  list: { backend: Backend; resource: NativeResource }[]
  open: (backend: Backend, resource: NativeResource) => Promise<void>
} {
  const [list, setList] = useState<{ backend: Backend; resource: NativeResource }[]>([])
  useEffect(() => {
    let cancelled = false
    void Promise.allSettled(
      (['claude', 'opencode'] as const).map(async (backend) => {
        const value = await sessionApi.nativeResources(scope(backend))
        return value.items
          .filter((resource) => resource.kind === 'mcp' && resource.origin !== 'orca')
          .map((resource) => ({ backend, resource }))
      })
    ).then((results) => {
      if (!cancelled)
        setList(results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])))
    })
    return () => {
      cancelled = true
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
