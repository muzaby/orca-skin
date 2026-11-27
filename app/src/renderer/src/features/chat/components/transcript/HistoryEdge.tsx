import { useI18n } from '../../../../shared/i18n'
import { ArcSpinner } from '../../../../shared/ui/ArcSpinner'
import type {
  HistoryDirection,
  TranscriptHistoryControls
} from '../../lib/transcript/historyGesture'

// One fixed row remains mounted from the first partial page to the start marker.
const HISTORY_HEAD_HEIGHT = 'h-8'
const labels = {
  before: 'chat.transcript.historyBefore',
  after: 'chat.transcript.historyAfter',
  pull: 'chat.transcript.historyPull',
  loading: 'chat.transcript.loading',
  error: 'chat.transcript.historyRetry'
} as const

export function HistoryEdge({
  direction,
  history,
  pulling
}: {
  direction: HistoryDirection
  history: TranscriptHistoryControls
  pulling: boolean
}): React.JSX.Element {
  const { tr } = useI18n()
  const state = history[direction]
  const indicator = pulling && state === 'loading' ? 'pull' : state
  const busy = indicator === 'pull' || indicator === 'loading'
  return (
    <div
      data-history-edge={direction}
      data-history-state={indicator}
      className={`${HISTORY_HEAD_HEIGHT} flex shrink-0 items-center justify-center gap-2 overflow-hidden text-caption text-ink3`}
    >
      {state === 'end' ? (
        <span>
          {tr(
            direction === 'before' ? 'chat.transcript.historyStart' : 'chat.transcript.historyEnd'
          )}
        </span>
      ) : (
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          className="inline-flex h-full min-w-0 items-center gap-1 truncate rounded px-2 hover:text-ink focus-visible:outline"
          onClick={() => history.request(direction)}
        >
          {state === 'loading' && !pulling && <ArcSpinner />}
          {tr(
            labels[
              indicator === 'pull' || indicator === 'loading' || indicator === 'error'
                ? indicator
                : direction
            ]
          )}
        </button>
      )}
      {direction === 'after' && history.returnToLatest && (
        <button
          type="button"
          className="truncate rounded px-2 hover:text-ink focus-visible:outline"
          disabled={history.latestState === 'loading'}
          aria-busy={history.latestState === 'loading'}
          onClick={history.returnToLatest}
        >
          {tr(
            history.latestState === 'error'
              ? 'chat.transcript.historyRetryLatest'
              : 'chat.transcript.historyLatest'
          )}
        </button>
      )}
    </div>
  )
}
