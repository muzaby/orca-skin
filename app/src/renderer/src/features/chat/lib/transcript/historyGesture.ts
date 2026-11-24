export const HISTORY_GESTURE_GAP_MS = 200
export type HistoryDirection = 'before' | 'after'
export type HistoryEdgeState = 'ready' | 'loading' | 'error' | 'end'
export interface TranscriptHistoryControls {
  before: HistoryEdgeState
  after?: HistoryEdgeState
  request(direction: HistoryDirection): boolean
  returnToLatest?(): void
}

// Each event extends the gesture, including momentum arriving after the reply.
export class HistoryGesture {
  private lastTime = -Infinity
  private direction?: HistoryDirection
  private consumed = false

  wheel(
    delta: number,
    now: number,
    requestAtEdge: (direction: HistoryDirection) => boolean
  ): 'userInput' | 'started' | 'consumedPull' {
    if (!delta) return 'userInput'
    const direction = delta < 0 ? 'before' : 'after'
    const continuing = this.direction === direction && now - this.lastTime < HISTORY_GESTURE_GAP_MS
    this.direction = direction
    this.lastTime = now
    if (continuing) return this.consumed ? 'consumedPull' : 'userInput'
    this.consumed = requestAtEdge(direction)
    return this.consumed ? 'started' : 'userInput'
  }

  userScroll(): void {
    this.consumed = false
  }

  interrupt(): void {
    this.direction = undefined
    this.consumed = false
  }
}
