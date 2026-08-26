import { memo, useMemo, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { KebabButton } from '../../../shared/ui/KebabButton'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { useI18n } from '../../../shared/i18n'
import type { Project } from '../../../../../shared/ipc'
import { SessionRow } from './SessionRow'
import { useSessionsState } from '../store/sessionsStore'
import { useProjectSessions } from '../hooks/useProjectSessions'

// Claude Code 사이드바 "Recents" 헤더와 동형(Sidebar.tsx SECTION_HEAD). app/ 레이어의
// 상수를 import 하면 4-layer 경계를 거스르므로 클래스 문자열만 복제한다.
const SECTION_HEAD =
  'flex w-full items-center gap-1 border-0 bg-transparent px-3 pb-1 pt-4 text-left text-caption font-medium text-ink3 hover:text-t7'

export interface PinnedSectionProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
  // 고정 대화 행의 kebab 에도 최근 대화와 동일한 이름변경/삭제를 노출한다.
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

// 좌측 nav "고정됨" 섹션 — 소속과 무관하게 고정된 대화만 한곳에 나열한다.
// 같은 대화는 최근 대화 및 프로젝트 하위 목록에서 제외되어 nav 안에 한 번만 나타난다.
export const PinnedSection = memo(function PinnedSection({
  currentSessionId,
  onSelectSession,
  onTogglePinSession,
  onDeleteSession,
  onRenameSession
}: PinnedSectionProps): React.JSX.Element {
  const { tr } = useI18n()
  const [expanded, setExpanded] = useState(true)
  const list = useSessionsState((s) => s.list)
  // 셀렉터가 새 배열을 반환하면 useSyncExternalStore 캐시가 깨지므로 raw list 를 구독하고
  // 파생은 useMemo — 고정 세션만, 고정 시각 내림차순(최근 고정이 위).
  const pinnedSessions = useMemo(
    () =>
      list.filter((s) => s.pinnedAt != null).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)),
    [list]
  )

  return (
    <div className="app-frame-sidebar-pinned" data-context="pinned">
      <button
        type="button"
        className={SECTION_HEAD}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span>{tr('sidebar.pinned')}</span>
        <Icon name={expanded ? 'chevD' : 'chevR'} size={12} />
      </button>
      {expanded && (
        <div className="px-1.5">
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
        </div>
      )}
    </div>
  )
})

export interface PinnedProjectsSectionProps {
  pinnedProjects: Project[]
  currentSessionId: string | null
  onOpenProject: (projectId: string) => void
  onTogglePinProject: (projectId: string, pinned: boolean) => void
  onSelectSession: (sessionId: string) => void
}

// 고정 프로젝트는 대화 고정과 구분된 전용 섹션에만 둔다. 별도 추가 버튼은 두지 않는다.
export const PinnedProjectsSection = memo(function PinnedProjectsSection({
  pinnedProjects,
  currentSessionId,
  onOpenProject,
  onTogglePinProject,
  onSelectSession
}: PinnedProjectsSectionProps): React.JSX.Element {
  const { tr } = useI18n()
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="app-frame-sidebar-projects" data-context="projects">
      <button
        type="button"
        className={SECTION_HEAD}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span>{tr('sidebar.pinnedProjects')}</span>
        <Icon name={expanded ? 'chevD' : 'chevR'} size={12} />
      </button>
      {expanded && (
        <div className="px-1.5">
          {pinnedProjects.map((project) => (
            <PinnedProjectRow
              key={project.id}
              project={project}
              currentSessionId={currentSessionId}
              onOpenProject={onOpenProject}
              onTogglePinProject={onTogglePinProject}
              onSelectSession={onSelectSession}
            />
          ))}
        </div>
      )}
    </div>
  )
})

interface PinnedProjectRowProps {
  project: Project
  currentSessionId: string | null
  onOpenProject: (projectId: string) => void
  onTogglePinProject: (projectId: string, pinned: boolean) => void
  onSelectSession: (sessionId: string) => void
}

// 고정 프로젝트 행 — chevron 으로 하위 대화 접기/펼치기, 이름 클릭으로 프로젝트 열기,
// hover kebab 으로 고정 해제. 하위 목록은 펼쳤을 때만 마운트해 조회를 지연한다.
function PinnedProjectRow({
  project,
  currentSessionId,
  onOpenProject,
  onTogglePinProject,
  onSelectSession
}: PinnedProjectRowProps): React.JSX.Element {
  const { tr } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const kebabRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <div
        onClick={() => onOpenProject(project.id)}
        className="app-frame-pinned-project group/pinproj relative flex cursor-pointer items-center gap-1 rounded-md px-1 py-[5px] text-[12.5px] text-t7 transition-colors hover:bg-fill-uncontained-hover"
        data-context="project"
        title={project.name}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className="grid h-5 w-5 shrink-0 place-items-center rounded border-0 bg-transparent text-t7 hover:text-ink"
          aria-label={tr(expanded ? 'common.collapse' : 'common.expand')}
          aria-expanded={expanded}
        >
          <Icon name={expanded ? 'chevD' : 'chevR'} size={14} />
        </button>
        <Icon name="folder" size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {project.name}
        </span>
        <KebabButton
          ref={kebabRef}
          open={menuOpen}
          onToggle={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          revealClass="group-hover/pinproj:grid"
          ariaLabel={tr('common.more')}
        />
        <Popover open={menuOpen} anchorRef={kebabRef} onClose={() => setMenuOpen(false)}>
          <div role="menu" className="flex w-[140px] flex-col py-1">
            <MenuItem
              role="menuitem"
              icon="pin"
              iconSize={12}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onTogglePinProject(project.id, false)
              }}
            >
              <span>{tr('common.unpin')}</span>
            </MenuItem>
          </div>
        </Popover>
      </div>
      {expanded && (
        <div className="pl-4">
          <PinnedProjectChildren
            projectId={project.id}
            currentSessionId={currentSessionId}
            onSelectSession={onSelectSession}
          />
        </div>
      )}
    </>
  )
}

interface PinnedProjectChildrenProps {
  projectId: string
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
}

// 고정 프로젝트의 하위 대화. 전역 세션 목록의 최신 pin 상태를 우선 적용하므로 대화는
// pin 토글과 동시에 더 높은 우선순위인 "고정됨"으로 이동하거나 여기로 돌아온다.
function PinnedProjectChildren({
  projectId,
  currentSessionId,
  onSelectSession
}: PinnedProjectChildrenProps): React.JSX.Element {
  const { tr } = useI18n()
  const globalSessions = useSessionsState((state) => state.list)
  const { list, loading } = useProjectSessions(projectId)
  const currentPinById = new Map(globalSessions.map((session) => [session.id, session.pinnedAt]))
  const visibleSessions = list.filter(
    (session) =>
      (currentPinById.has(session.id) ? currentPinById.get(session.id) : session.pinnedAt) == null
  )

  if (loading) {
    return <div className="px-2 py-1 text-[11.5px] text-ink3">{tr('common.loading')}</div>
  }
  if (visibleSessions.length === 0) {
    return <div className="px-2 py-1 text-[11.5px] text-ink3">{tr('sessions.empty')}</div>
  }
  return (
    <>
      {visibleSessions.map((s) => (
        <SessionRow
          key={s.id}
          session={s}
          isActive={s.id === currentSessionId}
          onSelect={onSelectSession}
          renameable={false}
          leadingIcon="chat"
        />
      ))}
    </>
  )
}
