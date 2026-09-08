import { useEffect } from 'react'
import { useI18n } from '../../../../shared/i18n'
import { chatActions, useChatSession, useUnseenSettledTaskCount } from '../../store/chatStore'
import { taskBoardItemByKey } from '../../lib/taskBoard'
import { TileSection } from './TaskTileSections'
import { TaskOutputContent } from './TaskOutputContent'
import { TaskContextContent } from './TaskContextContent'
import { useTaskBoard } from '../../hooks/useTaskBoard'
import { WorkTaskProgress } from './WorkTaskProgress'

// 기존 호출부 import 호환. 구현은 계획과 Work가 공유하는 단일 모듈이다.
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
  const selectedKey = useChatSession((s) => s.selectedTaskKey)
  const selected = taskBoardItemByKey(items, selectedKey)
  const unseen = useUnseenSettledTaskCount()
  useEffect(() => {
    if (unseen > 0) chatActions.acknowledgeSettledTasks()
  }, [unseen])
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <TileSection titleKey="chat.taskTile.sections.progress">
        <WorkTaskProgress items={items} selected={selected} />
      </TileSection>
      <TaskOutputContent />
      <TaskContextContent />
    </div>
  )
}
