import { createElement } from 'react'
import { rightPanelTileDefinitions, type RightPanelTileId } from '../../../lib/rightPanelTiles'
import { harnessCatalog } from '../../catalog'
import { DiffTileContent } from '../../common/rightpanel/DiffTileContent'
import { GitContextBar } from '../../common/rightpanel/GitContextBar'
import { PlanTileContent, PlanTileHeaderActions } from '../../common/rightpanel/PlanTileContent'
import type { RightPanelTileRegistration } from '../../contracts'
import {
  OpenCodeAgentContent,
  OpenCodeAgentHeader,
  OpenCodeProcessContent,
  OpenCodeSourceContent,
  OpenCodeTaskContent
} from './tiles'

const contentById = {
  plan: () =>
    createElement(PlanTileContent, {
      emptyDescriptionKey: harnessCatalog('opencode').planEmptyDescription,
      selectHintKey: harnessCatalog('opencode').planSelectHint
    }),
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
      tile.id === 'subagent' ? OpenCodeAgentHeader : tile.id === 'diff' ? GitContextBar : undefined
  })
)

export function openCodeTileById(id: RightPanelTileId): RightPanelTileRegistration {
  return openCodeTiles.find((tile) => tile.id === id) ?? openCodeTiles[0]
}
