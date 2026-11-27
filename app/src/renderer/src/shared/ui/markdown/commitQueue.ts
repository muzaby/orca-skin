import { flushSync } from 'react-dom'

// Fair across documents and streaming tails in this window. Each producer queues its
// next slice after React has acknowledged the previous render. Keep slow slices alone.
const work = new Set<() => void>()
let frame = 0

function advance(): void {
  frame = 0
  const deadline = performance.now() + 4
  // Work scheduled by effects during this flush belongs to a subsequent browser frame.
  const ready = [...work]
  for (const commit of ready) {
    if (!work.delete(commit)) continue
    flushSync(commit)
    if (performance.now() >= deadline) break
  }
  if (work.size && !frame) frame = requestAnimationFrame(advance)
}

export function scheduleMarkdownCommit(commit: () => void): () => void {
  work.add(commit)
  if (!frame) frame = requestAnimationFrame(advance)
  return () => {
    work.delete(commit)
    if (!work.size && frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }
}
