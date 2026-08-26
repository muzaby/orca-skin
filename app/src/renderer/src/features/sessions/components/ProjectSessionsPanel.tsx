import { useEffect } from 'react'
import { SessionRow } from './SessionRow'
import { useProjectSessions } from '../hooks/useProjectSessions'
import { sessionsActions } from '../store/sessionsStore'
import { useI18n } from '../../../shared/i18n'

interface ProjectSessionsPanelProps {
  projectId: string
  currentSessionId: string | null
  // 채팅 턴 종료 시 자동 refresh 트리거 (chat-side inflight flag 가 false 로 전이).
  refreshOnTurnEnd: boolean
  // chat-domain 결합 (cache invalidation, newChat) 은 cross-feature 이므로 page wiring.
  onSessionSelected: (id: string) => void
  // 삭제/이름변경의 실제 수행자 — chat·sessions 두 스토어 동기화와 라우팅까지 묶은
  // page 의 useSessionActions 를 받는다(패널은 IPC 를 직접 부르지 않는다).
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
}

// 프로젝트 랜딩의 "이 프로젝트의 대화" 패널. 목록 조회와 세션 행 렌더만 갖는다 —
// 삭제·이름변경은 chat/sessions 두 스토어를 함께 건드려야 하므로 page 가 주입한
// 핸들러(useSessionActions)가 수행한다.
export function ProjectSessionsPanel({
  projectId,
  currentSessionId,
  refreshOnTurnEnd,
  onSessionSelected,
  onDeleteSession,
  onRenameSession
}: ProjectSessionsPanelProps): React.JSX.Element {
  const { tr } = useI18n()
  const sessions = useProjectSessions(projectId)

  // chat 턴 종료 시 새 세션이 추가됐을 가능성 → refresh.
  useEffect(() => {
    if (!refreshOnTurnEnd) void sessionsActions.loadProject(projectId).catch(() => undefined)
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
            {tr('sessions.projectEmpty')}
          </div>
        ) : (
          sessions.list.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              isActive={s.id === currentSessionId}
              onSelect={onSessionSelected}
              onDelete={onDeleteSession}
              onRename={onRenameSession}
            />
          ))
        )}
      </div>
    </section>
  )
}
