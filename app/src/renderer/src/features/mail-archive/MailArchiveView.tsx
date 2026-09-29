import { useEffect, useMemo, useRef, useState } from 'react'
import { mailArchiveErrorKey } from './errors'
import { mailArchiveApi } from '../../shared/api/ipc'
import { useI18n } from '../../shared/i18n'
import { Icon } from '../../shared/ui/Icon'
import type {
  MailArchiveImportResult,
  MailArchiveBodyKind,
  MailArchiveMessage,
  MailArchiveProgress,
  MailArchiveSearchHit,
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
  const failure =
    (result.failures.length > 0 ? ` 실패 ${result.failures.length}개.` : '') +
    (result.ignoredItems
      ? ` 메일이 아닌 일정·연락처 등 ${result.ignoredItems}개는 제외했습니다.`
      : '')
  return `메일 ${result.messages}개를 확인했습니다. 새로 저장 ${result.inserted}개, 중복 건너뜀 ${result.skipped}개입니다.${failure}`
}

function bodyKindLabel(kind: MailArchiveBodyKind | null): string {
  if (kind === 'plain') return '일반 텍스트'
  if (kind === 'html') return 'HTML 변환 텍스트'
  if (kind === 'legacy') return '원문 형식 미기록'
  return '본문 없음'
}

function bodySelectionLabel(reason: MailArchiveMessage['bodySelectionReason']): string {
  switch (reason) {
    case 'plain_preferred':
      return '일반 텍스트를 우선 사용했습니다.'
    case 'plain_placeholder_fallback':
      return '일반 텍스트가 HTML 보기 안내문이라 HTML 본문을 사용했습니다.'
    case 'plain_unusable_fallback':
      return '일반 텍스트가 비어 있거나 대체 문자만 있어 HTML 본문을 사용했습니다.'
    case 'html_only':
      return 'HTML 본문만 있어 읽을 수 있는 텍스트로 변환했습니다.'
    case 'oversized':
      return '본문이 2 MiB 보관 한도를 넘어 저장되지 않았습니다.'
    case 'empty':
      return '읽을 수 있는 본문이 없습니다.'
    case 'legacy':
      return '이 메일은 본문 품질 표시를 추가하기 전에 가져왔습니다.'
  }
}

