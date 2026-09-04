import type { DiffRequirementAnchor } from '../../../../../../shared/ipc'
import { Icon } from '../../../../shared/ui/Icon'

export function UserDiffRequirements({
  requirements
}: {
  requirements: readonly DiffRequirementAnchor[]
}): React.JSX.Element {
  return (
    <>
      {requirements.map((anchor, index) => {
        const line =
          anchor.oldLine === null && anchor.newLine !== null
            ? `+${anchor.newLine}`
            : anchor.newLine === null && anchor.oldLine !== null
              ? `-${anchor.oldLine}`
              : String(anchor.newLine ?? anchor.oldLine ?? '?')
        const label = `${anchor.filePath}:${line}\n${anchor.comment}`
        return (
          <span
            key={index}
            data-sent-diff-requirement={index}
            role="img"
            tabIndex={0}
            aria-label={label}
            title={label}
            className="flex size-[52px] shrink-0 items-center justify-center rounded-[6px] border border-transparent bg-t3 text-ink3 outline-none focus-visible:border-selected"
          >
            <Icon name="quote" size={20} />
          </span>
        )
      })}
    </>
  )
}
