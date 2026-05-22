import { Icon } from '../../components/primitives/Icon'

/** v5 Projects empty-state screen (DESIGN.md §5 — 추가 화면, jsx 원본 없음).
 *  Visual basis: `project/uploads/main` (사용자 메시지 첨부 스크린샷).
 *  헤더 (Projects 제목 + sort/search/New project) + 중앙 빈 상태
 *  (4-square glyph + "Looking to start a project?" + outlined New project). */
export interface ProjectsProps {
  onNewProject?: () => void
}

export function Projects({ onNewProject }: ProjectsProps): React.JSX.Element {
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

          {/* Centered empty state */}
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
        </div>
      </div>
    </main>
  )
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
