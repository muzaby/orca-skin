import type { AgentKind } from '../../../../../shared/agent-kind'
import { clampSidePaneWidth, sidePaneBounds } from '../../../shared/hooks/sidePaneResize'

export const PANEL_TRANSITION_MS = 200

export function targetWidth(
  kind: AgentKind,
  widths: Record<AgentKind, number>,
  hostWidth: number
): number {
  return clampSidePaneWidth(widths[kind], sidePaneBounds(hostWidth))
}

export type FramePhase = 'closed' | 'opening' | 'open' | 'closing'

export function framePhase(open: boolean, settled: boolean, reduced: boolean): FramePhase {
  if (open) return settled || reduced ? 'open' : 'opening'
  return settled || reduced ? 'closed' : 'closing'
}
