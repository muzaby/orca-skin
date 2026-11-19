/**
 * Pin-to-bottom policy for shared TranscriptViewport (EP-11 ①⑤ · p1, p2, p6, p9).
 */

export interface PinPolicyConfig {
  /** Distance from bottom (px) within which the viewport is considered pinned. */
  readonly bottomThresholdPx: number
  /** Claude follows growth only while generating; OpenCode follows any growth while pinned. */
  readonly followOnlyWhileGenerating: boolean
}

export const CLAUDE_PIN_POLICY: PinPolicyConfig = {
  bottomThresholdPx: 24,
  followOnlyWhileGenerating: true
}

export const OPENCODE_PIN_POLICY: PinPolicyConfig = {
  bottomThresholdPx: 40,
  followOnlyWhileGenerating: false
}

export interface PinState {
  readonly pinned: boolean
}

export interface ScrollMetrics {
  readonly scrollTop: number
  readonly clientHeight: number
  readonly scrollHeight: number
}

export function isAtBottom(metrics: ScrollMetrics, thresholdPx: number): boolean {
  const distance = metrics.scrollHeight - (metrics.scrollTop + metrics.clientHeight)
  return distance <= thresholdPx
}

export type UpwardInputEvent =
  | { readonly type: 'wheel'; readonly deltaY: number }
  | { readonly type: 'key'; readonly key: string }
  | { readonly type: 'touchmove'; readonly deltaY: number }

const UPWARD_KEYS = new Set(['PageUp', 'Home', 'ArrowUp'])

/**
 * Upward user input unpins immediately without waiting for a scroll event (p9 — short latest turn).
 */
export function isUpwardUserIntent(input: UpwardInputEvent): boolean {
  if (input.type === 'wheel') return input.deltaY < 0
  if (input.type === 'touchmove') return input.deltaY < 0
  return UPWARD_KEYS.has(input.key)
}

export function pinPolicy(config: PinPolicyConfig): {
  onScroll(metrics: ScrollMetrics): PinState
  onUserInput(state: PinState, input: UpwardInputEvent): PinState
  shouldFollowGrowth(state: PinState, generating: boolean): boolean
} {
  return {
    onScroll(metrics) {
      return { pinned: isAtBottom(metrics, config.bottomThresholdPx) }
    },
    onUserInput(state, input) {
      if (state.pinned && isUpwardUserIntent(input)) {
        return { pinned: false }
      }
      return state
    },
    shouldFollowGrowth(state, generating) {
      if (!state.pinned) return false
      return config.followOnlyWhileGenerating ? generating : true
    }
  }
}
