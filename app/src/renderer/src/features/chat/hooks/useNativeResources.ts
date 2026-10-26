import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { DraftNativeResourcesRequest } from '../../../../../shared/native-resources'
import { nativeResourceState, type NativeResourcesView } from '../lib/nativeResourceState'
export type { NativeResourcesView } from '../lib/nativeResourceState'

export function useNativeResources(
  sessionId: string | null,
  open: boolean,
  scope: string | null = null,
  draft?: DraftNativeResourcesRequest
): {
  view: NativeResourcesView
  ensure: () => void
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
    if (open) void state.ensure()
  }, [state, open])
  const ensure = useCallback(() => {
    void state.ensure()
  }, [state])
  return {
    view: snapshot.view,
    ensure
  }
}
