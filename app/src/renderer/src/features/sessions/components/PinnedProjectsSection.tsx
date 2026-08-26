import { memo, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { KebabButton } from '../../../shared/ui/KebabButton'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { CollapsibleSection } from '../../../shared/ui/SidebarSection'
import { useI18n } from '../../../shared/i18n'
import type { Project } from '../../../../../shared/ipc'
import { SessionRow } from './SessionRow'
import { useProjectSessions } from '../hooks/useProjectSessions'
import { isPinnedSession } from '../lib/sessionPlacement'

export interface PinnedProjectsSectionProps {
  // app 셸이 projectsStore 에서 고정 프로젝트를 걸러 주입(cross-feature 는 props-only).
  pinnedProjects: Project[]
  currentSessionId: string | null
  onOpenProject: (projectId: string) => void
  onTogglePinProject: (projectId: string, pinned: boolean) => void
  onSelectSession: (sessionId: string) => void
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

// 좌측 nav "프로젝트" 섹션 — 고정 프로젝트는 대화 고정과 구분된 전용 섹션에만 둔다.
// 별도 추가 버튼은 두지 않는다.
export const PinnedProjectsSection = memo(function PinnedProjectsSection({
  pinnedProjects,
  currentSessionId,
  onOpenProject,
  onTogglePinProject,
  onSelectSession,
  onTogglePinSession,
  onDeleteSession,
  onRenameSession
}: PinnedProjectsSectionProps): React.JSX.Element {
  const { tr } = useI18n()

  return (
    <CollapsibleSection
      label={tr('sidebar.pinnedProjects')}
      className="app-frame-sidebar-projects"
      dataContext="projects"
    >
      {pinnedProjects.map((project) => (
        <PinnedProjectRow
          key={project.id}
          project={project}
          currentSessionId={currentSessionId}
          onOpenProject={onOpenProject}
          onTogglePinProject={onTogglePinProject}
          onSelectSession={onSelectSession}
          onTogglePinSession={onTogglePinSession}
          onDeleteSession={onDeleteSession}
          onRenameSession={onRenameSession}
        />
      ))}
    </CollapsibleSection>
  )
})

interface PinnedProjectRowProps {
  project: Project
  currentSessionId: string | null
  onOpenProject: (projectId: string) => void
  onTogglePinProject: (projectId: string, pinned: boolean) => void
  onSelectSession: (sessionId: string) => void
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

// 고정 프로젝트 행 — chevron 으로 하위 대화 접기/펼치기, 이름 클릭으로 프로젝트 열기,
// hover kebab 으로 고정 해제. 하위 목록은 펼쳤을 때만 마운트해 조회를 지연한다.
function PinnedProjectRow({
  project,
  currentSessionId,
  onOpenProject,
  onTogglePinProject,
  onSelectSession,
  onTogglePinSession,
  onDeleteSession,
  onRenameSession
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
            onTogglePinSession={onTogglePinSession}
            onDeleteSession={onDeleteSession}
            onRenameSession={onRenameSession}
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
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

// 고정 프로젝트의 하위 대화도 공용 sessionsStore 엔티티를 사용한다. 따라서 pin 토글과
// 동시에 더 높은 우선순위인 "고정됨"으로 이동하거나 여기로 돌아온다 — 이 목록은 항상
// 고정 프로젝트 아래 있으므로 배치 판정이 isPinnedSession 하나로 좁혀진다.
function PinnedProjectChildren({
  projectId,
  currentSessionId,
  onSelectSession,
  onTogglePinSession,
  onDeleteSession,
  onRenameSession
}: PinnedProjectChildrenProps): React.JSX.Element {
  const { tr } = useI18n()
  const { list, loading } = useProjectSessions(projectId)
  const visibleSessions = list.filter((session) => !isPinnedSession(session))

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
          onTogglePin={onTogglePinSession}
          onDelete={onDeleteSession}
          onRename={onRenameSession}
          leadingIcon="chat"
        />
      ))}
    </>
  )
}
