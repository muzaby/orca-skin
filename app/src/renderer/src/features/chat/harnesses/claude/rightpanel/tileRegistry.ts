import { createElement } from 'react'
import { rightPanelTileDefinitions, type RightPanelTileId } from '../../../lib/rightPanelTiles'
import { harnessCatalog } from '../../catalog'
import { DiffTileContent } from '../../common/rightpanel/DiffTileContent'
import { GitContextBar } from '../../common/rightpanel/GitContextBar'
import { PlanTileContent, PlanTileHeaderActions } from '../../common/rightpanel/PlanTileContent'
import type { RightPanelTileRegistration } from '../../contracts'
import { SubAgentTileContent, SubAgentTileHeader } from './SubAgentTileContent'
import { TaskTileContent, TaskTileHeader } from './TaskTileContent'

const contentById = {
  plan: () =>
    createElement(PlanTileContent, {
      emptyDescriptionKey: harnessCatalog('claude').planEmptyDescription,
      selectHintKey: harnessCatalog('claude').planSelectHint
    }),
  subagent: SubAgentTileContent,
  task: TaskTileContent,
  diff: DiffTileContent
} satisfies Partial<Record<RightPanelTileId, React.ComponentType>>

export const claudeTiles: RightPanelTileRegistration[] = rightPanelTileDefinitions
  .filter((tile) => tile.id in contentById)
  .map((tile) => ({
    ...tile,
    Content: contentById[tile.id as keyof typeof contentById],
    HeaderActions: tile.id === 'plan' ? PlanTileHeaderActions : undefined,
    HeaderContent:
      tile.id === 'subagent'
        ? SubAgentTileHeader
        : tile.id === 'task'
          ? TaskTileHeader
          : tile.id === 'diff'
            ? GitContextBar
            : undefined
  }))

export function claudeTileById(id: RightPanelTileId): RightPanelTileRegistration {
  return claudeTiles.find((tile) => tile.id === id) ?? claudeTiles[0]
}