export function MailArchiveView(): React.JSX.Element {
  const { locale, tr: t } = useI18n()
  const errorMessage = (reason: unknown): string => t(mailArchiveErrorKey(reason))
  const [query, setQuery] = useState('')
  const [sourceKind, setSourceKind] = useState('all')
  const [appliedSearch, setAppliedSearch] = useState<{
    query: string
    sourceKind: string
  }>({ query: '', sourceKind: 'all' })
  const [results, setResults] = useState<MailArchiveSearchHit[]>([])
  const [selected, setSelected] = useState<MailArchiveMessage | null>(null)
  const [showAlternateBody, setShowAlternateBody] = useState(false)
  const [threadMails, setThreadMails] = useState<MailArchiveSearchHit[]>([])
  const [threadTruncated, setThreadTruncated] = useState(false)
  const [sources, setSources] = useState<MailArchiveSource[]>([])
  const [stats, setStats] = useState<MailArchiveStats | null>(null)
  const [progress, setProgress] = useState<MailArchiveProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failures, setFailures] = useState<MailArchiveImportResult['failures']>([])
  const progressSequence = useRef(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [removingSourceId, setRemovingSourceId] = useState<string | null>(null)
  const [exportingAttachmentId, setExportingAttachmentId] = useState<string | null>(null)
  const searchSequence = useRef(0)
  const selectedSequence = useRef(0)

  const loadStats = async (): Promise<void> => {
    const sequence = progressSequence.current
    const snapshot = await mailArchiveApi.stats()
    setStats(snapshot)
    if (sequence === progressSequence.current) {
      setProgress(snapshot.progress ?? null)
      if (snapshot.lastImport) {
        setNotice(importSummary(snapshot.lastImport))
        setFailures(snapshot.lastImport.failures)
      }
    }
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
        ...(nextSource === 'all'
          ? {}
          : nextSource === 'eml' || nextSource === 'pst'
            ? { sourceKind: nextSource }
            : { sourceId: nextSource }),
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
    const unsubscribe = mailArchiveApi.onProgress((value) => {
      progressSequence.current += 1
      setProgress(value)
    })
    const timer = window.setTimeout(() => {
      void loadStats().catch((reason: unknown) => setError(errorMessage(reason)))
      void loadSources().catch((reason: unknown) => setError(errorMessage(reason)))
      void search('', 'all').catch((reason: unknown) => setError(errorMessage(reason)))
    }, 0)
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
    // Initial data is intentionally loaded once; the query effect below owns subsequent searches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!progress || progress.state === 'running') return
    // A remounted page did not initiate this import, so its invoke promise cannot refresh it.
    const timer = window.setTimeout(() => {
      void Promise.all([loadStats(), loadSources(), search()]).catch((reason: unknown) =>
        setError(errorMessage(reason))
      )
    }, 0)
    return () => window.clearTimeout(timer)
    // Refresh once per terminal job; ordinary query edits still require an explicit search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.jobId, progress?.state])

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
    setFailures([])
    try {
      const result = await mailArchiveApi.import(request)
      setProgress(null)
      await loadStats()
      await loadSources()
      await search()
      setNotice(importSummary(result))
      setFailures(result.failures)
    } catch (reason) {
      setProgress(null)
      setNotice(null)
      setError(errorMessage(reason))
    }
  }

  const pickFiles = async (): Promise<void> => {
    const selection = await mailArchiveApi.pickFiles()
    if (selection) await runImport(selection)
  }

  const pickFolder = async (): Promise<void> => {
    const selection = await mailArchiveApi.pickEmlFolder()
    if (selection) await runImport(selection)
  }

  const openResult = async (id: string): Promise<void> => {
    const sequence = ++selectedSequence.current
    try {
      const [message, thread] = await Promise.all([
        mailArchiveApi.get({ id }),
        mailArchiveApi.thread({ id, limit: 50 })
      ])
      if (sequence !== selectedSequence.current) return
      setSelected(message)
      setShowAlternateBody(false)
      setThreadMails([...thread.mails])
      setThreadTruncated(thread.truncated)
    } catch (reason) {
      if (sequence === selectedSequence.current) setError(errorMessage(reason))
    }
  }

  const closeSelected = (): void => {
    selectedSequence.current += 1
    setSelected(null)
    setShowAlternateBody(false)
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
      setError(errorMessage(reason))
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
      setShowAlternateBody(false)
      setThreadMails([])
      setThreadTruncated(false)
      await Promise.all([loadStats(), loadSources()])
      if (sourceKind === sourceId) {
        setSourceKind('all')
        await search(query, 'all')
      } else await search()
      if (result.state === 'not-found') {
        setNotice('이미 제거된 자료원입니다. 목록을 새로 고쳤습니다.')
        return
      }
      const interrupted = result.importCancelled ? ' 진행 중이던 가져오기는 취소했습니다.' : ''
      setNotice(
        `${result.sourceName}: 메일 ${result.removedMessages}개를 제거하고 공유 메일 ${result.preservedMessages}개를 유지했습니다. 원본 파일은 그대로입니다.${interrupted}`
      )
    } catch (reason) {
      setError(errorMessage(reason))
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
              onClick={() =>
                void mailArchiveApi
                  .cancel(progress.jobId)
                  .catch((reason: unknown) => setError(errorMessage(reason)))
              }
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

      {failures.length > 0 && (
        <details className="mb-4 rounded-r4 border border-border bg-panel px-3 py-2 text-[12px] text-ink2">
          <summary>
            {t('mailArchiveRepair.failures')} ({failures.length})
          </summary>
          <ul className="mt-2 max-h-40 overflow-auto">
            {failures.map((failure, index) => (
              <li key={`${failure.path}-${index}`}>
                {failure.path}: {errorMessage(failure.reason)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <form
        className="mb-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void search().catch((reason: unknown) => setError(errorMessage(reason)))
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
          aria-label="자료원"
          value={sourceKind}
          onChange={(event) => setSourceKind(event.target.value)}
          className="rounded-r4 border border-border bg-panel px-3 text-[12px] text-ink outline-none"
        >
          <option value="all">전체 자료</option>
          <option value="eml">EML</option>
          <option value="pst">PST</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name} ({source.id.slice(0, 8)})
            </option>
          ))}
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
                  <dt>{t('mailArchiveRepair.cc')}</dt>
                  <dd className="truncate text-ink2">{selected.cc || '—'}</dd>
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
              {(selected.bodyQualityFlags.length > 0 || selected.bodyAlternateOmitted) && (
                <div
                  role="note"
                  aria-label="본문 처리 알림"
                  className="mb-3 rounded-r4 border border-border bg-bg px-3 py-2 text-[11.5px] leading-relaxed text-ink3"
                >
                  {selected.bodyQualityFlags.includes('decode_suspect') && (
                    <p>문자 해석이 불확실할 수 있습니다. 아래 본문을 원본 메일과 대조해 주세요.</p>
                  )}
                  {selected.bodyQualityFlags.includes('alternative_mismatch') && (
                    <p>
                      일반 텍스트와 HTML 본문 내용이 다릅니다. 다른 본문 형식도 확인할 수 있습니다.
                    </p>
                  )}
                  {selected.bodyQualityFlags.includes('oversized') && (
                    <p>
                      {selected.bodySelectionReason === 'oversized'
                        ? '본문이 2 MiB 보관 한도를 넘어 본문을 저장하지 않았습니다.'
                        : '본문 보관 한도 때문에 대체 형식은 저장하지 않았습니다.'}
                    </p>
                  )}
                  {selected.bodyQualityFlags.includes('html_converted') && (
                    <p>HTML에서 읽을 수 있는 텍스트를 만들어 표시합니다.</p>
                  )}
                </div>
              )}
              <details className="mb-3 rounded-r4 border border-border px-3 py-2 text-[11px] text-ink3">
                <summary className="cursor-pointer font-medium text-ink2">본문 처리 정보</summary>
                <p className="mt-2">
                  표시 형식:{' '}
                  {bodyKindLabel(
                    showAlternateBody ? selected.bodyAlternateKind : selected.bodyKind
                  )}
                </p>
                <p>{bodySelectionLabel(selected.bodySelectionReason)}</p>
                {selected.bodyAlternateKind && (
                  <p>대체 형식: {bodyKindLabel(selected.bodyAlternateKind)}</p>
                )}
              </details>
              {selected.bodyAlternateText !== null && (
                <button
                  type="button"
                  aria-pressed={showAlternateBody}
                  onClick={() => setShowAlternateBody((shown) => !shown)}
                  className="mb-2 rounded-r4 border border-border px-2.5 py-1.5 text-[11px] text-ink3 hover:bg-fill-uncontained-hover hover:text-ink"
                >
                  {showAlternateBody
                    ? '선택 본문으로 돌아가기'
                    : `대체 본문 보기 · ${bodyKindLabel(selected.bodyAlternateKind)}`}
                </button>
              )}
              <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-[1.7] text-ink2">
                {(showAlternateBody ? selected.bodyAlternateText : selected.bodyText) ||
                  (selected.bodySelectionReason === 'oversized'
                    ? '보관 한도를 넘어 본문을 저장하지 않았습니다.'
                    : '(본문 없음)')}
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
