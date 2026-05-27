import { SessionRow } from './SessionRow'
import { useSessionsContext } from '../providers/SessionsProvider'

interface SessionListProps {
  // ChatContext, ProjectsContext 는 cross-feature 이므로 app/AppLayout 가 wiring.
  currentSessionId: string | null
  projectNameById: Map<string, string>
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

// Sidebar 의 '최근 대화' 슬롯에 주입되는 세션 목록. SessionsContext 는 자기 feature
// 이므로 직접 구독; 다른 도메인 (chat / projects) 결합은 props 로 받는다.
export function SessionList({
  currentSessionId,
  projectNameById,
  onSelect,
  onDelete,
  onRename
}: SessionListProps): React.JSX.Element {
  const { list } = useSessionsContext()

  if (list.length === 0) {
    return <div className="px-1.5 text-[11.5px] text-ink3">아직 저장된 대화가 없습니다.</div>
  }

  return (
    <>
      {list.map((s) => (
        <SessionRow
          key={s.id}
          session={s}
          isActive={s.id === currentSessionId}
          projectName={s.projectId ? (projectNameById.get(s.projectId) ?? null) : null}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </>
  )
}
