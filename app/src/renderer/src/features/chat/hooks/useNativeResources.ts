import { useEffect, useRef, useState } from 'react'
import type { NativeResource, NativeResources } from '../../../../../shared/native-resources'
import { sessionApi } from '../../../shared/api/ipc'

export type NativeResourcesView =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: NativeResources }

export function useNativeResources(
  sessionId: string | null,
  open: boolean
): {
  view: NativeResourcesView
  busy: boolean
  toggle: (resource: NativeResource) => Promise<void>
} {
  const [result, setResult] = useState<{ sessionId: string | null; view: NativeResourcesView }>({
    sessionId,
    view: { status: 'loading' }
  })
  const view: NativeResourcesView =
    result.sessionId === sessionId ? result.view : { status: 'loading' }
  const [busy, setBusy] = useState(false)
  const epoch = useRef(0)
  const pending = useRef(false)
  useEffect(() => {
    const setView = (value: NativeResourcesView): void => setResult({ sessionId, view: value })
    const generation = ++epoch.current
    pending.current = false
    if (!open) return
    // Queue the load state with the request, preserving React's effect boundary.
    void Promise.resolve().then(async () => {
      if (epoch.current !== generation) return
      setBusy(false)
      setView({ status: 'loading' })
      try {
        const value = sessionId
          ? await sessionApi.nativeResources(sessionId)
          : { state: 'disconnected' as const, items: [] }
        if (epoch.current === generation) setView({ status: 'ready', value })
      } catch {
        if (epoch.current === generation) setView({ status: 'error' })
      }
    })
    return () => {
      epoch.current = generation + 1
    }
  }, [sessionId, open])

  return {
    view,
    busy,
    toggle: async (resource) => {
      if (
        !open ||
        !sessionId ||
        !resource.canToggle ||
        pending.current ||
        view.status !== 'ready' ||
        !view.value.generation
      )
        return
      const setView = (value: NativeResourcesView): void => setResult({ sessionId, view: value })
      const generation = epoch.current
      pending.current = true
      setBusy(true)
      try {
        const value = await sessionApi.setNativeResource({
          sessionId,
          generation: view.value.generation,
          kind: resource.kind,
          id: resource.id,
          enabled: !resource.enabled
        })
        if (epoch.current === generation) setView({ status: 'ready', value })
      } catch {
        if (epoch.current === generation) setView({ status: 'error' })
      } finally {
        if (epoch.current === generation) {
          pending.current = false
          setBusy(false)
        }
      }
    }
  }
}
