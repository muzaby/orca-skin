import type { BlockSnapshot } from '../lib/transcript/blockList'
import type { ViewportBlockBase } from '../components/transcript/TranscriptViewport'
import { partTextOffset } from '../lib/transcript/viewport/textOffset'

/** A selection end read from the DOM (read only — the viewport never restores it, ΔV2 D-102). */
export interface SelectionEndpoint {
  readonly blockKey: string
  readonly partKey: string
  readonly charOffset: number
}

export interface ViewportDiagnostics {
  count(selectable: boolean): number
  selection(): {
    endpoints: { anchor: SelectionEndpoint; focus: SelectionEndpoint } | null
    blockCount: number
  }
}

export const diagnosticViewports = new Map<string, ViewportDiagnostics>()

function findEndpoint(node: Node | null, offset: number): SelectionEndpoint | null {
  if (!node) return null
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement
  if (!el) return null
  const partEl = el.closest?.('[data-part-key]') as HTMLElement | null
  const blockEl = (el.closest?.('[data-index]') ??
    el.closest?.('[data-block-key]')) as HTMLElement | null
  const blockKey = blockEl?.getAttribute('data-block-key')
  if (!blockEl || !blockKey) return null
  const partKey = partEl?.getAttribute('data-part-key') ?? blockKey
  return { blockKey, partKey, charOffset: partTextOffset(partEl ?? blockEl, node, offset) }
}

export function attachDiagnosticViewport(
  sessionKey: string,
  snapshot: BlockSnapshot<ViewportBlockBase>
): () => void {
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
    selection() {
      const selection = document.getSelection()
      if (!selection?.anchorNode || !selection.focusNode || selection.isCollapsed) {
        return { endpoints: null, blockCount: 0 }
      }
      const anchor = findEndpoint(selection.anchorNode, selection.anchorOffset)
      const focus = findEndpoint(selection.focusNode, selection.focusOffset)
      if (!anchor || !focus) return { endpoints: null, blockCount: 0 }
      const a = snapshot.indexOf(anchor.blockKey)
      const f = snapshot.indexOf(focus.blockKey)
      return {
        endpoints: { anchor, focus },
        blockCount: a >= 0 && f >= 0 ? 1 + Math.abs(a - f) : 0
      }
    }
  })
  return () => {
    diagnosticViewports.delete(sessionKey)
  }
}
