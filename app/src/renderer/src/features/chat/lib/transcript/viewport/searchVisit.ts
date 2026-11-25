import type { AnchorTarget } from './anchor'
interface ReadingPosition {
  session: string
  generation: string
  anchor: AnchorTarget
}
const positions = new Map<number, ReadingPosition>()

export function saveSearchPosition(
  visit: number,
  session: string,
  generation: string,
  anchor: AnchorTarget
): void {
  if (anchor.messageId) positions.set(visit, { session, generation, anchor })
}

export function searchPosition(visit: number, session: string): ReadingPosition | undefined {
  const position = positions.get(visit)
  return position?.session === session ? position : undefined
}

export function forgetSearchPositions(session: string): void {
  for (const [visit, position] of positions)
    if (position.session === session) positions.delete(visit)
}

let captureOrigin:
  (() => { session: string; anchor: AnchorTarget | null; pinned: boolean }) | undefined
export function registerSearchOrigin(capture: NonNullable<typeof captureOrigin>): () => void {
  captureOrigin = capture
  return () => {
    if (captureOrigin === capture) captureOrigin = undefined
  }
}
export function rememberSearchOrigin(session: string, generation: string | undefined): void {
  const route = globalThis.window?.history
  if (!route?.state || !captureOrigin) return
  const origin = captureOrigin()
  if (origin.session !== session || (!origin.pinned && (!generation || !origin.anchor?.messageId)))
    return
  route.replaceState(
    { ...route.state, usr: { ...route.state.usr, historyOrigin: { ...origin, generation } } },
    ''
  )
}
