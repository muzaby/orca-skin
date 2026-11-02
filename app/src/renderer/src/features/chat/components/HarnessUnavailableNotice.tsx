import { useState } from 'react'
import type { Backend, HarnessAvailability } from '../../../../../shared/ipc'
import { harnessApi } from '../../../shared/api/ipc'
import { useI18n } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { ReadingColumn } from '../../../shared/ui/ReadingColumn'
import { reportError } from '../../../shared/errors'

export function HarnessUnavailableNotice({
  backend,
  availability
}: {
  backend: Backend
  availability: HarnessAvailability
}): React.JSX.Element {
  const { tr } = useI18n()
  const [busy, setBusy] = useState(false)
  return (
    <ReadingColumn className="py-4">
      <div role="status" className="flex flex-wrap items-center gap-3 text-body text-ink2">
        <span>{tr(`harnessUnavailable.${availability.unavailableReason ?? 'failed'}`)}</span>
        <Button
          variant="contained"
          size="small"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await harnessApi.recheck(backend)
            } catch (error) {
              reportError({
                event: 'harness.recheck.failed',
                scope: 'chat',
                title: 'loadFailed',
                error
              })
            } finally {
              setBusy(false)
            }
          }}
        >
          {tr('harnessUnavailable.recheck')}
        </Button>
      </div>
    </ReadingColumn>
  )
}
