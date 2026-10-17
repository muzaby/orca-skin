import { createContext, useCallback, useContext, useState } from 'react'

export interface TimelineAnchor {
  key: string
  offset: number
}
// Imperative viewport cache, independent of React render state. Mutations happen
// through event/measurement actions and survive virtual row unmounts.
export class TimelineViewState {
  top = 0
  pinned = true
  anchor: TimelineAnchor | null = null
  disclosures = new Map<string, boolean>()
  sizes = new Map<string, number>()
  setTop(top: number): void {
    this.top = top
  }
  setPinned(pinned: boolean): void {
    this.pinned = pinned
  }
  setAnchor(anchor: TimelineAnchor | null): void {
    this.anchor = anchor
  }
}
const sessions = new Map<string, TimelineViewState>()
export function timelineViewState(key: string): TimelineViewState {
  let state = sessions.get(key)
  if (!state) {
    state = new TimelineViewState()
    sessions.set(key, state)
  }
  return state
}
export const TimelineDisclosureContext = createContext<TimelineViewState | null>(null)
// A selected live node stays mounted until selection ends. Complete Markdown
// then resolves cross-block references and final fenced-code highlighting.
export function useTimelineMarkdownMode(streaming: boolean, selected: boolean): boolean {
  const [mode, setMode] = useState(streaming)
  if (mode !== streaming && (!selected || streaming)) setMode(streaming)
  return mode
}
export function useToolDisclosure(
  key: string,
  initial: boolean
): [boolean, (value: boolean | ((previous: boolean) => boolean)) => void] {
  const state = useContext(TimelineDisclosureContext)
  const [open, update] = useState(() => state?.disclosures.get(key) ?? initial)
  const setOpen = useCallback(
    (value: boolean | ((previous: boolean) => boolean)) => {
      update((previous) => {
        const next = typeof value === 'function' ? value(previous) : value
        state?.disclosures.set(key, next)
        return next
      })
    },
    [key, state]
  )
  return [open, setOpen]
}
