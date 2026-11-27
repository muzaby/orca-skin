import type { AgentKind } from '../../../../../shared/agent-kind'
import type { Backend } from '../../../../../shared/ipc'
import type { ArtifactViewerSelection } from '../store/artifactViewerStore'
import { isRightPanelTileVisible, rightPanelPolicy, type RightPanelTileId } from './panelTiles'

export type PanelDetailSelection =
  | { id: 'diff' | 'source' }
  | { id: 'process'; selectedId: string | null }
  | { id: 'subagent'; selectedId: string | null; backgroundKind?: 'call' | 'task' }

export type PanelLayer =
  | { kind: 'tile'; id: RightPanelTileId }
  | { kind: 'detail'; selection: PanelDetailSelection }
  | { kind: 'taskDetail'; id: RightPanelTileId; task: string }
  | { kind: 'artifact'; viewer: ArtifactViewerSelection }

export interface PanelSession {
  key: string
  kind: AgentKind
  backend: Backend | null
}

export type PanelEntry = PanelLayer & { origin?: HTMLElement; fallbackOrigin?: HTMLElement }

export function layerKey(layer: PanelLayer): string {
  switch (layer.kind) {
    case 'tile':
      return layer.id
    case 'detail':
      return layer.selection.id === 'subagent' && layer.selection.selectedId === null
        ? 'detail:subagent-list'
        : 'detail:' + layer.selection.id
    case 'taskDetail':
      return 'task:' + layer.task
    case 'artifact':
      return 'artifact:' + layer.viewer.artifact.publicationId
  }
}

export function initialLayer(session: PanelSession, remembered?: RightPanelTileId): PanelEntry {
  const policy = rightPanelPolicy(session.kind, session.backend)
  return {
    kind: 'tile',
    id:
      remembered && isRightPanelTileVisible(remembered, session.kind, session.backend)
        ? remembered
        : (policy.initialTile ?? policy.taskTarget)
  }
}

export function navigateStack(
  stack: PanelEntry[],
  entry: PanelEntry,
  root: PanelEntry,
  toggle: boolean
): PanelEntry[] {
  const index = stack.findIndex((layer) => layerKey(layer) === layerKey(entry))
  if (index >= 0) {
    if (index === stack.length - 1 && toggle) return []
    if (entry.kind === 'tile' || entry.kind === 'artifact') {
      return index === stack.length - 1 ? stack : stack.slice(0, index + 1)
    }
    return [...stack.slice(0, index), entry]
  }
  if (
    !stack.length &&
    (entry.kind === 'artifact' ||
      (entry.kind === 'detail' &&
        entry.selection.id === 'subagent' &&
        entry.selection.selectedId !== null))
  )
    return [root, entry]
  return [...stack, entry]
}
