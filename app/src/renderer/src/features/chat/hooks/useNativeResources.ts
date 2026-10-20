import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DraftNativeResourcesRequest,
  NativeResource,
  NativeResources
} from '../../../../../shared/native-resources'
import { sessionApi } from '../../../shared/api/ipc'
import { reportError } from '../../../shared/errors'

export type NativeResourcesView =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      value: NativeResources
      refreshing?: boolean
      stale?: boolean
      issue?: 'refresh' | 'control' | 'open'
    }

type Snapshot = Extract<NativeResourcesView, { status: 'ready' }>
// Observations belong to this app window, never to the persisted session or native settings.
const windows = new WeakMap<Window, Map<string, Snapshot>>()
function snapshots(): Map<string, Snapshot> {
  let cache = windows.get(window)
  if (!cache) windows.set(window, (cache = new Map()))
  return cache
}
function readOnly(value: NativeResources): NativeResources {
  return {
    ...value,
    generation: undefined,
    items: value.items.map((item) => ({
      ...item,
      canToggle: false,
      status: item.status === 'connected' ? 'configured' : item.status
    }))
  }
}
function initialView(key: string): NativeResourcesView {
  if (typeof window === 'undefined') return { status: 'loading' }
  const previous = snapshots().get(key)
  return previous
    ? { ...previous, value: readOnly(previous.value), refreshing: true }
    : { status: 'loading' }
}
function observed(value: NativeResources, previous?: Snapshot): Snapshot {
  if (!previous || (value.state === 'connected' && !value.partial))
    return { status: 'ready', value }
  const currentIds = new Set(value.items.map((item) => `${item.kind}:${item.id}`))
  const retained = readOnly(previous.value).items.filter(
    (item) =>
      !currentIds.has(`${item.kind}:${item.id}`) &&
      !(item.kind === 'plugin' && value.pluginsAuthoritative)
  )
  const commands = value.commands ?? previous.value.commands
  const stale = retained.length > 0 || (!value.commands && !!commands?.length)
  return {
    status: 'ready',
    value: {
      ...value,
      items: [...value.items, ...retained],
      ...(commands ? { commands } : {})
    },
    ...(stale ? { stale: true } : {})
  }
}

export function useNativeResources(
  sessionId: string | null,
  open: boolean,
  scope: string | null = null,
  draft?: DraftNativeResourcesRequest
): {
  view: NativeResourcesView
  busy: boolean
  refresh: () => void
  toggle: (resource: NativeResource) => Promise<void>
  openPlugin: (resource: NativeResource) => Promise<void>
} {
  const draftKey = JSON.stringify(draft)
  const key = JSON.stringify([scope, sessionId, sessionId ? null : draftKey])
  const [result, setResult] = useState<{
    key: string
    view: NativeResourcesView
  }>({
    key,
    view: initialView(key)
  })
  const view: NativeResourcesView = result.key === key ? result.view : initialView(key)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  const epoch = useRef(0)
  const pending = useRef(false)
  useEffect(() => {
    const setView = (value: NativeResourcesView): void => setResult({ key, view: value })
    const generation = ++epoch.current
    pending.current = false
    if (!open) return
    // Queue the load state with the request, preserving React's effect boundary.
    void Promise.resolve().then(async () => {
      if (epoch.current !== generation) return
      setBusy(false)
      const previous = snapshots().get(key)
      setView(initialView(key))
      try {
        const value = sessionId
          ? await sessionApi.nativeResources(sessionId)
          : draftKey
            ? await sessionApi.nativeResources(JSON.parse(draftKey) as DraftNativeResourcesRequest)
            : { state: 'disconnected' as const, items: [] }
        if (epoch.current === generation) {
          if (value.partial)
            reportError({
              event: 'chat.native-resources.partial',
              scope: 'native-resources',
              title: 'loadFailed'
            })
          const next = observed(value, previous)
          if (sessionId) snapshots().set(key, next)
          setView(next)
        }
      } catch (error) {
        if (epoch.current === generation) {
          reportError({
            event: 'chat.native-resources.load-failed',
            scope: 'native-resources',
            title: 'loadFailed',
            error
          })
          setView(
            previous
              ? { ...previous, value: readOnly(previous.value), stale: true, issue: 'refresh' }
              : { status: 'error' }
          )
        }
      }
    })
    return () => {
      epoch.current = generation + 1
    }
  }, [sessionId, open, key, draftKey, revision])

  const reloadAfterFailure = async (
    issue: 'control' | 'open',
    generation: number
  ): Promise<void> => {
    if (epoch.current !== generation || (!sessionId && !draftKey) || view.status !== 'ready') return
    const setView = (value: NativeResourcesView): void => setResult({ key, view: value })
    const previous = { ...view, value: readOnly(view.value), stale: true } as const
    setView({ ...previous, refreshing: true, issue })
    try {
      const value = await sessionApi.nativeResources(sessionId ?? JSON.parse(draftKey!))
      if (epoch.current === generation) {
        const next = observed(value, snapshots().get(key))
        if (sessionId) snapshots().set(key, next)
        setView({ ...next, issue })
      }
    } catch {
      if (epoch.current === generation) setView({ ...previous, refreshing: false, issue })
    }
  }

  return {
    view,
    busy,
    refresh,
    openPlugin: async (resource) => {
      if (!open || (!sessionId && !draftKey) || resource.kind !== 'plugin' || pending.current)
        return
      const generation = epoch.current
      pending.current = true
      try {
        await sessionApi.openNativePlugin(
          sessionId ? { sessionId, id: resource.id } : { ...JSON.parse(draftKey!), id: resource.id }
        )
        if (epoch.current === generation)
          setResult((current) =>
            current.view.status === 'ready' && current.view.issue === 'open'
              ? { ...current, view: { ...current.view, issue: undefined } }
              : current
          )
      } catch (error) {
        if (epoch.current === generation)
          reportError({
            event: 'chat.native-resources.open-failed',
            scope: 'native-resources',
            title: 'openFailed',
            error
          })
        await reloadAfterFailure('open', generation)
      } finally {
        if (epoch.current === generation) pending.current = false
      }
    },
    toggle: async (resource) => {
      if (
        !open ||
        !sessionId ||
        !resource.canToggle ||
        pending.current ||
        view.status !== 'ready' ||
        view.refreshing ||
        !view.value.generation
      )
        return
      const setView = (value: NativeResourcesView): void => setResult({ key, view: value })
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
        if (epoch.current === generation) {
          const next = observed(value, snapshots().get(key))
          snapshots().set(key, next)
          setView(next)
        }
      } catch (error) {
        if (epoch.current === generation)
          reportError({
            event: 'chat.native-resources.control-failed',
            scope: 'native-resources',
            title: 'actionFailed',
            error
          })
        await reloadAfterFailure('control', generation)
      } finally {
        if (epoch.current === generation) {
          pending.current = false
          setBusy(false)
        }
      }
    }
  }
}
