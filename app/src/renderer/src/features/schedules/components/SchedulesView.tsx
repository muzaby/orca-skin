import { useEffect } from 'react'
import { useI18n } from '../../../shared/i18n'
import type { ScheduleProject } from '../lib/scheduleForm'
import { confirmTaskDeletion, reportTaskFailure } from '../lib/taskActions'
import {
  schedulesActions,
  subscribeScheduleChanges,
  useSchedulesState
} from '../store/schedulesStore'
import { SchedulesScreen } from './SchedulesScreen'
import type { SchedulePickers } from './ScheduleTaskModal'

interface SchedulesViewProps {
  // 프로젝트 목록·프로젝트/실행 설정 입력·대화 열기는 다른 feature 의 것이라 pages 가 넘긴다.
  projects: readonly ScheduleProject[]
  pickers: SchedulePickers
  onOpenSession: (sessionId: string) => void
}

export function SchedulesView({
  projects,
  pickers,
  onOpenSession
}: SchedulesViewProps): React.JSX.Element {
  const { tr } = useI18n()
  const tasks = useSchedulesState((s) => s.list)
  const loading = useSchedulesState((s) => s.loading)
  const revision = useSchedulesState((s) => s.revision)
  useEffect(() => {
    void schedulesActions.refresh().catch(reportTaskFailure)
    return subscribeScheduleChanges()
  }, [])
  return (
    <SchedulesScreen
      tasks={tasks}
      loading={loading}
      revision={revision}
      projects={projects}
      pickers={pickers}
      onCreate={schedulesActions.create}
      onUpdate={schedulesActions.update}
      onDelete={(task) => confirmTaskDeletion(task, tr)}
      onSetEnabled={(id, enabled) =>
        void schedulesActions.setEnabled(id, enabled).catch(reportTaskFailure)
      }
      onRunNow={(id) => void schedulesActions.runNow(id).catch(reportTaskFailure)}
      loadRuns={schedulesActions.listRuns}
      onOpenSession={onOpenSession}
    />
  )
}
