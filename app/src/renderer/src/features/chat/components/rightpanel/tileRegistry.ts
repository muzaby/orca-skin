import type { RightPanelTileId } from '../../lib/rightPanelTiles'
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
