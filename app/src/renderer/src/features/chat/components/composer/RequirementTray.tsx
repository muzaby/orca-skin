import type { DiffRequirementItem } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'

interface RequirementTrayProps {
  requirements: readonly DiffRequirementItem[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onRemove: (id: string) => void
}

function lineLabel(item: DiffRequirementItem): string {
  if (item.anchor.oldLine === null && item.anchor.newLine !== null) return `+${item.anchor.newLine}`
  if (item.anchor.newLine === null && item.anchor.oldLine !== null) return `-${item.anchor.oldLine}`
  return String(item.anchor.newLine ?? item.anchor.oldLine ?? '?')
}

export function RequirementTray({
  requirements,
  selectedId,
  onSelect,
  onRemove
}: RequirementTrayProps): React.JSX.Element | null {
  const { tr } = useI18n()
  if (requirements.length === 0) return null

  return (
    <section
      data-diff-requirement-tray="true"
      aria-label={tr('chat.composer.diffRequirementTrayAria')}
      className="mb-2 flex flex-wrap items-center gap-[6px] pt-[2px]"
    >
      {requirements.map((item) => {
        const label = `${item.anchor.filePath}:${lineLabel(item)}\n${item.anchor.comment}${
          item.located ? '' : `\n${tr('chat.composer.diffRequirementUnlocated')}`
        }`
        return (
          <span
            key={item.id}
            data-diff-requirement-chip={item.id}
            className={`group/requirement-tile relative flex size-[52px] shrink-0 rounded-[6px] border bg-t3 ${item.id === selectedId ? 'border-selected' : 'border-transparent'}`}
          >
            <button
              type="button"
              onClick={() => onSelect?.(item.id)}
              aria-pressed={item.id === selectedId}
              aria-label={label}
              title={label}
              className={`flex size-full items-center justify-center rounded-[5px] outline-none ${item.located ? 'text-ink3' : 'text-rust'}`}
            >
              <Icon name="quote" size={20} />
              {!item.located && (
                <span className="absolute bottom-[2px] right-[2px]" aria-hidden="true">
                  <Icon name="alert" size={12} />
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={tr('chat.composer.diffRequirementRemoveAria', {
                comment: item.anchor.comment
              })}
              className="absolute -right-[7px] -top-[7px] flex size-[20px] items-center justify-center rounded-full border border-t5 bg-panel text-ink3 opacity-0 outline-none group-focus-within/requirement-tile:opacity-100 group-hover/requirement-tile:opacity-100 hover:text-ink focus-visible:border-selected"
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        )
      })}
    </section>
  )
}
