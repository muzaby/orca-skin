import type { HistoryBodyRef } from '../../../../../../../shared/history-page'
import { useI18n } from '../../../../../shared/i18n'
import { ArcSpinner } from '../../../../../shared/ui/ArcSpinner'
import { chatActions, useHistoryBodyFailed } from '../../../store/chatStore'

export function DeferredBody({ body }: { body: HistoryBodyRef }): React.JSX.Element {
  const { tr } = useI18n()
  const failed = useHistoryBodyFailed(body)
  return (
    <div
      data-history-body={body.message}
      role="status"
      className="flex items-center gap-2 text-caption text-ink2"
    >
      {failed ? (
        <>
          <span>{tr('chat.transcript.historyBodyFailed')}</span>
          <button
            type="button"
            onClick={() => void chatActions.openHistoryBody(body)}
            className="rounded border border-border px-2 py-1"
          >
            {tr('chat.transcript.historyRetry')}
          </button>
        </>
      ) : (
        <span aria-label={tr('chat.transcript.historyBodyLoading')}>
          <ArcSpinner />
        </span>
      )}
    </div>
  )
}
