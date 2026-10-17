import { rightPanelTileDefinitionsForAgent, type RightPanelTileId } from '../../lib/rightPanelTiles'
import type { AgentKind } from '../../../../../../shared/agent-kind'
import type { Backend } from '../../../../../../shared/ipc'
import { harnessRightPanel } from '../../harnesses/registries/rightpanel'
import type { RightPanelTileRegistration } from '../../harnesses/contracts'

export const tileRegistry = harnessRightPanel('claude').tiles

export function tileById(
  id: RightPanelTileId,
  backend: Backend | null = 'claude'
): RightPanelTileRegistration {
  return harnessRightPanel(backend).configuration.tileById(id)
}

export const VISIBLE_TILE_REGISTRY = {
  work: rightPanelTileDefinitionsForAgent('work').map((tile) => tileById(tile.id)),
  code: rightPanelTileDefinitionsForAgent('code').map((tile) => tileById(tile.id))
} satisfies Record<AgentKind, RightPanelTileRegistration[]>
