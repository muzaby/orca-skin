import { memo } from 'react'
import { CollapsibleSection } from '../../../shared/ui/SidebarSection'
import { useI18n } from '../../../shared/i18n'
import { SessionRow } from './SessionRow'
import { useNavSections } from '../hooks/useNavSections'
import type { PinnedSessions } from '../lib/navSections'

export interface PinnedSectionViewProps {
  // 0203 ΔV1 EP-9 — 목록은 props 로만 들어온다. 이 컴포넌트에 배치 필터는 없다.
  // ΔV2 EP-11 — 슬롯 브랜드. 파티션의 다른 칸을 넘기면 컴파일되지 않는다.
  sessions: PinnedSessions
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
  // 고정 대화 행의 kebab 에도 최근 대화와 동일한 이름변경/삭제를 노출한다.
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

// 좌측 nav "고정됨" 구획의 렌더. 받은 목록을 그대로 그린다 — 무엇이 고정인지는
// lib/navSections 의 파티션이 이미 정했다(배치 규칙은 이 파일에 없다).
export const PinnedSectionView = memo(function PinnedSectionView({
  sessions,
  currentSessionId,
  onSelectSession,
  onTogglePinSession,
  onDeleteSession,
  onRenameSession
}: PinnedSectionViewProps): React.JSX.Element {
  const { tr } = useI18n()

  return (
    <CollapsibleSection
      label={tr('sidebar.pinned')}
      className="app-frame-sidebar-pinned"
      dataContext="pinned"
    >
      {sessions.map((s) => (
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

export interface PinnedSectionProps extends Omit<PinnedSectionViewProps, 'sessions'> {
  // 배치 판정 입력 — 고정 여부는 projects feature 소관이라 app 셸이 내려 준다.
  pinnedProjectIds: ReadonlySet<string>
}

// store 어댑터. 파생은 공용 파티션이 갖고 여기서는 그 결과의 한 칸을 골라 넘긴다.
export const PinnedSection = memo(function PinnedSection({
  pinnedProjectIds,
  ...view
}: PinnedSectionProps): React.JSX.Element {
  const { pinned } = useNavSections(pinnedProjectIds)
  return <PinnedSectionView sessions={pinned} {...view} />
})
