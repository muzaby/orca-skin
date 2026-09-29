import { useEffect, useMemo, useRef, useState } from 'react'
import { mailArchiveApi } from '../../shared/api/ipc'
import { useI18n } from '../../shared/i18n'
import { Icon } from '../../shared/ui/Icon'
import type {
  MailArchiveImportResult,
  MailArchiveMessage,
  MailArchiveProgress,
  MailArchiveSearchHit,
  MailArchiveSourceKind,
  MailArchiveSource,
  MailArchiveStats
} from '../../../../shared/mail-archive'

function formatDate(value: number | null, locale: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

function importSummary(result: MailArchiveImportResult): string {
  if (result.state === 'cancelled') {
    return `가져오기를 취소했습니다. 반영된 메일 ${result.messages}개 중 새로 저장 ${result.inserted}개, 중복 건너뜀 ${result.skipped}개입니다.`
  }
  const failure = result.failures.length > 0 ? ` 실패 ${result.failures.length}개.` : ''
  return `메일 ${result.messages}개를 확인했습니다. 새로 저장 ${result.inserted}개, 중복 건너뜀 ${result.skipped}개입니다.${failure}`
}

export function MailArchiveView(): React.JSX.Element {
  const { locale } = useI18n()
  const [query, setQuery] = useState('')
  const [sourceKind, setSourceKind] = useState<MailArchiveSourceKind | 'all'>('all')
  const [appliedSearch, setAppliedSearch] = useState<{
    query: string
    sourceKind: MailArchiveSourceKind | 'all'
  }>({ query: '', sourceKind: 'all' })
  const [results, setResults] = useState<MailArchiveSearchHit[]>([])
  const [selected, setSelected] = useState<MailArchiveMessage | null>(null)
  const [threadMails, setThreadMails] = useState<MailArchiveSearchHit[]>([])
  const [threadTruncated, setThreadTruncated] = useState(false)
  const [sources, setSources] = useState<MailArchiveSource[]>([])
  const [stats, setStats] = useState<MailArchiveStats | null>(null)
  const [progress, setProgress] = useState<MailArchiveProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [removingSourceId, setRemovingSourceId] = useState<string | null>(null)
  const [exportingAttachmentId, setExportingAttachmentId] = useState<string | null>(null)
  const searchSequence = useRef(0)
  const selectedSequence = useRef(0)

  const loadStats = async (): Promise<void> => {
    setStats(await mailArchiveApi.stats())
  }

  const loadSources = async (): Promise<void> => {
    setSources(await mailArchiveApi.sources())
  }

  const search = async (nextQuery = query, nextSource = sourceKind): Promise<void> => {
    const sequence = ++searchSequence.current
    setSearching(true)
    try {
      const found = await mailArchiveApi.search({
        query: nextQuery,
        ...(nextSource === 'all' ? {} : { sourceKind: nextSource }),
        limit: 50
      })
      if (sequence !== searchSequence.current) return
      setResults(found)
      if (selected && !found.some((result) => result.id === selected.id)) {
        selectedSequence.current += 1
        setSelected(null)
        setThreadMails([])
        setThreadTruncated(false)
      }
      setAppliedSearch({ query: nextQuery, sourceKind: nextSource })
      setError(null)
    } finally {
      if (sequence === searchSequence.current) setSearching(false)
    }
  }

  useEffect(() => {
    const unsubscribe = mailArchiveApi.onProgress(setProgress)
    const timer = window.setTimeout(() => {
      void loadStats().catch((reason: unknown) => setError(String(reason)))
      void loadSources().catch((reason: unknown) => setError(String(reason)))
      void search('', 'all').catch((reason: unknown) => setError(String(reason)))
    }, 0)
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
    // Initial data is intentionally loaded once; the query effect below owns subsequent searches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const busy = progress?.state === 'running'
  const sourceMaintenanceBusy = removingSourceId !== null
  const searchConditionsChanged =
    query !== appliedSearch.query || sourceKind !== appliedSearch.sourceKind
  const emptyLabel = appliedSearch.query.trim()
    ? '검색 결과가 없습니다.'
    : stats?.totalMessages
      ? '검색어를 입력한 뒤 검색을 실행하세요.'
      : '파일을 추가하면 보관한 메일이 여기에 표시됩니다.'
  const progressLabel = useMemo(() => {
    if (!progress || progress.state !== 'running') return null
    const source = progress.currentPath ? ` · ${progress.currentPath}` : ''
    return `${progress.processedFiles}/${progress.totalFiles} 파일 · 처리 ${progress.processedMessages}개 · 새 저장 ${progress.insertedMessages}개 · 중복 ${progress.skippedMessages}개${source}`
  }, [progress])

  const runImport = async (request: Parameters<typeof mailArchiveApi.import>[0]): Promise<void> => {
    setError(null)
    setNotice(null)
    try {
      const result = await mailArchiveApi.import(request)
      setProgress(null)
      await loadStats()
      await loadSources()
      await search()
      setNotice(importSummary(result))
    } catch (reason) {
      setProgress(null)
      setNotice(null)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const pickFiles = async (): Promise<void> => {
    const paths = await mailArchiveApi.pickFiles()
    if (paths.length > 0) await runImport({ inputKind: 'files', paths })
  }

  const pickFolder = async (): Promise<void> => {
    const path = await mailArchiveApi.pickEmlFolder()
    if (path) await runImport({ inputKind: 'eml-folder', paths: [path] })
  }

  const openResult = async (id: string): Promise<void> => {
    const sequence = ++selectedSequence.current
    const [message, thread] = await Promise.all([
      mailArchiveApi.get({ id }),
      mailArchiveApi.thread({ id, limit: 50 })
    ])
    if (sequence !== selectedSequence.current) return
    setSelected(message)
    setThreadMails([...thread.mails])
    setThreadTruncated(thread.truncated)
  }

  const closeSelected = (): void => {
    selectedSequence.current += 1
    setSelected(null)
    setThreadMails([])
    setThreadTruncated(false)
  }

  const exportAttachment = async (attachmentId: string): Promise<void> => {
    setExportingAttachmentId(attachmentId)
    setError(null)
    setNotice(null)
    try {
      const result = await mailArchiveApi.exportAttachment(attachmentId)
      if (result.state === 'cancelled') return
      if (result.state === 'not-found') {
        setError('이 첨부는 현재 검색 가능한 자료원에서 찾을 수 없습니다. 검색을 새로 고쳐 주세요.')
        return
      }
      setNotice(
        `첨부파일 ${result.name}을(를) 저장했습니다. (${result.sizeBytes.toLocaleString()} bytes)`
      )
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : ''
      setError(
        code === 'mail_attachment_destination_is_source'
          ? '원본 EML/PST 파일에는 저장할 수 없습니다. 다른 위치를 선택해 주세요.'
          : code === 'mail_attachment_source_changed'
            ? '원본 파일이 보관 당시와 달라 첨부를 저장하지 않았습니다. 자료원을 다시 가져온 뒤 시도해 주세요.'
            : '첨부파일을 저장하지 못했습니다. 원본 파일을 확인한 뒤 다시 시도해 주세요.'
      )
    } finally {
      setExportingAttachmentId(null)
    }
  }

  const removeSource = async (sourceId: string): Promise<void> => {
    selectedSequence.current += 1
    setRemovingSourceId(sourceId)
    setError(null)
    setNotice(null)
    try {
      const result = await mailArchiveApi.removeSource(sourceId)
      if (result.state === 'cancelled') return
      setSelected(null)
      setThreadMails([])
      setThreadTruncated(false)
      await Promise.all([loadStats(), loadSources()])
      await search()
      if (result.state === 'not-found') {
        setNotice('이미 제거된 자료원입니다. 목록을 새로 고쳤습니다.')
        return
      }
      const interrupted = result.importCancelled ? ' 진행 중이던 가져오기는 취소했습니다.' : ''
      setNotice(
        `${result.sourceName}: 메일 ${result.removedMessages}개를 제거하고 공유 메일 ${result.preservedMessages}개를 유지했습니다. 원본 파일은 그대로입니다.${interrupted}`
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setRemovingSourceId(null)
    }
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-bg px-8 py-7">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-ink3">
            <Icon name="history" size={16} />
            <span className="text-[12px] font-medium uppercase tracking-[0.12em]">
              Mail archive
            </span>
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">업무 메일 이력</h1>
          <p className="mt-1 text-[13px] text-ink3">
            EML·PST를 로컬 색인으로 보관하고 본문과 메타데이터를 검색합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void pickFiles()}
            disabled={busy || sourceMaintenanceBusy}
            className="rounded-r4 bg-fill-uncontained-active px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-fill-uncontained-hover disabled:opacity-50"
          >
            파일 추가
          </button>
          <button
            type="button"
            onClick={() => void pickFolder()}
            disabled={busy || sourceMaintenanceBusy}
            className="rounded-r4 border border-border bg-panel px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-fill-uncontained-hover disabled:opacity-50"
          >
            EML 폴더 배치
          </button>
          {busy && progress && (
            <button
              type="button"
              onClick={() => void mailArchiveApi.cancel(progress.jobId)}
              disabled={!progress.cancellable}
              className="rounded-r4 border border-border px-3 py-2 text-[12.5px] text-ink3 hover:text-ink disabled:opacity-50"
            >
              {progress.cancellable ? '취소' : '마무리 중'}
            </button>
          )}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-r5 border border-border bg-panel px-4 py-3 text-[12px] text-ink3">
        <span>전체 {stats?.totalMessages ?? 0}개</span>
        <span>EML {stats?.emlMessages ?? 0}개</span>
        <span>PST {stats?.pstMessages ?? 0}개</span>
        {progressLabel && <span className="text-ink">가져오는 중: {progressLabel}</span>}
      </div>

      {sources.length > 0 && (
        <details className="mb-4 rounded-r5 border border-border bg-panel px-4 py-3 text-[12px] text-ink3">
          <summary className="cursor-pointer font-medium text-ink">
            자료원 관리 · {sources.length}개
          </summary>
          <ul className="mt-3 divide-y divide-border">
            {sources.map((source) => (
              <li
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-ink">
                    {source.kind.toUpperCase()} · {source.name} · {source.id.slice(0, 8)}
                  </div>
                  <div className="mt-0.5">
                    {source.messageCount}개 검색 가능
                    {source.sharedMessageCount > 0
                      ? ` · 다른 자료원과 ${source.sharedMessageCount}개 공유`
                      : ''}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`${source.name} 자료원 제거`}
                  disabled={removingSourceId !== null || exportingAttachmentId !== null}
                  onClick={() => void removeSource(source.id)}
                  className="rounded-r4 border border-border px-2.5 py-1.5 text-[11.5px] text-ink3 hover:bg-fill-uncontained-hover hover:text-ink disabled:opacity-50"
                >
                  {removingSourceId === source.id ? '제거 중…' : '자료원 제거'}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && (
        <div className="mb-4 rounded-r4 border border-red-300/40 bg-red-50/40 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-r4 border border-border bg-panel px-3 py-2 text-[12px] text-ink3">
          {notice}
        </div>
      )}

      <form
        className="mb-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void search().catch((reason: unknown) => setError(String(reason)))
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-r4 border border-border bg-panel px-3 py-2">
          <Icon name="search" size={15} className="text-ink3" />
          <input
            aria-label="메일 제목, 발신자, 본문, 첨부파일 이름 검색어"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목, 발신자, 본문, 첨부파일 이름 검색"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink3"
          />
        </label>
        <select
          aria-label="자료원 유형"
          value={sourceKind}
          onChange={(event) => setSourceKind(event.target.value as MailArchiveSourceKind | 'all')}
          className="rounded-r4 border border-border bg-panel px-3 text-[12px] text-ink outline-none"
        >
          <option value="all">전체 자료</option>
          <option value="eml">EML</option>
          <option value="pst">PST</option>
        </select>
        <button
          type="submit"
          className="rounded-r4 bg-fill-uncontained-active px-4 py-2 text-[12px] font-medium text-ink hover:bg-fill-uncontained-hover"
        >
          검색
        </button>
      </form>
      <div className="mb-3 min-h-5 text-[11.5px] text-ink3" role="status" aria-live="polite">
        {searching
          ? '검색 중…'
          : searchConditionsChanged
            ? '검색 조건이 바뀌었습니다. 검색을 실행하면 결과가 갱신됩니다.'
            : ''}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <section
          className={`min-w-0 flex-1 overflow-y-auto rounded-r5 border border-border bg-panel ${selected ? 'hidden lg:block' : 'block'}`}
        >
          {results.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-ink3">
              {emptyLabel}
            </div>
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
                      {result.subject || '(제목 없음)'}
                    </strong>
                    <span className="shrink-0 text-[11px] text-ink3">
                      {formatDate(result.date, locale)}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11.5px] text-ink3">
                    {result.from || '발신자 없음'} · {result.sourceName}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink2">
                    {result.snippet || '(본문 없음)'}
                  </div>
                  {result.attachmentNames.length > 0 && (
                    <div className="mt-1 truncate text-[11px] text-ink3">
                      첨부: {result.attachmentNames.join(', ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <aside
          className={`min-w-0 flex-1 overflow-y-auto rounded-r5 border border-border bg-panel ${selected ? 'block' : 'hidden lg:block'}`}
        >
          {selected ? (
            <article className="px-5 py-4">
              <button
                type="button"
                onClick={closeSelected}
                className="mb-3 text-[12px] text-ink3 hover:text-ink lg:hidden"
              >
                ← 검색 결과
              </button>
              <div className="mb-4 border-b border-border pb-4">
                <h2 className="text-[16px] font-semibold text-ink">
                  {selected.subject || '(제목 없음)'}
                </h2>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] text-ink3">
                  <dt>보낸 사람</dt>
                  <dd className="truncate text-ink2">{selected.from || '—'}</dd>
                  <dt>받는 사람</dt>
                  <dd className="truncate text-ink2">{selected.to || '—'}</dd>
                  <dt>날짜</dt>
                  <dd className="text-ink2">{formatDate(selected.date, locale)}</dd>
                  <dt>자료원</dt>
                  <dd className="truncate text-ink2">
                    {selected.sourceName}
                    {selected.folderPath ? ` · ${selected.folderPath}` : ''}
                  </dd>
                </dl>
              </div>
              {threadMails.length > 1 && (
                <section
                  aria-label="확인된 대화"
                  className="mb-5 rounded-r4 border border-border bg-bg px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[12px] font-medium text-ink">
                      확인된 대화 · {threadMails.length}
                      {threadTruncated ? '+' : ''}개
                    </h3>
                    {threadTruncated && (
                      <span className="text-[10.5px] text-ink3">최대 50개까지 표시</span>
                    )}
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-ink3">
                    메일의 답장·참조 헤더로 확인된 연결입니다. 제목만 비슷한 메일은 합치지
                    않았습니다.
                  </p>
                  <ol className="mt-2 max-h-48 divide-y divide-border overflow-y-auto">
                    {threadMails.map((message) => (
                      <li key={message.id}>
                        <button
                          type="button"
                          aria-current={message.id === selected.id ? 'true' : undefined}
                          onClick={() => void openResult(message.id)}
                          className={`block w-full py-2 text-left hover:text-ink ${message.id === selected.id ? 'text-ink' : 'text-ink3'}`}
                        >
                          <span className="block truncate text-[11.5px]">
                            {message.subject || '(제목 없음)'}
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px]">
                            {formatDate(message.date, locale)} · {message.from || '발신자 없음'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-[1.7] text-ink2">
                {selected.bodyText || '(본문 없음)'}
              </pre>
              {selected.attachments.length > 0 && (
                <div className="mt-5 border-t border-border pt-4 text-[12px] text-ink3">
                  <div className="mb-2 font-medium text-ink">첨부파일 이름</div>
                  {selected.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-1"
                    >
                      <span className="min-w-0 truncate">
                        {attachment.name} · {attachment.sizeBytes.toLocaleString()} bytes
                      </span>
                      <button
                        type="button"
                        aria-label={`${attachment.name} 첨부파일 저장`}
                        disabled={busy || sourceMaintenanceBusy || exportingAttachmentId !== null}
                        onClick={() => void exportAttachment(attachment.id)}
                        className="shrink-0 rounded-r4 border border-border px-2 py-1 text-[11px] text-ink3 hover:bg-fill-uncontained-hover hover:text-ink disabled:opacity-50"
                      >
                        {exportingAttachmentId === attachment.id ? '저장 중…' : '파일로 저장'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-ink3">
              메일을 선택하면 본문과 관계 정보를 볼 수 있습니다.
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
