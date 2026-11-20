/**
 * Entry scroll placement policy (EP-11 ④⑧ · D-057 · D-074 · p7, p8, p10, p11, p13~p15).
 */

export type EntryCause = 'open' | 'resume' | 'sync'

export interface EntryIntent {
  readonly sessionKey: string
  readonly cause: 'open'
  readonly seq: number
}

export interface SavedViewportPosition {
  readonly pinned: boolean
  readonly scrollTop: number
  readonly anchorKey?: string
}

export type EntryPlacement =
  | { readonly action: 'scroll-bottom' }
  | { readonly action: 'restore-saved'; readonly saved: SavedViewportPosition }
  | { readonly action: 'keep-anchor' }

/**
 * Decide initial/transition placement for a transcript viewport:
 * - `open` (session switch / history list open): ALWAYS bottom on all 3 screens (even if OpenCode has saved anchor — p7).
 * - `resume` (remount without open intent): Claude → bottom; OpenCode → saved anchor (or bottom if pinned — p8).
 * - `sync` (revalidate / native sync reset): keep current anchor / pin state (p10).
 */
export function entryPolicy(
  cause: EntryCause,
  harness: 'claude' | 'opencode',
  saved?: SavedViewportPosition
): EntryPlacement {
  if (cause === 'open') {
    return { action: 'scroll-bottom' }
  }
  if (cause === 'sync') {
    return { action: 'keep-anchor' }
  }
  // resume
  if (harness === 'claude') {
    return { action: 'scroll-bottom' }
  }
  if (!saved || saved.pinned) {
    return { action: 'scroll-bottom' }
  }
  return { action: 'restore-saved', saved }
}
