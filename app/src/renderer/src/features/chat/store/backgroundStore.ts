import { create } from 'zustand'
import { chatApi } from '../../../shared/api/ipc'
import {
  applyBackgroundEvent,
  emptyBackgroundState,
  type BackgroundEvent,
  type BackgroundSessionState
} from '../../../../../shared/background-task'

interface BackgroundView {
  state: BackgroundSessionState
  loading: boolean
  error?: string
}
interface BackgroundStore {
  sessions: Record<string, BackgroundView>
}
export const useBackgroundStore = create<BackgroundStore>(() => ({ sessions: {} }))
const loadingEvents = new Map<string, BackgroundEvent[]>()
const removed = new Set<string>()
export function ingestBackgroundEvent(event: BackgroundEvent): void {
  if (removed.has(event.sessionId)) return
  loadingEvents.get(event.sessionId)?.push(event)
  useBackgroundStore.setState((store) => {
    const view = store.sessions[event.sessionId] ?? {
      state: emptyBackgroundState(),
      loading: false
    }
    return {
      sessions: {
        ...store.sessions,
        [event.sessionId]: { ...view, state: applyBackgroundEvent(view.state, event) }
      }
    }
  })
}
export async function refreshBackgroundState(sessionId: string): Promise<void> {
  if (loadingEvents.has(sessionId)) return
  removed.delete(sessionId)
  const events: BackgroundEvent[] = []
  loadingEvents.set(sessionId, events)
  useBackgroundStore.setState((store) => ({
    sessions: {
      ...store.sessions,
      [sessionId]: {
        state: store.sessions[sessionId]?.state ?? emptyBackgroundState(),
        loading: true
      }
    }
  }))
  try {
    let state = await chatApi.backgroundState(sessionId)
    if (removed.has(sessionId) || loadingEvents.get(sessionId) !== events) return
    for (const event of events) state = applyBackgroundEvent(state, event)
    useBackgroundStore.setState((store) => ({
      sessions: { ...store.sessions, [sessionId]: { state, loading: false } }
    }))
  } catch (error) {
    if (removed.has(sessionId) || loadingEvents.get(sessionId) !== events) return
    useBackgroundStore.setState((store) => ({
      sessions: {
        ...store.sessions,
        [sessionId]: {
          state: store.sessions[sessionId]?.state ?? emptyBackgroundState(),
          loading: false,
          error: String(error)
        }
      }
    }))
  } finally {
    if (loadingEvents.get(sessionId) === events) loadingEvents.delete(sessionId)
  }
}
export function forgetBackgroundState(sessionId: string): void {
  removed.add(sessionId)
  loadingEvents.delete(sessionId)
  useBackgroundStore.setState((store) => {
    const sessions = { ...store.sessions }
    delete sessions[sessionId]
    return { sessions }
  })
}
