import type { RefObject } from 'react'
import { AnchoredDropdown } from './AnchoredDropdown'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import type { MentionGroup, MentionSuggestion } from '../../lib/mentionAutocomplete'

interface MentionAutocompleteProps {
  open: boolean
  loading: boolean
  anchorRef: RefObject<HTMLElement | null>
  dirPath: string
  groups: MentionGroup[]
  suggestions: MentionSuggestion[]
  activeIndex: number
  onHover: (index: number) => void
  onPick: (suggestion: MentionSuggestion) => void
}

export function MentionAutocomplete({
  open,
  loading,
  anchorRef,
  dirPath,
  groups,
  suggestions,
  activeIndex,
  onHover,
  onPick
}: MentionAutocompleteProps): React.JSX.Element | null {
  const { tr } = useI18n()
  const headerLabel = dirPath === '' ? './' : `./${dirPath}/`
  return (
    <AnchoredDropdown
      open={open}
      anchorRef={anchorRef}
      itemCount={suggestions.length}
      ariaLabel={tr('chat.composer.mentionAutocompleteAria')}
    >
      <div className="max-h-[280px] overflow-y-auto">
        {groups.map((group, groupIndex) => {
          const start = groups
            .slice(0, groupIndex)
            .reduce((total, previous) => total + previous.suggestions.length, 0)
          return (
            <div key={group.kind}>
              <div className="border-b border-border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink3">
                {group.kind === 'plugin' ? tr('chat.composer.mentionPlugins') : headerLabel}
              </div>
              {group.suggestions.map((suggestion, index) => {
                const flatIndex = start + index
                const selected = flatIndex === activeIndex
                const isPlugin = suggestion.kind === 'plugin'
                return (
                  <button
                    key={isPlugin ? suggestion.id : suggestion.path}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      onPick(suggestion)
                    }}
                    onMouseEnter={() => onHover(flatIndex)}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${selected ? 'bg-sidebar text-ink' : 'text-ink hover:bg-sidebar'}`}
                  >
                    <Icon
                      name={
                        isPlugin
                          ? 'electricalServices'
                          : suggestion.entry.isDirectory
                            ? 'folder'
                            : 'doc'
                      }
                      size={12}
                    />
                    <span className="flex-1 truncate font-mono text-[12.5px]">
                      {isPlugin
                        ? `@${suggestion.id}`
                        : `${suggestion.entry.name}${suggestion.entry.isDirectory ? '/' : ''}`}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
        {loading && (
          <div className="flex items-center gap-2 px-2 py-2 text-[12.5px] text-ink3">
            <span className="inline-flex animate-spin">
              <Icon name="refresh" size={12} />
            </span>
            <span>{tr('chat.composer.loadingShort')}</span>
          </div>
        )}
        {!loading && groups.length === 0 && (
          <div className="px-2 py-2 text-[12.5px] text-ink3">{tr('chat.composer.noMatches')}</div>
        )}
      </div>
    </AnchoredDropdown>
  )
}
