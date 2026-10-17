import { useI18n } from '../../../../../shared/i18n'
import { TileSection } from '../../common/rightpanel/TaskTileSections'
import { TaskOutputContent } from '../../common/rightpanel/TaskOutputContent'
import { TaskContextContent } from '../../common/rightpanel/TaskContextContent'
import { useTaskBoard } from '../../../hooks/useTaskBoard'
import { WorkTaskProgress } from '../../common/rightpanel/WorkTaskProgress'
import { TaskPanelContent } from '../../common/rightpanel/TaskPanelContent'
import { TaskScheduleContent } from '../../common/rightpanel/TaskScheduleContent'

export { TaskProgressList } from '../../common/rightpanel/TaskProgressList'

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
      <TaskScheduleContent />
      <TileSection titleKey="chat.taskTile.sections.progress">
        <WorkTaskProgress items={items} />
      </TileSection>
      <TaskOutputContent />
      <TaskContextContent />
    </TaskPanelContent>
  )
}
