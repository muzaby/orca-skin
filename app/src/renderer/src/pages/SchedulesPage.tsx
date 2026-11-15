import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExecutionSettingsPicker, ProjectPickerChip } from '../features/chat'
import { projectsActions, useProjectsState } from '../features/projects'
import { SchedulesView, type ScheduleProject, type SchedulePickers } from '../features/schedules'
import { reportError } from '../shared/errors'
import { useI18n } from '../shared/i18n'

// 폴더를 골라 프로젝트를 더하고 그 id 를 돌려준다. 실패는 오류 토스트로 알린다.
async function addProject(): Promise<string | null> {
  try {
    return (await projectsActions.addFromDirectory())?.id ?? null
  } catch (error) {
    reportError({ event: 'files.cwd-action.failed', scope: 'files', title: 'actionFailed', error })
    return null
  }
}

// `/scheduled` — 예약 작업 목록. 조립만 한다: 프로젝트 목록·추가(projects)·프로젝트/실행 설정
// 입력(chat)·대화 열기(router)를 schedules feature 에 넘긴다.
export function SchedulesPage(): React.JSX.Element {
  const { tr } = useI18n()
  const list = useProjectsState((s) => s.list)
  const projects = useMemo<ScheduleProject[]>(
    () => list.map((project) => ({ id: project.id, name: project.name, cwd: project.cwd ?? null })),
    [list]
  )
  const pickers = useMemo<SchedulePickers>(
    () => ({
      project: (value, onChange) => (
        <ProjectPickerChip
          projects={projects}
          value={value}
          onChange={onChange}
          onAdd={addProject}
          placeholder={tr('schedules.modal.projectPlaceholder')}
        />
      ),
      execution: (value, onChange) => <ExecutionSettingsPicker value={value} onChange={onChange} />
    }),
    [projects, tr]
  )
  const navigate = useNavigate()
  return (
    <SchedulesView
      projects={projects}
      pickers={pickers}
      onOpenSession={(sessionId) => void navigate(`/chat/${sessionId}`)}
    />
  )
}
