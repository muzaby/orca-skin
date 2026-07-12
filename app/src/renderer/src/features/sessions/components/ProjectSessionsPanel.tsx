import { useEffect } from 'react'
import { SessionRow } from './SessionRow'
import { useProjectSessions } from '../hooks/useProjectSessions'
import { useI18n } from '../../../shared/i18n'

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
  const { tr } = useI18n()
  const sessions = useProjectSessions(projectId)

  // chat 턴 종료 시 새 세션이 추가됐을 가능성 → refresh.
  useEffect(() => {
    if (!refreshOnTurnEnd) void sessions.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshOnTurnEnd])

  return (
    <section className="flex flex-col">
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <div className="font-serif text-[13px] font-semibold text-ink">
          {tr('projects.sessionsPanel.title')}
        </div>
        <div className="text-[11px] text-ink3">
          {sessions.loading
            ? tr('common.loading')
            : tr('common.count', { count: sessions.list.length })}
        </div>
      </div>
      <div className="flex flex-col">
        {!sessions.loading && sessions.list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-panel/40 px-4 py-6 text-center text-[12px] leading-[1.55] text-ink3">
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
    </section>
  )
}
