import { HarnessLogo } from '../../../../shared/ui/HarnessLogo'
import { Icon } from '../../../../shared/ui/Icon'
import { OoLogo } from '../../../../shared/ui/OoLogo'

export function SourceHeading({
  source,
  label,
  spaced = false
}: {
  source: string
  label: string
  spaced?: boolean
}): React.JSX.Element {
  const className = 'size-4 shrink-0'
  return (
    <li
      className={`flex items-center gap-2 px-3 pb-2 text-caption font-medium text-ink3 ${spaced ? 'pt-8' : 'pt-5'}`}
    >
      {source.includes('claude') ? (
        <HarnessLogo backend="claude" className={className} />
      ) : source.includes('opencode') ? (
        <HarnessLogo backend="opencode" className={className} />
      ) : source === 'orcinus-orca' ? (
        <OoLogo className="h-4 w-auto shrink-0" />
      ) : (
        <Icon name="folder" size={16} />
      )}
      {label}
    </li>
  )
}
