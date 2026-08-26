import { useMemo } from 'react'
import { SessionRow } from './SessionRow'
import { useSessionsState } from '../store/sessionsStore'
import type { SessionListItem } from '../../../../../shared/ipc'
import { useI18n } from '../../../shared/i18n'
import { isPinnedSession, placementOf } from '../lib/sessionPlacement'

// 미물질화 draft nav 행(0064 r4 fork/handoff + 0065 활성 '새 대화'). chat feature 의
// DraftRow 와 구조적으로 호환 — cross-feature import 대신 셸(app/)이 매핑해 props 로
// 내린다(4-layer 경계). '새 대화' 행은 deletable=false(삭제 개념 없음 — kebab 숨김).
export interface DraftSessionRow {
  key: string
  title: string | null
  projectId: string | null
  deletable: boolean
}

interface SessionListProps {
  // ChatContext, ProjectsContext 는 cross-feature 이므로 app/AppLayout 가 wiring.
  currentSessionId: string | null
  projectNameById: Map<string, string>
  // 배치 우선순위 판정용 — 고정 프로젝트의 대화는 그 프로젝트 하위 목록이 가져간다.
  // 고정 여부는 projects feature 소관이라 app 셸이 내려 준다(cross-feature 는 props-only).
  pinnedProjectIds: ReadonlySet<string>
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

// Sidebar 의 '최근 대화' 슬롯에 주입되는 세션 목록. SessionsContext 는 자기 feature
// 이므로 직접 구독; 다른 도메인 (chat / projects) 결합은 props 로 받는다.
export function SessionList({
  currentSessionId,
  projectNameById,
  pinnedProjectIds,
  onSelect,
  onDelete,
  onRename,
  onTogglePin,
  drafts = [],
  activeDraftKey = null,
  onSelectDraft,
  onDeleteDraft
}: SessionListProps): React.JSX.Element {
  const { tr } = useI18n()
  const recentIds = useSessionsState((state) => state.recentIds)
  const byId = useSessionsState((state) => state.byId)
  // 셀렉터가 새 배열을 반환하면 useSyncExternalStore 캐시가 깨지므로 파생은 useMemo.
  // 배치 규칙은 lib/sessionPlacement 단일 정의 — 프로젝트 고정을 해제하면 그 대화가
  // 즉시 'recent' 로 판정돼 store 의 updatedAt 정렬 위치로 복귀한다.
  const recentSessions = useMemo(
    () =>
      recentIds.flatMap((id) => {
        const session = byId[id]
        if (!session || placementOf(session, pinnedProjectIds) !== 'recent') return []
        return [session]
      }),
    [recentIds, byId, pinnedProjectIds]
  )

  if (recentSessions.length === 0 && drafts.length === 0) {
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
      {recentSessions.map((s) => (
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
}

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
