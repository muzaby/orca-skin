import { useState } from 'react'
import type { HistoryBodyRef } from '../../../../../../../shared/history-page'
import { useI18n } from '../../../../../shared/i18n'
import { chatActions } from '../../../store/chatStore'

export function DeferredBody({ body }: { body: HistoryBodyRef }): React.JSX.Element {
  const { tr } = useI18n()
  const [state, setState] = useState<'ready' | 'loading' | 'error'>('ready')
  return (
    <button
      type="button"
      data-history-body={body.message}
      disabled={state === 'loading'}
      onClick={() => {
        setState('loading')
        void chatActions.openHistoryBody(body).then((ok) => setState(ok ? 'ready' : 'error'))
      }}
      className="rounded border border-border px-2 py-1 text-caption text-ink2"
    >
      {tr(
        state === 'loading'
          ? 'chat.transcript.historyBodyLoading'
          : state === 'error'
            ? 'chat.transcript.historyRetry'
            : 'chat.transcript.historyBody'
      )}
    </button>
  )
}
