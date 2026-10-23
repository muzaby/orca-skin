import { openConfirmDialog } from '../../../shared/ui/confirmDialogStore'
import { useI18n } from '../../../shared/i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Backend } from '../../../../../shared/ipc'
import type { NativeResource, NativeResources } from '../../../../../shared/native-resources'
import { sessionApi } from '../../../shared/api/ipc'
import { reportError } from '../../../shared/errors'

/** Native global navigation. Never owns a composer/server/project lease. */
export function useNativeMcpCatalog(): {
  list: { backend: Backend; resource: NativeResource }[]
  failed: boolean
  loading: boolean
  refresh(): Promise<void>
  open(backend: Backend, resource: NativeResource): Promise<void>
  toggle(backend: Backend, resource: NativeResource): Promise<void>
} {
  const { tr } = useI18n()
  const [list, setList] = useState<{ backend: Backend; resource: NativeResource }[]>([])
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const loaded = useRef(new Set<Backend>())
  const versions = useRef({ claude: 0, opencode: 0 })
  const failures = useRef(new Set<Backend>())
  const busy = useRef(new Set<Backend>())
  const writes = useRef<Partial<Record<Backend, Promise<void>>>>({})
  const mounted = useRef(false)
  const accept = useCallback((backend: Backend, value: NativeResources) => {
    loaded.current.add(backend)
    setLoading(loaded.current.size < 2)
    setList((previous) =>
      [
        ...previous.filter((item) => item.backend !== backend),
        ...value.items
          .filter((resource) => resource.origin !== 'orca')
          .map((resource) => ({ backend, resource }))
      ].sort((a, b) => a.backend.localeCompare(b.backend))
    )
    failures.current.delete(backend)
    setFailed(failures.current.size > 0)
  }, [])
  const refresh = useCallback(async () => {
    await Promise.all(
      (['claude', 'opencode'] as const).map(async (backend) => {
        if (busy.current.has(backend) || writes.current[backend]) return
        busy.current.add(backend)
        const version = ++versions.current[backend]
        try {
          const value = await sessionApi.globalExtensions(backend)
          if (mounted.current && version === versions.current[backend]) accept(backend, value)
        } catch {
          if (mounted.current && version === versions.current[backend]) {
            failures.current.add(backend)
            loaded.current.add(backend)
            setLoading(loaded.current.size < 2)
            setFailed(true)
          }
        } finally {
          busy.current.delete(backend)
        }
      })
    )
  }, [accept])
  useEffect(() => {
    mounted.current = true
    void refresh()
    const timer = setInterval(() => void refresh(), 5000)
    return () => {
      mounted.current = false
      clearInterval(timer)
    }
  }, [refresh])
  const toggle = async (
    backend: Backend,
    resource: NativeResource,
    confirmed?: true
  ): Promise<void> => {
    if (!resource.canToggle) return
    const version = ++versions.current[backend]
    const task = (writes.current[backend] ?? Promise.resolve())
      .then(async () => {
        try {
          const request = {
            backend,
            id: resource.id,
            kind: resource.kind,
            enabled: !resource.enabled
          }
          const apply = async (): Promise<void> => {
            const value = await sessionApi.setGlobalExtension({
              ...request,
              ...(confirmed ? { confirmed } : {})
            })
            if (value.status === 'confirm') {
              openConfirmDialog({
                title: tr('chat.nativeResources.restartTitle'),
                message: tr('chat.nativeResources.restartBody', { count: value.sessions }),
                confirmLabel: tr('chat.nativeResources.restartConfirm'),
                cancelLabel: tr('common.cancel'),
                onConfirm: () => {
                  void toggle(backend, resource, true).catch((error) =>
                    reportError({
                      event: 'skills.native.toggle-failed',
                      scope: 'native-resources',
                      title: 'saveFailed',
                      error
                    })
                  )
                }
              })
            } else if (mounted.current && version === versions.current[backend])
              accept(backend, value.resources)
          }
          await apply()
        } catch (error) {
          reportError({
            event: 'skills.native.toggle-failed',
            scope: 'native-resources',
            title: 'saveFailed',
            error
          })
        }
      })
      .finally(() => {
        if (writes.current[backend] === task) delete writes.current[backend]
      })
    writes.current[backend] = task
    await task
  }
  return {
    list,
    failed,
    loading,
    refresh,
    open: async (backend, resource) => {
      if (resource.canOpen === false) return
      try {
        await sessionApi.openGlobalExtension({ backend, id: resource.id, kind: resource.kind })
      } catch (error) {
        reportError({
          event: 'skills.native.open-failed',
          scope: 'native-resources',
          title: 'openFailed',
          error
        })
      }
    },
    toggle
  }
}
