import { wireTextFor, type ChunkedText } from '../compute/chunkedText'
import type { MarkdownSegmentRange } from './markdownSegments'

// The store owns hydrated parts. Index only live owners and keep a bounded lookup window.
// This avoids hashing a 40M-character string on the UI thread.
interface HistoryLayout {
  source: string
  pieces?: ChunkedText
  layout: MarkdownSegmentRange[]
}
const ownerLayouts = new WeakMap<object, HistoryLayout>()
const recentOwners: WeakRef<object>[] = []
const recentLimit = 128

export function rememberHistoryLayout(
  owner: object,
  source: string,
  layout: MarkdownSegmentRange[]
): void {
  ownerLayouts.set(owner, { source, layout, pieces: wireTextFor.get(owner) })
  recentOwners.push(new WeakRef(owner))
  if (recentOwners.length > recentLimit) recentOwners.shift()
}

export function findHistoryLayout(source: string): HistoryLayout | undefined {
  for (let i = recentOwners.length - 1; i >= 0; i--) {
    const owner = recentOwners[i].deref()
    if (!owner) {
      recentOwners.splice(i, 1)
      continue
    }
    const entry = ownerLayouts.get(owner)
    if (entry?.source.length === source.length && entry.source === source) return entry
  }
  return undefined
}
