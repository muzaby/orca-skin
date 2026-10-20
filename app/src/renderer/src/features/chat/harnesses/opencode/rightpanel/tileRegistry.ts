import {
  NativeResourcesTileContent,
  NativeResourcesTileHeader
} from '../../../components/rightpanel/NativeResourcesTile'
import { rightPanelTileDefinitions, type RightPanelTileId } from '../../../lib/rightPanelTiles'
import type { RightPanelTileRegistration } from '../../contracts'
import { PlanTileHeaderActions } from '../../common/rightpanel/PlanTileContent'
import { DiffTileContent } from '../../common/rightpanel/DiffTileContent'
import { GitContextBar } from '../../common/rightpanel/GitContextBar'
import {
  OpenCodeAgentContent,
  OpenCodeAgentHeader,
  OpenCodeProcessContent,
  OpenCodeSourceContent,
  OpenCodeTaskContent
} from './tiles'
import { PlanContent } from './PlanTile'

const contentById = {
  nativeStatus: NativeResourcesTileContent,
  plan: PlanContent,
  subagent: OpenCodeAgentContent,
  task: OpenCodeTaskContent,
  diff: DiffTileContent,
  process: OpenCodeProcessContent,
  source: OpenCodeSourceContent
} satisfies Record<RightPanelTileId, React.ComponentType>

export const openCodeTiles: RightPanelTileRegistration[] = rightPanelTileDefinitions.map(
  (tile) => ({
    ...tile,
    Content: contentById[tile.id],
    HeaderActions: tile.id === 'plan' ? PlanTileHeaderActions : undefined,
    HeaderContent:
      tile.id === 'nativeStatus'
        ? NativeResourcesTileHeader
        : tile.id === 'subagent'
          ? OpenCodeAgentHeader
          : tile.id === 'diff'
            ? GitContextBar
            : undefined
  })
)

export function openCodeTileById(id: RightPanelTileId): RightPanelTileRegistration {
  return openCodeTiles.find((tile) => tile.id === id) ?? openCodeTiles[0]
}
