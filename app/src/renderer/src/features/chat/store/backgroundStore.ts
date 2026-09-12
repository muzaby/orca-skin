import { create } from 'zustand'
import { chatApi } from '../../../shared/api/ipc'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState,
  isBackgroundTerminal,
  type BackgroundEvent,
  type BackgroundSessionState
} from '../../../../../shared/background-task'
import { isCompletedBackgroundCall, projectBackgroundPanel } from '../lib/canonicalBackground'
import type { SubagentTaskSummary } from '../lib/parts'

export type BackgroundSelection = { kind: 'task'; key: string } | { kind: 'call'; key: string }
export type BackgroundGroup = 'running' | 'completed'
export interface BackgroundPanelState {
  collapsed?: Partial<Record<BackgroundGroup, boolean>>
  dismissedTasks?: string[]
  dismissedCalls?: string[]
  dismissedLegacy?: string[]
}

interface BackgroundView {
  state: BackgroundSessionState
  loading: boolean
  error?: string
  selection?: BackgroundSelection
}
interface BackgroundStore {
  sessions: Record<string, BackgroundView>
  panels: Record<string, BackgroundPanelState>
}
export const useBackgroundStore = create<BackgroundStore>(() => ({ sessions: {}, panels: {} }))

export function toggleBackgroundGroup(sessionId: string, group: BackgroundGroup): void {
  useBackgroundStore.setState((store) => {
    const panel = store.panels[sessionId] ?? {}
    return {
      panels: {
        ...store.panels,
        [sessionId]: {
          ...panel,
          collapsed: { ...panel.collapsed, [group]: !panel.collapsed?.[group] }
        }
      }
    }
  })
}

/** Dismiss only terminal identities observed at this click; provider state and transcript stay intact. */
export function dismissCompletedBackgroundItems(
  sessionId: string,
  legacyTasks: readonly SubagentTaskSummary[] = []
): void {
  useBackgroundStore.setState((store) => {
    const view = store.sessions[sessionId]
    const panel = store.panels[sessionId] ?? {}
    const dismissedTasks = new Set(panel.dismissedTasks)
    const dismissedCalls = new Set(panel.dismissedCalls)
    if (view) {
      const projected = projectBackgroundPanel(view.state, undefined, panel)
      for (const task of projected.tasks)
        if (isBackgroundTerminal(task.status)) {
          dismissedTasks.add(backgroundKey(task.generation, task.taskId))
          if (task.toolUseId) dismissedCalls.add(backgroundKey(task.generation, task.toolUseId))
        }
      for (const call of projected.calls)
        if (isCompletedBackgroundCall(call)) {
          dismissedCalls.add(backgroundKey(call.generation, call.toolUseId))
          if (call.taskId) dismissedTasks.add(backgroundKey(call.generation, call.taskId))
        }
    }
    const nextPanel: BackgroundPanelState = {
      ...panel,
      dismissedTasks: [...dismissedTasks],
      dismissedCalls: [...dismissedCalls],
      dismissedLegacy: [
        ...new Set([
          ...(panel.dismissedLegacy ?? []),
          ...legacyTasks.filter((task) => task.status !== 'running').map((task) => task.toolUseId)
        ])
      ]
    }
    const nextSelection = view
      ? projectBackgroundPanel(view.state, view.selection, nextPanel)
      : undefined
    return {
      panels: { ...store.panels, [sessionId]: nextPanel },
      ...(view && !nextSelection?.selectedTask && !nextSelection?.selectedCall
        ? { sessions: { ...store.sessions, [sessionId]: { ...view, selection: undefined } } }
        : {})
    }
  })
}
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
export function selectBackgroundItem(
  sessionId: string,
  selection: BackgroundSelection | undefined
): void {
  useBackgroundStore.setState((store) => {
    const view = store.sessions[sessionId]
    if (!view) return store
    return {
      sessions: {
        ...store.sessions,
        [sessionId]: { ...view, selection }
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
        ...store.sessions[sessionId],
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
      sessions: {
        ...store.sessions,
        [sessionId]: { ...store.sessions[sessionId], state, loading: false, error: undefined }
      }
    }))
  } catch (error) {
    if (removed.has(sessionId) || loadingEvents.get(sessionId) !== events) return
    useBackgroundStore.setState((store) => ({
      sessions: {
        ...store.sessions,
        [sessionId]: {
          ...store.sessions[sessionId],
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
    const panels = { ...store.panels }
    delete sessions[sessionId]
    delete panels[sessionId]
    return { sessions, panels }
  })
}
