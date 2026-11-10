import { useCallback, useEffect, useRef, useState } from 'react'
import type { Backend } from '../../../../../shared/ipc'
import type { NativeResource, NativeResources } from '../../../../../shared/native-resources'
import { sessionApi } from '../../../shared/api/ipc'
import { reportError } from '../../../shared/errors'
import { useI18n } from '../../../shared/i18n'
import { openConfirmDialog } from '../../../shared/ui/confirmDialogStore'

/** Native global navigation. Never owns a composer/server/project lease. */
export function useNativeMcpCatalog(): {
  list: { backend: Backend; resource: NativeResource }[]
  failed: boolean
  loading: boolean
  refresh(): Promise<void>
  open(backend: Backend, resource: NativeResource): Promise<void>
  /** Harnesses whose toggle is in flight — every native row of them is locked meanwhile. */
  locked: ReadonlySet<Backend>
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
  // One toggle per harness: a Claude plugin change closes every Claude session, and the reply
  // replaces the harness's rows, so a second toggle could only race the first.
  const locks = useRef(new Set<Backend>())
  const [locked, setLocked] = useState<ReadonlySet<Backend>>(new Set())
  const mounted = useRef(false)
  const pending = useRef(new Set<Backend>())
  const accept = useCallback((backend: Backend, value: NativeResources) => {
    loaded.current.add(backend)
    setLoading(loaded.current.size < 2)
    setList((previous) =>
      [
        ...previous.filter((item) => item.backend !== backend),
        ...value.items
          .filter((resource) => resource.origin !== 'orcinus-orca')
          .map((resource) => ({ backend, resource }))
      ].sort((a, b) => a.backend.localeCompare(b.backend))
    )
    failures.current.delete(backend)
    setFailed(failures.current.size > 0)
  }, [])
  const refreshBackend = useCallback(
    async (backend: Backend) => {
      if (!mounted.current) return
      if (busy.current.has(backend) || locks.current.has(backend)) {
        pending.current.add(backend)
        return
      }
      busy.current.add(backend)
      try {
        do {
          pending.current.delete(backend)
          const version = ++versions.current[backend]
          try {
            const value = await sessionApi.globalExtensions(backend)
            if (mounted.current && version === versions.current[backend]) accept(backend, value)
          } catch (error) {
            if (mounted.current && version === versions.current[backend]) {
              // Toast only when this harness enters the failed state. Focus and change pushes
              // re-read the list, and a failure that persists must not toast on every read.
              if (!failures.current.has(backend))
                reportError({
                  event: 'skills.native.load-failed',
                  scope: 'native-resources',
                  title: 'loadFailed',
                  error
                })
              failures.current.add(backend)
              loaded.current.add(backend)
              setLoading(loaded.current.size < 2)
              setFailed(true)
            }
          }
        } while (mounted.current && pending.current.has(backend) && !locks.current.has(backend))
      } finally {
        busy.current.delete(backend)
      }
    },
    [accept]
  )
  const refresh = useCallback(async () => {
    await Promise.all((['claude', 'opencode'] as const).map(refreshBackend))
  }, [refreshBackend])
  useEffect(() => {
    const pendingRefreshes = pending.current
    const requestVersions = versions.current
    mounted.current = true
    void refresh()
    const unsubscribe = sessionApi.onExtensionsChanged(({ backend }) => {
      void refreshBackend(backend)
    })
    const focus = (): void => {
      void refresh()
    }
    window.addEventListener('focus', focus)
    return () => {
      mounted.current = false
      pendingRefreshes.clear()
      requestVersions.claude++
      requestVersions.opencode++
      unsubscribe?.()
      window.removeEventListener('focus', focus)
    }
  }, [refresh, refreshBackend])
  const setLock = (backend: Backend, held: boolean): void => {
    if (held) locks.current.add(backend)
    else locks.current.delete(backend)
    if (mounted.current) setLocked(new Set(locks.current))
  }
  const toggle = async (backend: Backend, resource: NativeResource): Promise<void> => {
    if (!resource.canToggle || locks.current.has(backend)) return
    setLock(backend, true)
    const version = ++versions.current[backend]
    const request = {
      backend,
      id: resource.id,
      kind: resource.kind,
      enabled: !resource.enabled
    }
    try {
      let value = await sessionApi.setGlobalExtension(request)
      if (value.status === 'confirm') {
        const sessions = value.sessions
        // main counts busy Claude sessions; the dialog only shows that count.
        // The lock holds until the dialog resolves, so a second dialog can never replace it.
        const confirmed = await new Promise<boolean>((resolve) =>
          openConfirmDialog({
            title: tr('chat.nativeResources.claudeCloseTitle'),
            message: tr('chat.nativeResources.claudeCloseBody', { count: sessions }),
            confirmLabel: tr('chat.nativeResources.claudeCloseConfirm'),
            cancelLabel: tr('common.cancel'),
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
          })
        )
        if (!confirmed) return
        value = await sessionApi.setGlobalExtension({ ...request, confirmed: true })
      }
      if (value.status === 'applied' && mounted.current && version === versions.current[backend])
        accept(backend, value.resources)
    } catch (error) {
      reportError({
        event: 'skills.native.toggle-failed',
        scope: 'native-resources',
        title: 'saveFailed',
        error
      })
    } finally {
      setLock(backend, false)
      if (pending.current.has(backend)) void refreshBackend(backend)
    }
  }
  return {
    list,
    failed,
    loading,
    locked,
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
