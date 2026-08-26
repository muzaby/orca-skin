import { memo, useMemo } from 'react'
import { CollapsibleSection } from '../../../shared/ui/SidebarSection'
import { useI18n } from '../../../shared/i18n'
import { SessionRow } from './SessionRow'
import { useSessionsState } from '../store/sessionsStore'
import { isPinnedSession } from '../lib/sessionPlacement'

export interface PinnedSectionProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
  // 고정 대화 행의 kebab 에도 최근 대화와 동일한 이름변경/삭제를 노출한다.
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

// 좌측 nav "고정됨" 섹션 — 소속과 무관하게 고정된 대화만 한곳에 나열한다(배치 규칙은
// lib/sessionPlacement). 같은 대화는 최근 대화 및 프로젝트 하위 목록에서 제외되어
// nav 안에 한 번만 나타난다.
export const PinnedSection = memo(function PinnedSection({
  currentSessionId,
  onSelectSession,
  onTogglePinSession,
  onDeleteSession,
  onRenameSession
}: PinnedSectionProps): React.JSX.Element {
  const { tr } = useI18n()
  const byId = useSessionsState((state) => state.byId)
  // 셀렉터가 새 배열을 반환하면 useSyncExternalStore 캐시가 깨지므로 엔티티 맵을 구독하고
  // 파생은 useMemo — 고정 세션만, 고정 시각 내림차순(최근 고정이 위).
  const pinnedSessions = useMemo(
    () =>
      Object.values(byId)
        .filter(isPinnedSession)
        .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)),
    [byId]
  )

  return (
    <CollapsibleSection
      label={tr('sidebar.pinned')}
      className="app-frame-sidebar-pinned"
      dataContext="pinned"
    >
      {pinnedSessions.map((s) => (
        <SessionRow
          key={s.id}
          session={s}
          isActive={s.id === currentSessionId}
          onSelect={onSelectSession}
          onDelete={onDeleteSession}
          onRename={onRenameSession}
          onTogglePin={onTogglePinSession}
          pinned
          leadingIcon="chat"
        />
      ))}
    </CollapsibleSection>
  )
})
