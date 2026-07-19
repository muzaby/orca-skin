import { memo, useMemo, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { useI18n } from '../../../shared/i18n'
import type { Project } from '../../../../../shared/ipc'
import { SessionRow } from './SessionRow'
import { useSessionsState } from '../store/sessionsStore'
import { useProjectSessions } from '../hooks/useProjectSessions'

// Claude Code 사이드바 "Recents" 헤더와 동형(Sidebar.tsx SECTION_HEAD). app/ 레이어의
// 상수를 import 하면 4-layer 경계를 거스르므로 클래스 문자열만 복제한다.
const SECTION_HEAD = 'px-3 pb-1 pt-4 text-caption font-medium text-ink3'

export interface PinnedSectionProps {
  // app 셸이 projectsStore 에서 고정 프로젝트를 걸러 주입(cross-feature 는 props-only).
  pinnedProjects: Project[]
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
  onOpenProject: (projectId: string) => void
  onTogglePinProject: (projectId: string, pinned: boolean) => void
}

// 좌측 nav "고정됨" 섹션 — 고정 프로젝트(접기/펼치기 + 하위 대화)와 고정 대화를 나열한다.
// 고정 세션은 자기 feature 인 sessionsStore 에서 직접 선택; 프로젝트는 app 이 주입한다.
// 고정 항목이 하나도 없으면 섹션 헤더까지 통째로 숨긴다(null 반환).
export const PinnedSection = memo(function PinnedSection({
  pinnedProjects,
  currentSessionId,
  onSelectSession,
  onTogglePinSession,
  onOpenProject,
  onTogglePinProject
}: PinnedSectionProps): React.JSX.Element | null {
  const { tr } = useI18n()
  const list = useSessionsState((s) => s.list)
  // 셀렉터가 새 배열을 반환하면 useSyncExternalStore 캐시가 깨지므로 raw list 를 구독하고
  // 파생은 useMemo — 고정 세션만, 고정 시각 내림차순(최근 고정이 위).
  const pinnedSessions = useMemo(
    () =>
      list.filter((s) => s.pinnedAt != null).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)),
    [list]
  )

  if (pinnedProjects.length === 0 && pinnedSessions.length === 0) return null

  return (
    <div className="app-frame-sidebar-pinned" data-context="pinned">
      <div className={SECTION_HEAD}>{tr('sidebar.pinned')}</div>
      <div className="px-1.5">
        {pinnedProjects.map((p) => (
          <PinnedProjectRow
            key={p.id}
            project={p}
            currentSessionId={currentSessionId}
            onOpenProject={onOpenProject}
            onTogglePinProject={onTogglePinProject}
            onSelectSession={onSelectSession}
          />
        ))}
        {pinnedSessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            isActive={s.id === currentSessionId}
            onSelect={onSelectSession}
            onTogglePin={onTogglePinSession}
            pinned
            renameable={false}
            leadingIcon="chat"
          />
        ))}
      </div>
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
          className="grid h-5 w-5 shrink-0 place-items-center rounded border-0 bg-transparent text-t5 hover:text-ink"
          aria-label={tr(expanded ? 'common.collapse' : 'common.expand')}
          aria-expanded={expanded}
        >
          <Icon name={expanded ? 'chevD' : 'chevR'} size={14} />
        </button>
        <Icon name="folder" size={14} className="shrink-0 text-t5" />
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {project.name}
        </span>
        <button
          ref={kebabRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          className={`h-5 w-5 cursor-pointer place-items-center rounded border-0 bg-transparent text-ink3 hover:text-ink ${
            menuOpen ? 'grid' : 'hidden group-hover/pinproj:grid'
          }`}
          title={tr('common.more')}
          aria-label={tr('common.more')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Icon name="kebab" size={14} />
        </button>
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

// 고정 프로젝트의 하위 대화 — 펼쳤을 때만 마운트되어 useProjectSessions 로 조회한다.
// 하위 행은 선택 전용(고정/이름변경/삭제 없음 — 프로젝트 컨텍스트가 이미 명확).
function PinnedProjectChildren({
  projectId,
  currentSessionId,
  onSelectSession
}: PinnedProjectChildrenProps): React.JSX.Element {
  const { tr } = useI18n()
  const { list, loading } = useProjectSessions(projectId)

  if (loading) {
    return <div className="px-2 py-1 text-[11.5px] text-ink3">{tr('common.loading')}</div>
  }
  if (list.length === 0) {
    return <div className="px-2 py-1 text-[11.5px] text-ink3">{tr('sessions.empty')}</div>
  }
  return (
    <>
      {list.map((s) => (
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
