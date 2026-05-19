import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { SkillInfo } from '../../../../shared/ipc'

interface SkillAutocompleteProps {
  open: boolean
  // 자동완성이 부착될 textarea wrapper (HighlightedTextarea 의 outer div).
  anchorRef: RefObject<HTMLElement | null>
  suggestions: SkillInfo[]
  activeIndex: number
  onHover: (index: number) => void
  onPick: (skill: SkillInfo) => void
}

// 인라인 자동완성 dropdown — anchor 의 좌상단 바로 위로 열린다 (composer 의 textarea
// 위쪽에 띄움). caret 좌표를 정확히 추적하지는 않고 textarea 의 좌상단을 기준으로
// 잡아도 충분하다 (composer textarea 는 보통 1~3 줄이며 dropdown 폭이 textarea 폭에
// 가까움). VSCode·Slack 의 토큰-시작-기준 정렬과 유사한 시각 효과.
export function SkillAutocomplete({
  open,
  anchorRef,
  suggestions,
  activeIndex,
  onHover,
  onPick
}: SkillAutocompleteProps): React.JSX.Element | null {
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

  return createPortal(
    <div
      ref={panelRef}
      role="listbox"
      aria-label="스킬 자동완성"
      className="fixed z-50 min-w-[280px] max-w-[420px] overflow-hidden rounded-lg border border-border bg-panel p-1 shadow-lg"
      style={{ left: pos.left, bottom: pos.bottom }}
    >
      <div className="max-h-[280px] overflow-y-auto">
        {suggestions.map((s, i) => {
          const active = i === activeIndex
          return (
            <button
              key={s.name}
              type="button"
              role="option"
              aria-selected={active}
              onMouseDown={(e) => {
                // textarea 의 blur 를 방지 — 클릭 후에도 caret 유지.
                e.preventDefault()
                onPick(s)
              }}
              onMouseEnter={() => onHover(i)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${
                active ? 'bg-sidebar text-ink' : 'text-ink hover:bg-sidebar'
              }`}
            >
              <span className="flex-1 font-mono text-[12.5px]">/{s.name}</span>
              {s.argumentHint && (
                <span className="font-mono text-[10.5px] text-ink3">{s.argumentHint}</span>
              )}
            </button>
          )
        })}
      </div>
      {suggestions[activeIndex]?.description && (
        <div className="mt-1 border-t border-border px-2 py-1.5 text-[11.5px] leading-relaxed text-ink2">
          {suggestions[activeIndex].description}
        </div>
      )}
    </div>,
    document.body
  )
}
