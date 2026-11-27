/**
 * Selection cancel rule for the shared transcript viewport (0326 ΔV2 · D-103 · EP-25).
 *
 * Copy is the browser default (D-102). The viewport never restores a selection.
 * Instead, while a transcript selection exists, a newly mounted virtualized row
 * cancels it, and a drag that was cancelled stays without selection until the
 * pointer is released.
 */

/** Where the current selection lives relative to the transcript viewport. */
export type SelectionPlace = 'none' | 'outside' | 'inside' | 'dragging'

export interface CancelInput {
  readonly previousKeys: ReadonlySet<string>
  readonly nextKeys: Iterable<string>
  readonly selection: SelectionPlace | (() => SelectionPlace)
}

/** True when a row key appears that the previous commit did not render. */
export function hasNewRow(previousKeys: ReadonlySet<string>, nextKeys: Iterable<string>): boolean {
  for (const key of nextKeys) if (!previousKeys.has(key)) return true
  return false
}

export function shouldCancelSelection({ previousKeys, nextKeys, selection }: CancelInput): boolean {
  if (!hasNewRow(previousKeys, nextKeys)) return false
  const place = typeof selection === 'function' ? selection() : selection
  return place === 'inside' || place === 'dragging'
}

export type GestureState = 'idle' | 'dragging' | 'suppressed'

export type GestureEvent =
  | { readonly type: 'pointerdown'; readonly button: number }
  | { readonly type: 'cancel' }
  | { readonly type: 'pointerup' }
  | { readonly type: 'pointercancel' }
  | { readonly type: 'blur' }

export function gestureReducer(state: GestureState, event: GestureEvent): GestureState {
  switch (event.type) {
    case 'pointerdown':
      return state === 'idle' && event.button === 0 ? 'dragging' : state
    case 'cancel':
      return state === 'dragging' ? 'suppressed' : state
    case 'pointerup':
    case 'pointercancel':
    case 'blur':
      return 'idle'
  }
}

export function isSuppressed(state: GestureState): boolean {
  return state === 'suppressed'
}
