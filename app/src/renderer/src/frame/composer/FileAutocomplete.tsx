import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/atoms/Icon'
import type { FileEntry } from '../../../../shared/ipc'

interface FileAutocompleteProps {
  open: boolean
  // 현재 dirPath 의 listing 응답을 기다리는 중이면 true — 스피너 표시.
  loading: boolean
  anchorRef: RefObject<HTMLElement | null>
  // 현재 표시 중인 디렉토리 (cwd 기준 상대). 헤더에 노출.
  dirPath: string
  suggestions: FileEntry[]
  activeIndex: number
  onHover: (index: number) => void
  onPick: (entry: FileEntry) => void
}

// `@` 트리거 파일 경로 picker — SkillAutocomplete 와 동일한 anchor-기준 정렬.
// 한 단계씩 디렉토리 진입 방식이라 헤더에 현재 위치를 표시한다.
export function FileAutocomplete({
  open,
  loading,
  anchorRef,
  dirPath,
  suggestions,
  activeIndex,
  onHover,
  onPick
}: FileAutocompleteProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 6
    })
  }, [open, anchorRef, suggestions.length])

  if (!open || !pos) return null

  const headerLabel = dirPath === '' ? './' : `./${dirPath}/`

  return createPortal(
    <div
      ref={panelRef}
      role="listbox"
      aria-label="파일 경로 자동완성"
      className="app-frame-floating fixed z-50 min-w-[280px] max-w-[420px] overflow-hidden rounded-lg border border-border bg-panel p-1 shadow-lg"
      style={{ left: pos.left, bottom: pos.bottom }}
      data-context="floating"
      data-behavior="dismissible"
    >
      <div className="border-b border-border px-2 py-1 font-mono text-[10.5px] text-ink3">
        {headerLabel}
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-2 text-[12.5px] text-ink3">
            <span className="inline-flex animate-spin">
              <Icon name="refresh" size={12} />
            </span>
            <span>로딩 중…</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-2 py-2 text-[12.5px] text-ink3">일치하는 항목 없음</div>
        ) : (
          suggestions.map((e, i) => {
            const active = i === activeIndex
            return (
              <button
                key={e.name}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  onPick(e)
                }}
                onMouseEnter={() => onHover(i)}
                className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${
                  active ? 'bg-sidebar text-ink' : 'text-ink hover:bg-sidebar'
                }`}
              >
                <Icon name={e.isDirectory ? 'folder' : 'doc'} size={12} />
                <span className="flex-1 truncate font-mono text-[12.5px]">
                  {e.name}
                  {e.isDirectory ? '/' : ''}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body
  )
}
