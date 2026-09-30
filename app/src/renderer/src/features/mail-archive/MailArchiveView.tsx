import { useEffect, useRef, useState } from 'react'
import { mailArchiveApi } from '../../shared/api/ipc'
import { useI18n } from '../../shared/i18n'
import { MailArchiveBody } from './MailArchiveBody'
import { MailArchiveSearchForm } from './MailArchiveSearchForm'
import {
  archiveSearchRequest,
  EMPTY_ARCHIVE_SEARCH,
  type ArchiveSearchFields
} from './search-request'
import { useMailArchiveSourceState } from './useSourceState'
import { mailArchiveSourceStore, type MailArchiveSourceStore } from './source-state'
import { mailArchiveErrorKey } from './errors'
import type { MailArchiveMessage, MailArchiveSearchHit } from '../../../../shared/mail-archive'

export function MailArchiveView({
  onManageSources,
  store = mailArchiveSourceStore
}: {
  onManageSources(): void
  store?: MailArchiveSourceStore
}): React.JSX.Element {
  const { locale, tr: t } = useI18n()
  const sourceState = useMailArchiveSourceState(store)
  const [fields, setFields] = useState<ArchiveSearchFields>({ ...EMPTY_ARCHIVE_SEARCH })
  const [applied, setApplied] = useState<ArchiveSearchFields>({ ...EMPTY_ARCHIVE_SEARCH })
  const appliedRef = useRef(applied)
  const [results, setResults] = useState<MailArchiveSearchHit[]>([])
  const [selected, setSelected] = useState<MailArchiveMessage | null>(null)
  const selectedRef = useRef<MailArchiveMessage | null>(null)
  const [thread, setThread] = useState<{
    mails: readonly MailArchiveSearchHit[]
    truncated: boolean
  }>({ mails: [], truncated: false })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const searchSequence = useRef(0)
  const selectedSequence = useRef(0)
  const dateLabel = (date: number | null): string =>
    date === null
      ? t('mailArchive.noDate')
      : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  const clearSelection = (): void => {
    selectedSequence.current++
    selectedRef.current = null
    setSelected(null)
    setThread({ mails: [], truncated: false })
  }
  const openResult = async (id: string): Promise<void> => {
    const sequence = ++selectedSequence.current
    const revision = store.getState().revision
    try {
      const [message, conversation] = await Promise.all([
        mailArchiveApi.get({ id }),
        mailArchiveApi.thread({ id, limit: 50 })
      ])
      if (sequence !== selectedSequence.current || revision !== store.getState().revision) return
      selectedRef.current = message
      setSelected(message)
      setThread(conversation)
      setNotice(null)
      setError(null)
    } catch (reason) {
      if (sequence === selectedSequence.current) setError(t(mailArchiveErrorKey(reason)))
    }
  }
  const search = async (next: ArchiveSearchFields, refreshSelection = false): Promise<void> => {
    const prepared = archiveSearchRequest(next)
    if (prepared.error) {
      searchSequence.current++
      setSearching(false)
      setError(t(`mailArchive.${prepared.error}`))
      return
    }
    const sequence = ++searchSequence.current
    const revision = store.getState().revision
    setSearching(true)
    try {
      const found = await mailArchiveApi.search(prepared.request)
      if (sequence !== searchSequence.current || revision !== store.getState().revision) return
      setResults(found)
      if (selectedRef.current && !found.some((hit) => hit.id === selectedRef.current?.id))
        clearSelection()
      appliedRef.current = { ...next }
      setApplied({ ...next })
      setError(null)
      if (refreshSelection && selectedRef.current) void openResult(selectedRef.current.id)
    } catch (reason) {
      if (sequence === searchSequence.current) setError(t(mailArchiveErrorKey(reason)))
    } finally {
      if (sequence === searchSequence.current) setSearching(false)
    }
  }
  useEffect(() => {
    // Source changes refresh the applied request, never the unsubmitted draft.
    const pendingSearch = searchSequence
    const pendingSelection = selectedSequence
    const timer = window.setTimeout(() => {
      void search(appliedRef.current, true)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      pendingSearch.current++
      pendingSelection.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceState.revision, store])
  const exportAttachment = async (id: string): Promise<void> => {
    const sequence = selectedSequence.current
    setExporting(id)
    try {
      const result = await mailArchiveApi.exportAttachment(id)
      if (sequence !== selectedSequence.current) return
      if (result.state === 'not-found') setError(t('mailArchive.attachmentMissing'))
      if (result.state === 'exported')
        setNotice(
          t('mailArchive.attachmentSaved', {
            name: result.name,
            size: result.sizeBytes.toLocaleString()
          })
        )
    } catch (reason) {
      if (sequence === selectedSequence.current) setError(t(mailArchiveErrorKey(reason)))
    } finally {
      setExporting(null)
    }
  }
  const conditionsChanged = Object.keys(fields).some(
    (key) => fields[key as keyof ArchiveSearchFields] !== applied[key as keyof ArchiveSearchFields]
  )
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-bg px-6 py-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink">{t('mailArchive.title')}</h1>
          <p className="mt-1 text-[13px] text-ink3">{t('mailArchive.description')}</p>
        </div>
        <button
          type="button"
          onClick={onManageSources}
          className="rounded-r4 border border-border bg-panel px-3 py-2 text-[12px] text-ink hover:bg-fill-uncontained-hover"
        >
          {t('mailArchive.manage')}
        </button>
      </header>
      <div className="mb-3 flex flex-wrap gap-3 text-[12px] text-ink3" role="status">
        <span>{t('mailArchive.count', { count: sourceState.stats?.totalMessages ?? 0 })}</span>
        {sourceState.progress?.state === 'running' && (
          <span>
            {t('mailArchive.progress', {
              files: sourceState.progress.processedFiles,
              total: sourceState.progress.totalFiles,
              messages: sourceState.progress.processedMessages,
              inserted: sourceState.progress.insertedMessages,
              skipped: sourceState.progress.skippedMessages
            })}
          </span>
        )}
      </div>
      {(error || sourceState.errorKey) && (
        <div
          role="alert"
          className="mb-3 rounded-r4 border border-border bg-panel px-3 py-2 text-[12px] text-ink"
        >
          {error || (sourceState.errorKey && t(sourceState.errorKey))}
        </div>
      )}
      {notice && (
        <p role="status" className="mb-3 text-[12px] text-ink3">
          {notice}
        </p>
      )}
      <MailArchiveSearchForm
        fields={fields}
        sources={sourceState.sources}
        onChange={setFields}
        onSearch={() => void search(fields)}
      />
      <p className="mb-2 min-h-5 text-[11.5px] text-ink3" role="status" aria-live="polite">
        {searching
          ? t('mailArchive.searching')
          : conditionsChanged
            ? t('mailArchive.conditionsChanged')
            : ''}
      </p>
      <div className="flex min-h-0 flex-1 gap-4">
        <section
          aria-label={t('mailArchive.search')}
          className={`min-w-0 flex-1 overflow-y-auto rounded-r5 border border-border bg-panel ${selected ? 'hidden lg:block' : 'block'}`}
        >
          {results.length === 0 ? (
            <p className="px-6 py-12 text-center text-[13px] text-ink3">
              {t(
                sourceState.stats?.totalMessages
                  ? 'mailArchive.noResults'
                  : 'mailArchive.emptySources'
              )}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => void openResult(result.id)}
                  className={`block w-full px-4 py-3 text-left hover:bg-fill-uncontained-hover ${selected?.id === result.id ? 'bg-fill-uncontained-active' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <strong className="min-w-0 truncate text-[13px] font-medium text-ink">
                      {result.subject || t('mailArchive.noSubject')}
                    </strong>
                    <span className="shrink-0 text-[11px] text-ink3">{dateLabel(result.date)}</span>
                  </div>
                  <p className="mt-1 truncate text-[11.5px] text-ink3">
                    {result.from || t('mailArchive.noSender')} · {result.sourceName}
                    {result.folderPath ? ` · ${result.folderPath}` : ''}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink2">
                    {result.snippet || t('mailArchive.noBody')}
                  </p>
                  {result.attachmentNames.length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-ink3">
                      {result.attachmentNames.join(', ')}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
        <aside
          aria-label={t('mailArchive.body')}
          className={`min-w-0 flex-1 overflow-y-auto rounded-r5 border border-border bg-panel ${selected ? 'block' : 'hidden lg:block'}`}
        >
          {selected ? (
            <article className="px-5 py-4">
              <button
                type="button"
                onClick={clearSelection}
                className="mb-3 text-[12px] text-ink3 hover:text-ink lg:hidden"
              >
                ← {t('mailArchive.back')}
              </button>
              <h2 className="text-[16px] font-semibold text-ink">
                {selected.subject || t('mailArchive.noSubject')}
              </h2>
              <dl className="my-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-border pb-4 text-[12px] text-ink3">
                <dt>{t('mailArchive.from')}</dt>
                <dd className="break-words text-ink2">{selected.from || '—'}</dd>
                <dt>{t('mailArchive.to')}</dt>
                <dd className="break-words text-ink2">{selected.to || '—'}</dd>
                <dt>{t('mailArchive.cc')}</dt>
                <dd className="break-words text-ink2">{selected.cc || '—'}</dd>
                <dt>{t('mailArchive.date')}</dt>
                <dd>{dateLabel(selected.date)}</dd>
                <dt>{t('mailArchive.source')}</dt>
                <dd className="break-words">
                  {selected.sourceName}
                  {selected.folderPath ? ` · ${selected.folderPath}` : ''}
                </dd>
              </dl>
              {thread.mails.length > 1 && (
                <section
                  aria-label={t('mailArchive.thread')}
                  className="mb-4 rounded-r4 border border-border bg-bg px-3 py-2"
                >
                  <h3 className="text-[12px] font-medium text-ink">
                    {t('mailArchive.thread')} · {thread.mails.length}
                    {thread.truncated ? '+' : ''}
                  </h3>
                  <p className="mt-1 text-[11px] text-ink3">{t('mailArchive.threadHelp')}</p>
                  {thread.truncated && (
                    <p className="text-[11px] text-ink3">{t('mailArchive.threadLimit')}</p>
                  )}
                  <ol className="mt-2 max-h-40 overflow-y-auto">
                    {thread.mails.map((message) => (
                      <li key={message.id}>
                        <button
                          type="button"
                          aria-current={message.id === selected.id ? 'true' : undefined}
                          onClick={() => void openResult(message.id)}
                          className="w-full py-2 text-left text-[11.5px] text-ink3 hover:text-ink"
                        >
                          <span className="block truncate">
                            {message.subject || t('mailArchive.noSubject')}
                          </span>
                          <span>
                            {dateLabel(message.date)} · {message.from}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              <MailArchiveBody key={selected.id} message={selected} query={applied.query} />
              {selected.attachments.length > 0 && (
                <section className="mt-5 border-t border-border pt-4 text-[12px] text-ink3">
                  <h3 className="mb-2 font-medium text-ink">{t('mailArchive.attachments')}</h3>
                  {selected.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-1"
                    >
                      <span className="min-w-0 truncate">{attachment.name}</span>
                      <button
                        type="button"
                        disabled={exporting !== null || sourceState.removingSourceId !== null}
                        onClick={() => void exportAttachment(attachment.id)}
                        className="rounded-r4 border border-border px-2 py-1 hover:text-ink disabled:opacity-50"
                      >
                        {t(
                          exporting === attachment.id
                            ? 'mailArchive.saving'
                            : 'mailArchive.saveAttachment'
                        )}
                      </button>
                    </div>
                  ))}
                </section>
              )}
            </article>
          ) : (
            <p className="px-6 py-12 text-center text-[13px] text-ink3">
              {t('mailArchive.selectMail')}
            </p>
          )}
        </aside>
      </div>
    </main>
  )
}
