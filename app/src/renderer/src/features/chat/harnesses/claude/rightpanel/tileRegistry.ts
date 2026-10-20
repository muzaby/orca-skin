import {
  NativeResourcesTileContent,
  NativeResourcesTileHeader
} from '../../../components/rightpanel/NativeResourcesTile'
import { rightPanelTileDefinitions, type RightPanelTileId } from '../../../lib/rightPanelTiles'
import type { RightPanelTileRegistration } from '../../contracts'
import { PlanTileHeaderActions } from '../../common/rightpanel/PlanTileContent'
import { DiffTileContent } from '../../common/rightpanel/DiffTileContent'
import { GitContextBar } from '../../common/rightpanel/GitContextBar'
import { SubAgentTileContent, SubAgentTileHeader } from './SubAgentTileContent'
import { TaskTileContent, TaskTileHeader } from './TaskTileContent'
import { PlanContent } from './PlanTile'

const contentById = {
  nativeStatus: NativeResourcesTileContent,
  plan: PlanContent,
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
      tile.id === 'nativeStatus'
        ? NativeResourcesTileHeader
        : tile.id === 'subagent'
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
