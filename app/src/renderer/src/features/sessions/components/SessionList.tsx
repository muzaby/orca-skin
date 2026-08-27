import { memo } from 'react'
import { SessionRow } from './SessionRow'
import type { SessionListItem } from '../../../../../shared/ipc'
import { useI18n } from '../../../shared/i18n'
import { isPinnedSession } from '../lib/sessionPlacement'
import { useNavSections } from '../hooks/useNavSections'

// 미물질화 draft nav 행(0064 r4 fork/handoff + 0065 활성 '새 대화'). chat feature 의
// DraftRow 와 구조적으로 호환 — cross-feature import 대신 셸(app/)이 매핑해 props 로
// 내린다(4-layer 경계). '새 대화' 행은 deletable=false(삭제 개념 없음 — kebab 숨김).
export interface DraftSessionRow {
  key: string
  title: string | null
  projectId: string | null
  deletable: boolean
}

export interface SessionListViewProps {
  // 0203 ΔV1 EP-9 — 목록은 props 로만 들어온다. 이 컴포넌트에 배치 필터는 없다.
  sessions: SessionListItem[]
  // ChatContext, ProjectsContext 는 cross-feature 이므로 app/AppLayout 가 wiring.
  currentSessionId: string | null
  projectNameById: Map<string, string>
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  // 0129 고정 토글 — 각 최근 대화 행의 kebab 에 고정/해제 항목을 배선.
  onTogglePin: (id: string, pinned: boolean) => void
  // 미물질화 continuity draft 행 — DB 목록 위에 얹는다(fork 클릭 = nav 즉시 추가, 0064 r4).
  drafts?: DraftSessionRow[]
  activeDraftKey?: string | null
  onSelectDraft?: (key: string) => void
  onDeleteDraft?: (key: string) => void
}

// Sidebar 의 '최근 대화' 구획 렌더. 받은 목록을 그대로 그린다 — 무엇이 최근인지는
// lib/navSections 의 파티션이 이미 정했다(배치 규칙은 이 파일에 없다).
export const SessionListView = memo(function SessionListView({
  sessions,
  currentSessionId,
  projectNameById,
  onSelect,
  onDelete,
  onRename,
  onTogglePin,
  drafts = [],
  activeDraftKey = null,
  onSelectDraft,
  onDeleteDraft
}: SessionListViewProps): React.JSX.Element {
  const { tr } = useI18n()

  if (sessions.length === 0 && drafts.length === 0) {
    return <div className="px-1.5 text-[11.5px] text-ink3">{tr('sessions.empty')}</div>
  }

  return (
    <>
      {drafts.map((d) => (
        <SessionRow
          key={d.key}
          session={draftAsListItem(d)}
          isActive={d.key === activeDraftKey}
          projectName={d.projectId ? (projectNameById.get(d.projectId) ?? null) : null}
          onSelect={onSelectDraft}
          {...(d.deletable ? { onDelete: onDeleteDraft } : {})}
          renameable={false}
        />
      ))}
      {sessions.map((s) => (
        <SessionRow
          key={s.id}
          session={s}
          isActive={s.id === currentSessionId}
          projectName={s.projectId ? (projectNameById.get(s.projectId) ?? null) : null}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
          onTogglePin={onTogglePin}
          pinned={isPinnedSession(s)}
        />
      ))}
    </>
  )
})

export interface SessionListProps extends Omit<SessionListViewProps, 'sessions'> {
  // 배치 판정 입력 — 고정 프로젝트의 대화는 그 프로젝트 하위 목록이 가져간다.
  // 고정 여부는 projects feature 소관이라 app 셸이 내려 준다(cross-feature 는 props-only).
  pinnedProjectIds: ReadonlySet<string>
}

// store 어댑터. 파생은 공용 파티션이 갖고 여기서는 그 결과의 한 칸을 골라 넘긴다.
export const SessionList = memo(function SessionList({
  pinnedProjectIds,
  ...view
}: SessionListProps): React.JSX.Element {
  const { recent } = useNavSections(pinnedProjectIds)
  return <SessionListView sessions={recent} {...view} />
})

// SessionRow 재사용을 위한 최소 합성 — draft 는 DB 행이 아니므로 메타는 채우지 않는다.
function draftAsListItem(d: DraftSessionRow): SessionListItem {
  return {
    id: d.key,
    backend: 'claude',
    title: d.title,
    updatedAt: 0,
    preview: null,
    projectId: d.projectId,
    cwd: null,
    pinnedAt: null
  }
}
