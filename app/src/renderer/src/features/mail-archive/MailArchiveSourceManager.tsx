import { useI18n } from '../../shared/i18n'
import { useMailArchiveSourceState } from './useSourceState'
import type { MailArchiveSourceStore } from './source-state'
import { mailArchiveErrorKey as stateError } from './errors'

export function MailArchiveSourceManager({
  onOpenArchive,
  store
}: {
  onOpenArchive(): void
  store?: MailArchiveSourceStore
}): React.JSX.Element {
  const { tr: t } = useI18n()
  const state = useMailArchiveSourceState(store)
  const busy = state.importing || state.progress?.state === 'running'
  const result = state.lastImport
  const removal = state.lastRemoval
  return (
    <section aria-label={t('mailArchive.manage')} className="space-y-4 text-[12.5px] text-ink2">
      <div>
        <h2 className="text-[18px] font-semibold text-ink">{t('mailArchive.title')}</h2>
        <p className="mt-2 text-ink3">{t('mailArchive.description')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || state.removingSourceId !== null}
          onClick={() => void state.add('files')}
          className="rounded-r4 bg-fill-uncontained-active px-3 py-2 text-ink hover:bg-fill-uncontained-hover disabled:opacity-50"
        >
          {t('mailArchive.addFiles')}
        </button>
        <button
          type="button"
          disabled={busy || state.removingSourceId !== null}
          onClick={() => void state.add('eml-folder')}
          className="rounded-r4 border border-border px-3 py-2 hover:bg-fill-uncontained-hover disabled:opacity-50"
        >
          {t('mailArchive.addFolder')}
        </button>
        <button
          type="button"
          onClick={onOpenArchive}
          className="rounded-r4 border border-border px-3 py-2 hover:bg-fill-uncontained-hover"
        >
          {t('mailArchive.open')}
        </button>
      </div>
      <div
        role="status"
        aria-live="polite"
        className="rounded-r4 border border-border bg-bg px-3 py-2 text-ink3"
      >
        {state.loading
          ? t('mailArchive.loading')
          : t('mailArchive.count', { count: state.stats?.totalMessages ?? 0 })}
        {busy && (
          <p className="mt-1">
            {state.progress
              ? t('mailArchive.progress', {
                  files: state.progress.processedFiles,
                  total: state.progress.totalFiles,
                  messages: state.progress.processedMessages,
                  inserted: state.progress.insertedMessages,
                  skipped: state.progress.skippedMessages
                })
              : t('mailArchive.preparing')}
          </p>
        )}
        {state.progress?.state === 'running' && (
          <button
            type="button"
            disabled={!state.progress.cancellable}
            onClick={() => void state.cancel()}
            className="mt-2 rounded-r4 border border-border px-2 py-1 text-ink hover:bg-fill-uncontained-hover disabled:opacity-50"
          >
            {t(state.progress.cancellable ? 'mailArchive.cancel' : 'mailArchive.finishing')}
          </button>
        )}
      </div>
      {state.errorKey && (
        <div role="alert" className="rounded-r4 border border-border px-3 py-2 text-ink">
          {t(state.errorKey)}
          <button type="button" onClick={() => void state.refresh()} className="ml-2 underline">
            {t('mailArchive.retry')}
          </button>
        </div>
      )}
      {result && (
        <p>
          {t(
            result.state === 'cancelled'
              ? 'mailArchive.importCancelled'
              : 'mailArchive.importComplete',
            {
              messages: result.messages,
              inserted: result.inserted,
              skipped: result.skipped,
              failed: result.failures.length
            }
          )}
          {result.ignoredItems
            ? ` ${t('mailArchive.ignored', { count: result.ignoredItems })}`
            : ''}
        </p>
      )}
      {result && result.failures.length > 0 && (
        <details className="rounded-r4 border border-border px-3 py-2">
          <summary className="cursor-pointer">
            {t('mailArchiveRepair.failures')} ({result.failures.length})
          </summary>
          <ul className="mt-2 max-h-40 overflow-auto">
            {result.failures.map((failure, index) => (
              <li key={index}>
                {failure.path}: {t(stateError(failure.reason))}
              </li>
            ))}
          </ul>
        </details>
      )}
      {removal?.state === 'removed' && (
        <p>
          {t('mailArchive.removed', {
            name: removal.sourceName,
            removed: removal.removedMessages,
            preserved: removal.preservedMessages
          })}
          {removal.importCancelled ? ` ${t('mailArchive.removeCancelledImport')}` : ''}
        </p>
      )}
      {removal?.state === 'not-found' && <p>{t('mailArchive.alreadyRemoved')}</p>}
      <p className="text-ink3">{t('mailArchive.embeddingLater')}</p>
      {state.sources.length === 0 && !state.loading ? (
        <p>{t('mailArchive.emptySources')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {state.sources.map((source) => (
            <li key={source.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="truncate text-ink">
                  {source.kind.toUpperCase()} · {source.name} · {source.id.slice(0, 8)}
                </p>
                <p className="mt-1 text-ink3">
                  {t('mailArchive.sourceCount', {
                    count: source.messageCount,
                    shared: source.sharedMessageCount
                  })}
                </p>
              </div>
              <button
                type="button"
                aria-label={t('mailArchive.removeSourceLabel', { name: source.name })}
                disabled={state.removingSourceId !== null}
                onClick={() => void state.remove(source.id)}
                className="rounded-r4 border border-border px-2.5 py-1.5 text-ink3 hover:bg-fill-uncontained-hover hover:text-ink disabled:opacity-50"
              >
                {t(
                  state.removingSourceId === source.id
                    ? 'mailArchive.removing'
                    : 'mailArchive.removeSource'
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
