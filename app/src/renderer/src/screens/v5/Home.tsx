import { useState, type ReactNode } from 'react'
import { Icon, Sparkle, type IconName } from '../../components/primitives/Icon'
import { Pill } from '../../components/primitives/Pill'

/** v5 Home screen (DESIGN.md §5 #01 + #03).
 *  Dot-grid canvas + serif italic headline + Composer placeholder + pill row + suggestions.
 *  The Composer here is a *static visual* — the real input flow will be wired
 *  in when the chat screen is migrated. Suggestions are placeholder rows.
 *  Pill `프로젝트에서 작업` toggles `FolderMenu` (DESIGN.md §5 #03 home-folder).
 *  Selecting `새 프로젝트 생성` triggers `onNewProject` which opens the modal. */
export interface HomeProps {
  onSuggestionPick?: (id: string) => void
  onComposerSubmit?: (text: string) => void
  onNewProject?: () => void
}

interface Suggestion {
  id: string
  icon: IconName
  label: string
}

const SUGGESTIONS: Suggestion[] = [
  { id: 'optimize-week', icon: 'coffee', label: '이번 주 최적화하기' },
  { id: 'organize-screenshots', icon: 'folder', label: '스크린샷 정리하기' },
  { id: 'find-insights', icon: 'insight', label: '파일에서 인사이트 찾기' }
]

export function Home({ onSuggestionPick, onNewProject }: HomeProps): React.JSX.Element {
  const [folderOpen, setFolderOpen] = useState(false)
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
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* Headline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
            <Sparkle size={32} />
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 34,
                letterSpacing: -0.5,
                color: 'var(--ink)',
                margin: 0,
                whiteSpace: 'nowrap',
                wordBreak: 'keep-all'
              }}
            >
              할 일을 처리해 볼까요?
            </h1>
          </div>
          <div style={{ marginLeft: 46, marginBottom: 32 }}>
            <a href="#" style={{ fontSize: 13.5 }}>
              Cowork를 안전하게 사용하는 방법 알아보기.
            </a>
          </div>

          {/* Composer (static visual placeholder for now) */}
          <ComposerPlaceholder />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Pill
                icon="package"
                label="프로젝트에서 작업"
                dropdown
                selected={folderOpen}
                onClick={() => setFolderOpen((v) => !v)}
              />
              {folderOpen && (
                <FolderMenu
                  onCreate={() => {
                    setFolderOpen(false)
                    onNewProject?.()
                  }}
                />
              )}
            </div>
            <Pill icon="hand" label="질문" dropdown />
            <span style={{ marginLeft: 'auto' }} />
            <Pill label="Sonnet 4.6" dropdown surface="ghost" />
          </div>

          {/* Suggestion list */}
          <div
            style={{
              marginTop: 60,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--ink-3)',
              fontSize: 12.5
            }}
          >
            <Icon name="shuffle" size={15} color="var(--ink-3)" />
            <span>작업을 골라보세요, 어떤 것이든</span>
          </div>

          <div style={{ marginTop: 6 }}>
            {SUGGESTIONS.map((s, i) => (
              <SuggestionRow
                key={s.id}
                icon={s.icon}
                label={s.label}
                isFirst={i === 0}
                onClick={() => onSuggestionPick?.(s.id)}
              />
            ))}
          </div>

          <div style={{ marginTop: 22, fontSize: 12.5, color: 'var(--ink-3)' }}>플러그인으로 맞춤 설정</div>
        </div>
      </div>
    </main>
  )
}

function ComposerPlaceholder(): React.JSX.Element {
  return (
    <div
      style={{
        background: 'var(--paper)',
        borderRadius: 'var(--r-xl)',
        boxShadow: '0 1px 0 rgba(0,0,0,.02), 0 1px 2px rgba(0,0,0,.04)',
        border: '1px solid var(--line)'
      }}
    >
      <div
        style={{
          padding: '18px 22px 0',
          color: 'var(--ink-4)',
          fontSize: 15,
          minHeight: 2 * 26 + 16,
          lineHeight: 1.5
        }}
      >
        오늘 어떤 도움을 드릴까요?
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
        <button className="cm-btn" type="button" aria-label="첨부">
          <Icon name="plus" size={18} color="var(--ink-3)" />
        </button>
        <span style={{ marginLeft: 'auto' }} />
        <button className="cm-btn" type="button" title="Voice" aria-label="음성">
          <Icon name="mic" size={17} color="var(--ink-3)" />
        </button>
      </div>
    </div>
  )
}

function FolderMenu({ onCreate }: { onCreate?: () => void }): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 'calc(100% + 6px)',
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-md)',
        width: 320,
        padding: 6,
        zIndex: 20
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          background: 'var(--press)',
          borderRadius: 8
        }}
      >
        <Icon name="folder" size={16} color="var(--ink-2)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>C:\Users\rlaeo\Downloads</div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            C:\Users\rlaeo\Downloads
          </div>
        </div>
        <Icon name="star" size={15} color="var(--ink-4)" />
      </div>
      <div style={{ height: 1, background: 'var(--line-soft)', margin: '4px 0' }} />
      <button
        onClick={onCreate}
        className="suggest-row"
        type="button"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '8px 10px',
          borderRadius: 8,
          color: 'var(--ink-2)',
          fontSize: 13,
          background: 'transparent',
          border: 0,
          textAlign: 'left',
          cursor: 'pointer'
        }}
      >
        <Icon name="plus" size={15} color="var(--ink-3)" />
        <span>새 프로젝트 생성</span>
      </button>
      <button
        className="suggest-row"
        type="button"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '8px 10px',
          borderRadius: 8,
          color: 'var(--ink-2)',
          fontSize: 13,
          background: 'transparent',
          border: 0,
          textAlign: 'left',
          cursor: 'pointer'
        }}
      >
        <Icon name="folderPlus" size={15} color="var(--ink-3)" />
        <span>다른 폴더 선택</span>
      </button>
    </div>
  )
}

function SuggestionRow({
  icon,
  label,
  isFirst,
  onClick
}: {
  icon: IconName
  label: ReactNode
  isFirst: boolean
  onClick?: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="suggest-row"
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        padding: '18px 6px',
        borderTop: isFirst ? '1px solid var(--line-soft)' : 'none',
        borderBottom: '1px solid var(--line-soft)',
        color: 'var(--ink-2)',
        fontSize: 14,
        textAlign: 'left'
      }}
    >
      <Icon name={icon} size={20} color="var(--ink-3)" />
      <span style={{ flex: 1 }}>{label}</span>
      <Icon name="chevronR" size={16} color="var(--ink-4)" style={{ opacity: 0 }} />
    </button>
  )
}
