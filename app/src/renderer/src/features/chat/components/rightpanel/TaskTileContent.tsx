import { useI18n } from '../../../../shared/i18n'
import { TileSection } from './TaskTileSections'
import { TaskOutputContent } from './TaskOutputContent'
import { TaskContextContent } from './TaskContextContent'
import { useTaskBoard } from '../../hooks/useTaskBoard'
import { WorkTaskProgress } from './WorkTaskProgress'
import { TaskPanelContent } from './TaskPanelContent'

export { TaskProgressList } from './TaskProgressList'

export function TaskTileHeader(): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <span className="min-w-0 truncate text-footnote font-medium text-ink">
      {tr('chat.taskTile.headerTitle')}
    </span>
  )
}

export function TaskTileContent(): React.JSX.Element {
  const items = useTaskBoard()
  return (
    <TaskPanelContent items={items} mode="work">
      <TileSection titleKey="chat.taskTile.sections.progress">
        <WorkTaskProgress items={items} />
      </TileSection>
      <TaskOutputContent />
      <TaskContextContent />
    </TaskPanelContent>
  )
}
