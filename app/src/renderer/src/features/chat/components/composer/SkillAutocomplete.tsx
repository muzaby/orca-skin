import type { RefObject } from 'react'
import { AnchoredDropdown } from './AnchoredDropdown'
import type { SkillInfo } from '../../../../../../shared/ipc'

interface SkillAutocompleteProps {
  open: boolean
  // 자동완성이 부착될 textarea wrapper (HighlightedTextarea 의 outer div).
  anchorRef: RefObject<HTMLElement | null>
  suggestions: SkillInfo[]
  activeIndex: number
  onHover: (index: number) => void
  onPick: (skill: SkillInfo) => void
}

// 인라인 스킬 자동완성 — 포지셔닝/portal 셸은 AnchoredDropdown 공유.
export function SkillAutocomplete({
  open,
  anchorRef,
  suggestions,
  activeIndex,
  onHover,
  onPick
}: SkillAutocompleteProps): React.JSX.Element | null {
  return (
    <AnchoredDropdown
      open={open}
      anchorRef={anchorRef}
      itemCount={suggestions.length}
      ariaLabel="스킬 자동완성"
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
              className={`flex w-full cursor-pointer flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left ${
                active ? 'bg-sidebar text-ink' : 'text-ink hover:bg-sidebar'
              }`}
            >
              <span className="flex w-full items-center gap-2">
                <span className="flex-1 truncate font-mono text-[12.5px]">/{s.name}</span>
                {s.argumentHint && (
                  <span className="font-mono text-[10.5px] text-ink3">{s.argumentHint}</span>
                )}
              </span>
              {s.description && (
                <span className="line-clamp-2 w-full text-[11px] leading-snug text-ink3">
                  {s.description}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </AnchoredDropdown>
  )
}
