import {
  useCallback,
  useEffect,
  useSyncExternalStore,
  type FocusEvent,
  type RefObject
} from 'react'

export interface FocusRecord {
  sessionKey: string
  blockKey: string
  focusId: string
}

interface DisclosureState {
  activeSessionKey: string
  bySession: Record<string, Record<string, boolean>>
  focusRecord: FocusRecord | null
}

const DEFAULT_SESSION_KEY = '__new__'

let state: DisclosureState = {
  activeSessionKey: DEFAULT_SESSION_KEY,
  bySession: {},
  focusRecord: null
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setDisclosureActiveSession(sessionKey: string): void {
  if (state.activeSessionKey === sessionKey) return
  state = { ...state, activeSessionKey: sessionKey }
  emit()
}

let focusListenerAttached = false

function handleDocumentFocusIn(event: Event): void {
  const { focusRecord } = state
  if (!focusRecord) return
  const target = event.target
  if (!(target instanceof Element)) return
  const control = target.closest('[data-focus-id]')
  const block = target.closest('[data-block-key]')
  const focusId = control?.getAttribute('data-focus-id') ?? null
  const blockKey = block?.getAttribute('data-block-key') ?? null
  if (focusId === focusRecord.focusId && blockKey === focusRecord.blockKey) return
  state = { ...state, focusRecord: null }
  emit()
}

function ensureFocusListener(): void {
  if (focusListenerAttached || typeof document === 'undefined') return
  focusListenerAttached = true
  document.addEventListener('focusin', handleDocumentFocusIn, true)
}

export function getDisclosure(sessionKey: string, blockKey: string, initial = false): boolean {
  const sessionMap = state.bySession[sessionKey]
  if (!sessionMap || !(blockKey in sessionMap)) return initial
  return sessionMap[blockKey]
}

export function setDisclosure(sessionKey: string, blockKey: string, open: boolean): void {
  const prevSession = state.bySession[sessionKey]
  if (prevSession && prevSession[blockKey] === open) return
  state = {
    ...state,
    bySession: {
      ...state.bySession,
      [sessionKey]: {
        ...(prevSession ?? {}),
        [blockKey]: open
      }
    }
  }
  emit()
}

export function clearDisclosures(sessionKey: string): void {
  const hasSession = sessionKey in state.bySession
  const clearFocus = state.focusRecord?.sessionKey === sessionKey
  if (!hasSession && !clearFocus) return
  const nextBySession = hasSession ? { ...state.bySession } : state.bySession
  if (hasSession) delete nextBySession[sessionKey]
  state = {
    ...state,
    bySession: nextBySession,
    focusRecord: clearFocus ? null : state.focusRecord
  }
  emit()
}

export function pruneDisclosures(
  sessionKey: string,
  validKeys: ReadonlySet<string>,
  complete: boolean
): void {
  if (!complete) return
  const prevSession = state.bySession[sessionKey]
  const shouldClearFocus =
    state.focusRecord !== null &&
    state.focusRecord.sessionKey === sessionKey &&
    !validKeys.has(state.focusRecord.blockKey)

  if (!prevSession) {
    if (shouldClearFocus) {
      state = { ...state, focusRecord: null }
      emit()
    }
    return
  }

  let changed = false
  const nextSession: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(prevSession)) {
    if (validKeys.has(key)) {
      nextSession[key] = value
    } else {
      changed = true
    }
  }
  if (!changed && !shouldClearFocus) return
  const nextBySession = { ...state.bySession }
  if (Object.keys(nextSession).length === 0) {
    delete nextBySession[sessionKey]
  } else {
    nextBySession[sessionKey] = nextSession
  }
  state = {
    ...state,
    bySession: nextBySession,
    focusRecord: shouldClearFocus ? null : state.focusRecord
  }
  emit()
}

export function recordFocus(sessionKey: string, blockKey: string, focusId: string): void {
  ensureFocusListener()
  const prev = state.focusRecord
  if (
    prev &&
    prev.sessionKey === sessionKey &&
    prev.blockKey === blockKey &&
    prev.focusId === focusId
  ) {
    return
  }
  state = { ...state, focusRecord: { sessionKey, blockKey, focusId } }
  emit()
}

export function clearFocusRecord(): void {
  if (state.focusRecord === null) return
  state = { ...state, focusRecord: null }
  emit()
}

export function getFocusRecord(): FocusRecord | null {
  return state.focusRecord
}

export function restoreFocusIfEligible(
  sessionKey: string,
  blockKey: string,
  container: HTMLElement | null
): boolean {
  if (!container || typeof document === 'undefined') return false
  const record = state.focusRecord
  if (!record || record.sessionKey !== sessionKey || record.blockKey !== blockKey) return false
  const active = document.activeElement
  if (active === null) return false
  if (active !== document.body) {
    // Focus moved elsewhere (e.g. composer) while unmounted: do not steal it.
    state = { ...state, focusRecord: null }
    emit()
    return false
  }
  const selector = `[data-focus-id="${record.focusId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`
  const target =
    container.getAttribute('data-focus-id') === record.focusId
      ? container
      : container.querySelector<HTMLElement>(selector)
  if (!target) return false
  target.focus({ preventScroll: true })
  return true
}

export function useDisclosure(
  blockKey: string,
  initial = false,
  explicitSessionKey?: string
): [boolean, (open: boolean) => void] {
  const activeKey = useSyncExternalStore(
    subscribe,
    () => state.activeSessionKey,
    () => state.activeSessionKey
  )
  const sessionKey = explicitSessionKey ?? activeKey
  const getOpen = (): boolean => getDisclosure(sessionKey, blockKey, initial)
  const open = useSyncExternalStore(subscribe, getOpen, getOpen)
  const setOpen = useCallback(
    (next: boolean) => {
      setDisclosure(sessionKey, blockKey, next)
    },
    [sessionKey, blockKey]
  )
  return [open, setOpen]
}

export function useDisclosureFocus(
  blockKey: string,
  containerRef: RefObject<HTMLElement | null>,
  explicitSessionKey?: string
): { onFocus: (event: FocusEvent<HTMLElement>) => void } {
  const activeKey = useSyncExternalStore(
    subscribe,
    () => state.activeSessionKey,
    () => state.activeSessionKey
  )
  const sessionKey = explicitSessionKey ?? activeKey

  useEffect(() => {
    ensureFocusListener()
    restoreFocusIfEligible(sessionKey, blockKey, containerRef.current)
  }, [sessionKey, blockKey, containerRef])

  const onFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const control = target.closest('[data-focus-id]')
      const focusId = control?.getAttribute('data-focus-id')
      if (focusId) {
        recordFocus(sessionKey, blockKey, focusId)
      }
    },
    [sessionKey, blockKey]
  )

  return { onFocus }
}

export function resetDisclosureStoreForTest(): void {
  state = {
    activeSessionKey: DEFAULT_SESSION_KEY,
    bySession: {},
    focusRecord: null
  }
  emit()
}

export function getSessionDisclosureKeysForTest(sessionKey: string): string[] {
  const map = state.bySession[sessionKey]
  return map ? Object.keys(map) : []
}
