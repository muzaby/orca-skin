import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExecutionSettingsPicker } from '../features/chat'
import { useProjectsState } from '../features/projects'
import { SchedulesView, type RenderExecutionPicker } from '../features/schedules'

const renderExecutionPicker: RenderExecutionPicker = (value, onChange) => (
  <ExecutionSettingsPicker value={value} onChange={onChange} />
)

// `/scheduled` — 예약 작업 목록. 조립만 한다: 프로젝트 목록(projects)·실행 설정 입력
// (chat)·대화 열기(router)를 schedules feature 에 넘긴다.
export function SchedulesPage(): React.JSX.Element {
  const list = useProjectsState((s) => s.list)
  const projects = useMemo(
    () => list.map((project) => ({ id: project.id, name: project.name, cwd: project.cwd ?? null })),
    [list]
  )
  const navigate = useNavigate()
  return (
    <SchedulesView
      projects={projects}
      renderExecutionPicker={renderExecutionPicker}
      onOpenSession={(sessionId) => void navigate(`/chat/${sessionId}`)}
    />
  )
}
