import { Icon } from '../../components/primitives/Icon'
import type { Project } from '../../../../shared/ipc'

/** v5 Projects screen (DESIGN.md §5 — 추가 화면, jsx 원본 없음).
 *  Visual basis: `project/uploads/main*.jpg` (사용자 메시지 첨부 스크린샷들).
 *  헤더 (Projects 제목 + sort/search/New project) + 본문:
 *  - 비었으면 중앙 empty state (4-square glyph + "Looking to start a project?" + outlined New project)
 *  - 있으면 ProjectCard 목록 (제목 + 상대 시각, 클릭 시 onOpenProject) */
export interface ProjectsProps {
  projects?: Project[]
  onNewProject?: () => void
  onOpenProject?: (id: string) => void
}

export function Projects({ projects = [], onNewProject, onOpenProject }: ProjectsProps): React.JSX.Element {
  const isEmpty = projects.length === 0
  return (
    <main
      className="dot-grid"
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'var(--bg)'
      }}
    >
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '52px 40px 32px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 60 }}>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 32,
                letterSpacing: -0.5,
                color: 'var(--ink)',
                margin: 0
              }}
            >
              Projects
            </h1>
            <span style={{ marginLeft: 'auto' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" className="tb-icon-btn" aria-label="정렬">
                <Icon name="sortUpDown" size={16} color="var(--ink-3)" />
              </button>
              <button type="button" className="tb-icon-btn" aria-label="검색">
                <Icon name="search" size={16} color="var(--ink-3)" />
              </button>
              <button
                type="button"
                onClick={onNewProject}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  marginLeft: 4,
                  borderRadius: 999,
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  fontSize: 13,
                  fontWeight: 500,
                  border: 0,
                  cursor: 'pointer'
                }}
              >
                New project
              </button>
            </div>
          </div>

          {isEmpty ? (
            /* Centered empty state */
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                textAlign: 'center'
              }}
            >
              <ProjectsGlyph />
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 21,
                  color: 'var(--ink)'
                }}
              >
                Looking to start a project?
              </h2>
              <p
                style={{
                  margin: 0,
                  maxWidth: 360,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: 'var(--ink-3)'
                }}
              >
                Point Claude at a folder on your machine and work on it together.
              </p>
              <button
                type="button"
                onClick={onNewProject}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 18px',
                  marginTop: 6,
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                New project
              </button>
            </div>
          ) : (
            /* Card list — DB-backed via useProjects */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={() => onOpenProject?.(p.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen?: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="suggest-row"
      style={{
        display: 'block',
        textAlign: 'left',
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: '18px 22px',
        minHeight: 132,
        cursor: 'pointer'
      }}
    >
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{project.name}</h3>
      <div style={{ marginTop: 'auto', paddingTop: 38, fontSize: 12.5, color: 'var(--ink-3)' }}>
        {formatRelative(project.updatedAt || project.createdAt)}
      </div>
    </button>
  )
}

function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts
  const sec = Math.max(0, Math.floor(diffMs / 1000))
  if (sec < 60) return '방금 전'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  return `${day}일 전`
}

function ProjectsGlyph(): React.JSX.Element {
  return (
    <svg width="92" height="84" viewBox="0 0 92 84" fill="none" aria-hidden>
      {/* 4 small rounded squares grid, 1 filled darker */}
      <rect x="8" y="6" width="22" height="22" rx="3" fill="none" stroke="#9d9686" strokeWidth="1.6" />
      <rect x="34" y="6" width="22" height="22" rx="3" fill="none" stroke="#9d9686" strokeWidth="1.6" />
      <rect x="8" y="32" width="22" height="22" rx="3" fill="none" stroke="#9d9686" strokeWidth="1.6" />
      <rect x="34" y="32" width="22" height="22" rx="3" fill="#b8b1a0" stroke="#9d9686" strokeWidth="1.6" />
      {/* Pointing finger / hand glyph at bottom-right */}
      <path
        d="M58 36 L58 50 Q58 53 61 53 L72 53 Q76 53 76 49 L76 38 Q76 35 73 35 L67 35 L67 30 Q67 27 64 27 Q61 27 61 30 L61 36 Z"
        fill="#dcd6c7"
        stroke="#9d9686"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M64 35 L64 28" stroke="#9d9686" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
