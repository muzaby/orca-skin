import type { BlockSnapshot } from '../lib/transcript/blockList'
import type { ViewportBlockBase } from '../components/transcript/TranscriptViewport'
import { partTextOffset, pointAtPartOffset } from '../lib/transcript/viewport/textOffset'
import type { CopyTaskTiming, RetainedSelection } from '../lib/transcript/viewport/copy'

export interface ViewportDiagnostics {
  count(selectable: boolean): number
  select(
    from: string | number,
    to: string | number,
    options?: { reverse?: boolean; partialEnds?: boolean }
  ): boolean
  selection(): { endpoints: RetainedSelection | null; blockCount: number }
}

export const diagnosticViewports = new Map<string, ViewportDiagnostics>()
let failedChunk: number | null = null

let lastTimings: CopyTaskTiming[] = []

export function beginCopyTiming(): (timing: CopyTaskTiming) => void {
  const timings: CopyTaskTiming[] = []
  lastTimings = timings
  return (timing) => timings.push(timing)
}

export function copyTimings(): readonly CopyTaskTiming[] {
  return lastTimings.slice()
}

export function failCopyChunk(index: number | null): void {
  failedChunk = index
}

export function checkCopyChunk(index: number): void {
  if (index !== failedChunk) return
  failedChunk = null
  throw new Error('Diagnostic copy chunk failure')
}

export function attachDiagnosticViewport(
  sessionKey: string,
  root: HTMLElement | null,
  snapshot: BlockSnapshot<ViewportBlockBase>,
  {
    findEndpoint,
    indexFor,
    mountEndpoints
  }: {
    findEndpoint(node: Node | null, offset: number): RetainedSelection['anchor'] | null
    indexFor(endpoint: RetainedSelection['anchor']): number
    mountEndpoints(selection: RetainedSelection): void
  }
): () => void {
  const inspect = (): RetainedSelection | null => {
    const selection = document.getSelection()
    if (!selection?.anchorNode || !selection.focusNode || selection.isCollapsed) return null
    const anchor = findEndpoint(selection.anchorNode, selection.anchorOffset)
    const focus = findEndpoint(selection.focusNode, selection.focusOffset)
    return anchor && focus ? { anchor, focus } : null
  }
  diagnosticViewports.set(sessionKey, {
    count(selectable) {
      if (!selectable) return snapshot.count
      let count = 0
      for (let i = 0; i < snapshot.count; i++) {
        const block = snapshot.blockAt(i)
        if ('kind' in block && ['segment', 'user', 'activity'].includes(String(block.kind))) count++
      }
      return count
    },
    select(from, to, options) {
      const at = (value: string | number): number =>
        typeof value === 'number' ? value : snapshot.indexOf(value)
      const indices = [at(from), at(to)]
      if (indices.some((i) => i < 0 || i >= snapshot.count)) return false
      if (options?.reverse && indices[0] < indices[1]) indices.reverse()
      const selection = document.getSelection()
      if (!root || !selection) return false
      const [anchor, focus] = indices.map((i) => {
        const block = snapshot.blockAt(i)
        return { blockKey: block.key, partKey: block.partKeys?.[0] ?? block.key, charOffset: 0 }
      })
      mountEndpoints({ anchor, focus })
      const points = indices.map((i, side) => {
        const block = root.querySelector(`[data-block-key="${CSS.escape(snapshot.keyAt(i))}"]`)
        const parts = block?.querySelectorAll('[data-part-key]')
        const end = side === (indices[0] > indices[1] ? 0 : 1)
        const part = end ? parts?.[parts.length - 1] : parts?.[0]
        const element = part ?? block
        if (!element) return null
        const last = partTextOffset(element, element, element.childNodes.length)
        const offset = options?.partialEnds
          ? Math.max(0, end ? last - 1 : Math.min(1, last))
          : end
            ? last
            : 0
        return pointAtPartOffset(element, offset)
      })
      const [a, f] = points
      if (!a || !f) return false
      selection.setBaseAndExtent(a.node, a.offset, f.node, f.offset)
      const actual = inspect()
      if (actual) mountEndpoints(actual)
      return !!actual
    },
    selection() {
      const endpoints = inspect()
      return {
        endpoints,
        blockCount: endpoints
          ? 1 + Math.abs(indexFor(endpoints.anchor) - indexFor(endpoints.focus))
          : 0
      }
    }
  })
  return () => {
    diagnosticViewports.delete(sessionKey)
  }
}
