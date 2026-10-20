import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type {
  DraftNativeResourcesRequest,
  NativeResource
} from '../../../../../shared/native-resources'
import { nativeResourceState, type NativeResourcesView } from '../lib/nativeResourceState'
export type { NativeResourcesView } from '../lib/nativeResourceState'

export function useNativeResources(
  sessionId: string | null,
  open: boolean,
  scope: string | null = null,
  draft?: DraftNativeResourcesRequest
): {
  view: NativeResourcesView
  busy: boolean
  pending: ReadonlySet<string>
  refresh: () => void
  toggle: (resource: NativeResource) => Promise<void>
  openPlugin: (resource: NativeResource) => Promise<void>
} {
  const draftKey = JSON.stringify(draft)
  const key = JSON.stringify([scope, sessionId, sessionId ? null : draftKey])
  const state = useMemo(
    () =>
      nativeResourceState(
        key,
        sessionId ?? (draftKey ? (JSON.parse(draftKey) as DraftNativeResourcesRequest) : undefined)
      ),
    [key, sessionId, draftKey]
  )
  const snapshot = useSyncExternalStore(state.subscribe, state.getSnapshot, state.getSnapshot)
  useEffect(() => {
    if (open) void state.refresh()
  }, [state, open])
  const refresh = useCallback(() => {
    void state.refresh()
  }, [state])
  return {
    view: snapshot.view,
    busy: snapshot.pending.size > 0,
    pending: snapshot.pending,
    refresh,
    toggle: (resource) => (open ? state.toggle(resource) : Promise.resolve()),
    openPlugin: (resource) => (open ? state.openPlugin(resource) : Promise.resolve())
  }
}
