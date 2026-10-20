import type { RefObject } from 'react'
import { AnchoredDropdown } from './AnchoredDropdown'
import { AutocompleteSectionHeader } from './AutocompleteSectionHeader'
import type { SkillSuggestion } from '../../../lib/composerSkills'
import { useI18n } from '../../../../../shared/i18n'
import { groupSkillSuggestions } from '../../../lib/skillGroups'

interface SkillAutocompleteProps {
  open: boolean
  // 자동완성이 부착될 textarea wrapper (ComposerInputSurface 의 outer div).
  anchorRef: RefObject<HTMLElement | null>
  suggestions: SkillSuggestion[]
  activeIndex: number
  onHover: (index: number) => void
  onPick: (skill: SkillSuggestion) => void
}

// 인라인 스킬 자동완성 — 포지셔닝/portal 셸은 AnchoredDropdown 공유.
// 0259 D-004 — 후보를 출처 라벨 섹션으로 묶는다. 순서는 바꾸지 않아 화면 순서 = 키보드 인덱스.
export function SkillAutocomplete({
  open,
  anchorRef,
  suggestions,
  activeIndex,
  onHover,
  onPick
}: SkillAutocompleteProps): React.JSX.Element | null {
  const { tr } = useI18n()
  return (
    <AnchoredDropdown
      open={open}
      anchorRef={anchorRef}
      itemCount={suggestions.length}
      ariaLabel={tr('chat.composer.skillAutocompleteAria')}
    >
      <div className="max-h-[280px] overflow-y-auto">
        {groupSkillSuggestions(suggestions).map((section) => (
          <div key={section.key}>
            <AutocompleteSectionHeader label={section.label} />
            {section.items.map(({ skill: s, index: i }) => {
              const active = i === activeIndex
              return (
                <button
                  key={`${s.sourceId}/${s.name}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-index={i}
                  title={s.description || undefined}
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
        ))}
      </div>
    </AnchoredDropdown>
  )
}
