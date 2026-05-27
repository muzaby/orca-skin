import { useEffect } from 'react'
import { SessionRow } from './SessionRow'
import { useProjectSessions } from '../hooks/useProjectSessions'

interface ProjectSessionsPanelProps {
  projectId: string
  currentSessionId: string | null
  // 채팅 턴 종료 시 자동 refresh 트리거 (chat-side inflight flag 가 false 로 전이).
  refreshOnTurnEnd: boolean
  // chat-domain 결합 (cache invalidation, newChat) 은 cross-feature 이므로 page wiring.
  onSessionSelected: (id: string) => void
  onSessionDeleting: (id: string) => void
  onSessionRenamed: (id: string, title: string) => void
}

// 프로젝트 랜딩의 "이 프로젝트의 대화" 패널. useProjectSessions IPC + 세션 행 렌더 +
// 삭제·rename IPC 호출 모두 feature 내부에 캡슐화. chat-side 동작은 page 가 props
// 로 주입한 콜백을 통해 통지.
export function ProjectSessionsPanel({
  projectId,
  currentSessionId,
  refreshOnTurnEnd,
  onSessionSelected,
  onSessionDeleting,
  onSessionRenamed
}: ProjectSessionsPanelProps): React.JSX.Element {
  const sessions = useProjectSessions(projectId)

  // chat 턴 종료 시 새 세션이 추가됐을 가능성 → refresh.
  useEffect(() => {
    if (!refreshOnTurnEnd) void sessions.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshOnTurnEnd])

  return (
    <div className="flex max-h-[180px] flex-none flex-col border-t border-border bg-sidebar">
      <div className="flex items-baseline gap-2 px-4 pb-1 pt-3">
        <div className="font-serif text-[11px] font-semibold uppercase tracking-[0.04em] text-ink3">
          이 프로젝트의 대화
        </div>
        <div className="text-[11px] text-ink3">
          {sessions.loading ? '불러오는 중…' : `${sessions.list.length}개`}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {!sessions.loading && sessions.list.length === 0 ? (
          <div className="px-2.5 py-2 text-[11.5px] text-ink3">
            아직 이 프로젝트에 속한 대화가 없습니다. 위 입력창에서 첫 메시지를 보내보세요.
          </div>
        ) : (
          sessions.list.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              isActive={s.id === currentSessionId}
              onSelect={onSessionSelected}
              onDelete={(id) => {
                onSessionDeleting(id)
                void sessions.remove(id)
              }}
              onRename={(id, title) => {
                onSessionRenamed(id, title)
                void sessions.rename(id, title)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
