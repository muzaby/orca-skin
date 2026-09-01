import type { DiffRequirementItem } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { composerPanelSurface } from './composerPanel'

interface RequirementTrayProps {
  requirements: readonly DiffRequirementItem[]
  onRemove: (id: string) => void
}

function lineLabel(item: DiffRequirementItem): string {
  if (item.anchor.oldLine === null && item.anchor.newLine !== null) return `+${item.anchor.newLine}`
  if (item.anchor.newLine === null && item.anchor.oldLine !== null) return `-${item.anchor.oldLine}`
  return String(item.anchor.newLine ?? item.anchor.oldLine ?? '?')
}

export function RequirementTray({
  requirements,
  onRemove
}: RequirementTrayProps): React.JSX.Element | null {
  const { tr } = useI18n()
  if (requirements.length === 0) return null

  return (
    <section
      data-diff-requirement-tray="true"
      aria-label={tr('chat.composer.diffRequirementTrayAria')}
      className={`flex flex-wrap items-center gap-g2 ${composerPanelSurface}`}
    >
      <span className="shrink-0 text-caption text-t5">
        {tr('chat.composer.diffRequirementTrayLabel', { count: requirements.length })}
      </span>
      {requirements.map((item) => (
        <span
          key={item.id}
          data-diff-requirement-chip={item.id}
          className={`inline-flex min-w-0 max-w-full items-center gap-g2 rounded-r3 border px-p3 py-1 text-caption ${
            item.located ? 'border-t5 bg-fill-contained' : 'border-rust bg-rust-soft text-rust'
          }`}
        >
          <span className="min-w-0 truncate font-mono">
            {item.anchor.filePath}:{lineLabel(item)}
          </span>
          <span className="min-w-0 truncate text-t7">{item.anchor.comment}</span>
          {!item.located && (
            <span className="shrink-0 text-rust">
              {tr('chat.composer.diffRequirementUnlocated')}
            </span>
          )}
          <Button
            iconOnly
            size="small"
            variant="uncontained"
            leadingIcon="x"
            onClick={() => onRemove(item.id)}
            aria-label={tr('chat.composer.diffRequirementRemoveAria', {
              comment: item.anchor.comment
            })}
            className="shrink-0"
          />
        </span>
      ))}
    </section>
  )
}
