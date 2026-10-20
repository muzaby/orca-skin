import { ClaudeLogo } from '../../../../shared/ui/ClaudeLogo'
import { OpenCodeLogo } from '../../../../shared/ui/OpenCodeLogo'
import { OrcaLogo } from '../../../../shared/ui/OrcaLogo'
import { Icon } from '../../../../shared/ui/Icon'

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
        <ClaudeLogo className={`${className} text-spinner`} />
      ) : source.includes('opencode') ? (
        <OpenCodeLogo className={`${className} text-oc-ink`} />
      ) : source === 'orca' ? (
        <OrcaLogo className={className} />
      ) : (
        <Icon name="folder" size={16} />
      )}
      {label}
    </li>
  )
}
