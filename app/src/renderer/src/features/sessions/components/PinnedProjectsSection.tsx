import { memo, useEffect, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { KebabButton } from '../../../shared/ui/KebabButton'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { CollapsibleSection } from '../../../shared/ui/SidebarSection'
import { useI18n } from '../../../shared/i18n'
import type { Project } from '../../../../../shared/ipc'
import { SessionRow } from './SessionRow'
import { useNavSections } from '../hooks/useNavSections'
import type { ProjectChildSessions } from '../lib/navSections'
import { sessionsActions } from '../store/sessionsStore'

export interface PinnedProjectsSectionViewProps {
  // app 셸이 projectsStore 에서 걸러 주입(cross-feature 는 props-only).
  pinnedProjects: Project[]
  // 0203 ΔV1 EP-9 — 프로젝트별 하위 대화. 키가 없으면 미조회(로딩)다.
  // ΔV2 EP-11 — 슬롯 브랜드. 파티션의 다른 칸을 넘기면 컴파일되지 않는다.
  projectChildren: Record<string, ProjectChildSessions>
  // 펼칠 때 그 프로젝트의 membership 조회를 트리거한다(조회는 펼친 것만).
  onExpandProject: (projectId: string) => void
  currentSessionId: string | null
  onOpenProject: (projectId: string) => void
  onTogglePinProject: (projectId: string, pinned: boolean) => void
  onSelectSession: (sessionId: string) => void
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

// 좌측 nav "프로젝트" 구획 — 고정 프로젝트는 대화 고정과 구분된 전용 구획에만 둔다.
// 별도 추가 버튼은 두지 않는다(D-003).
export const PinnedProjectsSectionView = memo(function PinnedProjectsSectionView({
  pinnedProjects,
  projectChildren,
  onExpandProject,
  ...row
}: PinnedProjectsSectionViewProps): React.JSX.Element {
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
          sessions={projectChildren[project.id]}
          onExpandProject={onExpandProject}
          {...row}
        />
      ))}
    </CollapsibleSection>
  )
})

interface PinnedProjectRowProps extends Omit<
  PinnedProjectsSectionViewProps,
  'pinnedProjects' | 'projectChildren'
> {
  project: Project
  // 이 프로젝트의 하위 대화. `undefined` = 아직 조회하지 않음.
  sessions: ProjectChildSessions | undefined
}

// 고정 프로젝트 행 — chevron 으로 하위 대화 접기/펼치기, 이름 클릭으로 프로젝트 열기,
// hover kebab 으로 고정 해제. 하위 목록은 펼쳤을 때만 조회한다.
function PinnedProjectRow({
  project,
  sessions,
  onExpandProject,
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

  useEffect(() => {
    if (expanded) onExpandProject(project.id)
  }, [expanded, project.id, onExpandProject])

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
            sessions={sessions}
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

export interface PinnedProjectChildrenProps {
  // `undefined` = 미조회 → 로딩. `[]` = 조회했고 보여 줄 대화가 없음.
  // ΔV2 EP-11 — 슬롯 브랜드.
  sessions: ProjectChildSessions | undefined
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

// 하위 대화 목록. 고정된 대화가 여기서 빠지는 판정은 파티션이 이미 했다 — 이 컴포넌트는
// 받은 목록을 그린다. 행 액션은 최근 대화와 동일하다(D-009).
//
// export 하는 이유(0203 D7): 이 목록은 행의 `expanded` 상태 뒤에 있어 구획 단위 SSR 렌더로는
// **아무것도 그려지지 않는다** — 그 출력에 대한 음성 단언은 무엇을 넣어도 참이 된다.
export function PinnedProjectChildren({
  sessions,
  currentSessionId,
  onSelectSession,
  onTogglePinSession,
  onDeleteSession,
  onRenameSession
}: PinnedProjectChildrenProps): React.JSX.Element {
  const { tr } = useI18n()

  if (sessions == null) {
    return <div className="px-2 py-1 text-[11.5px] text-ink3">{tr('common.loading')}</div>
  }
  if (sessions.length === 0) {
    return <div className="px-2 py-1 text-[11.5px] text-ink3">{tr('sessions.empty')}</div>
  }
  return (
    <>
      {sessions.map((s) => (
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

export interface PinnedProjectsSectionProps extends Omit<
  PinnedProjectsSectionViewProps,
  'projectChildren' | 'onExpandProject'
> {
  pinnedProjectIds: ReadonlySet<string>
}

// store 어댑터 — 파티션 결과의 프로젝트 칸을 넘기고, 펼침은 membership 조회로 잇는다.
export const PinnedProjectsSection = memo(function PinnedProjectsSection({
  pinnedProjectIds,
  ...view
}: PinnedProjectsSectionProps): React.JSX.Element {
  const { projectChildren } = useNavSections(pinnedProjectIds)
  return (
    <PinnedProjectsSectionView
      projectChildren={projectChildren}
      onExpandProject={loadProjectSessions}
      {...view}
    />
  )
})

// 모듈 상수라 identity 가 안정적이다 — 행의 effect deps 를 매 렌더 흔들지 않는다.
function loadProjectSessions(projectId: string): void {
  void sessionsActions.loadProject(projectId).catch(() => undefined)
}
