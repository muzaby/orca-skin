import { useState } from 'react'
import { ToggleIndicator } from '../../../../shared/ui/Toggle'
import { useI18n } from '../../../../shared/i18n'
import { reportError } from '../../../../shared/errors'

export function CatalogToggle({
  name,
  enabled,
  canToggle,
  onToggle
}: {
  name: string
  enabled: boolean
  canToggle: boolean
  onToggle?: () => void | Promise<void>
}): React.JSX.Element {
  const { tr } = useI18n()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={tr('skills.detail.toggleAria', { name })}
      disabled={!canToggle || busy}
      className="inline-flex shrink-0 items-center rounded-r3 p-2 hide-focus-ring ring-focus disabled:cursor-default disabled:opacity-50"
      onClick={async () => {
        if (busy || !canToggle) return
        setBusy(true)
        try {
          await onToggle?.()
        } catch (error) {
          reportError({
            event: 'skills.catalog.toggle-failed',
            scope: 'native-resources',
            title: 'saveFailed',
            error
          })
        } finally {
          setBusy(false)
        }
      }}
    >
      <ToggleIndicator on={enabled} />
    </button>
  )
}
