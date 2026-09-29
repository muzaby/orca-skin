import { useEffect, useMemo, useRef, useState } from 'react'
import { mailArchiveApi } from '../../shared/api/ipc'
import { useI18n } from '../../shared/i18n'
import { Icon } from '../../shared/ui/Icon'
import type {
  MailArchiveImportResult,
  MailArchiveMessage,
  MailArchiveProgress,
  MailArchiveSearchHit,
  MailArchiveSource,
  MailArchiveStats,
  MailArchiveThreadResult
} from '../../../../shared/mail-archive'
import { MailMessageDetail } from './MailMessageDetail'
import { archiveErrorMessage, importSummary } from './mailArchiveText'

interface SearchConditions {
  readonly query: string
  readonly sourceId: string
}

interface Selection {
  readonly message: MailArchiveMessage
  readonly thread: MailArchiveThreadResult
}

const ALL_SOURCES = ''

export function MailArchiveView(): React.JSX.Element {
  const { locale } = useI18n()
  const [conditions, setConditions] = useState<SearchConditions>({
    query: '',
    sourceId: ALL_SOURCES
  })
  const [applied, setApplied] = useState<SearchConditions>(conditions)
  const [results, setResults] = useState<MailArchiveSearchHit[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [sources, setSources] = useState<MailArchiveSource[]>([])
  const [stats, setStats] = useState<MailArchiveStats | null>(null)
  const [progress, setProgress] = useState<MailArchiveProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [maintenance, setMaintenance] = useState<{ kind: 'remove' | 'export'; id: string } | null>(
    null
  )
  // 늦게 도착한 응답이 새 결과·선택을 덮지 않게 요청마다 번호를 매긴다.
  const searchSequence = useRef(0)
  const selectionSequence = useRef(0)

  const formatDate = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
    return (value: number | null): string => (value ? format.format(value) : '—')
  }, [locale])

  const clearSelection = (): void => {
    selectionSequence.current += 1
    setSelection(null)
  }

  const refreshOverview = async (): Promise<void> => {
    const [nextStats, nextSources] = await Promise.all([
      mailArchiveApi.stats(),
      mailArchiveApi.sources()
    ])
    setStats(nextStats)
    setSources(nextSources)
  }

  const search = async (next: SearchConditions): Promise<void> => {
    const sequence = ++searchSequence.current
    setSearching(true)
    try {
      const found = await mailArchiveApi.search({
        query: next.query,
        ...(next.sourceId ? { sourceId: next.sourceId } : {}),
        limit: 50
      })
      if (sequence !== searchSequence.current) return
      setResults(found)
      setApplied(next)
      setSelection((current) =>
        current && found.some((hit) => hit.id === current.message.id) ? current : null
      )
    } finally {
      if (sequence === searchSequence.current) setSearching(false)
    }
  }

  const run = (task: () => Promise<void>, fallback: string): void => {
    setError(null)
    task().catch((reason: unknown) => setError(archiveErrorMessage(reason, fallback)))
  }

  useEffect(() => {
    const unsubscribe = mailArchiveApi.onProgress(setProgress)
    // 다른 화면에 다녀와도 진행 중인 가져오기 상태를 복구한다.
    mailArchiveApi
      .status()
      .then((current) => {
        if (current?.state === 'running') setProgress(current)
        return refreshOverview()
      })
      .then(() => search(conditions))
      .catch((reason: unknown) =>
        setError(archiveErrorMessage(reason, '보관함을 불러오지 못했습니다.'))
      )
    return unsubscribe
    // 처음 한 번만 불러온다. 이후 검색은 사용자가 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const busy = progress?.state === 'running'

  const runImport = (start: () => Promise<MailArchiveImportResult | null>): void => {
    setNotice(null)
    run(async () => {
      try {
        const result = await start()
        if (!result) return
        await refreshOverview()
        await search(applied)
        setNotice(importSummary(result))
      } finally {
        setProgress(null)
      }
    }, '가져오지 못했습니다.')
  }

  const openMessage = (id: string): void => {
    const sequence = ++selectionSequence.current
    run(async () => {
      const [message, thread] = await Promise.all([
        mailArchiveApi.get(id),
        mailArchiveApi.thread({ id, limit: 50 })
      ])
      if (sequence !== selectionSequence.current) return
      if (!message) {
        setSelection(null)
        setError('이 메일은 현재 검색 가능한 자료원에 없습니다. 검색을 새로 고쳐 주세요.')
        return
      }
      setSelection({ message, thread })
    }, '메일을 열지 못했습니다.')
  }

  const exportAttachment = (attachmentId: string): void => {
    setNotice(null)
    setMaintenance({ kind: 'export', id: attachmentId })
    run(async () => {
      try {
        const result = await mailArchiveApi.exportAttachment(attachmentId)
        if (result.state === 'not-found') {
          setError(
            '이 첨부는 현재 검색 가능한 자료원에서 찾을 수 없습니다. 검색을 새로 고쳐 주세요.'
          )
        } else if (result.state === 'exported') {
          setNotice(
            `첨부파일 ${result.name}을(를) 저장했습니다. (${result.sizeBytes.toLocaleString()} bytes)`
          )
        }
      } finally {
        setMaintenance(null)
      }
    }, '첨부파일을 저장하지 못했습니다. 원본 파일을 확인한 뒤 다시 시도해 주세요.')
  }

  const removeSource = (sourceId: string): void => {
    setNotice(null)
    setMaintenance({ kind: 'remove', id: sourceId })
    run(async () => {
      try {
        const result = await mailArchiveApi.removeSource(sourceId)
        if (result.state === 'cancelled') return
        clearSelection()
        const next =
          conditions.sourceId === sourceId ? { ...conditions, sourceId: ALL_SOURCES } : conditions
        setConditions(next)
        await refreshOverview()
        await search(next)
        setNotice(
          result.state === 'not-found'
            ? '이미 제거된 자료원입니다. 목록을 새로 고쳤습니다.'
            : `${result.sourceName}: 메일 ${result.removedMessages}개를 제거하고 공유 메일 ${result.preservedMessages}개를 유지했습니다. 원본 파일은 그대로입니다.${result.importCancelled ? ' 이 자료원을 가져오던 작업은 취소했습니다.' : ''}`
        )
      } finally {
        setMaintenance(null)
      }
    }, '자료원을 제거하지 못했습니다.')
  }

  const conditionsChanged =
    conditions.query !== applied.query || conditions.sourceId !== applied.sourceId
  const emptyLabel = applied.query.trim()
    ? '검색 결과가 없습니다.'
    : stats?.totalMessages
      ? '검색어를 입력한 뒤 검색을 실행하세요.'
      : '파일을 추가하면 보관한 메일이 여기에 표시됩니다.'

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
            onClick={() => runImport(mailArchiveApi.importFiles)}
            disabled={busy || maintenance !== null}
            className="rounded-r4 bg-fill-uncontained-active px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-fill-uncontained-hover disabled:opacity-50"
          >
            파일 추가
          </button>
          <button
            type="button"
            onClick={() => runImport(mailArchiveApi.importEmlFolder)}
            disabled={busy || maintenance !== null}
            className="rounded-r4 border border-border bg-panel px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-fill-uncontained-hover disabled:opacity-50"
          >
            EML 폴더 추가
          </button>
          {busy && progress && (
            <button
              type="button"
              onClick={() =>
                run(
                  async () => void (await mailArchiveApi.cancel(progress.jobId)),
                  '취소하지 못했습니다.'
                )
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
        {busy && progress && (
          <span className="text-ink">
            가져오는 중: {progress.processedFiles}/{progress.totalFiles} 파일 · 처리{' '}
            {progress.processedMessages}개 · 새 저장 {progress.insertedMessages}개 · 이미 보관{' '}
            {progress.skippedMessages}개{progress.currentPath ? ` · ${progress.currentPath}` : ''}
          </span>
        )}
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
                    {source.kind.toUpperCase()} · {source.name}
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
                  disabled={maintenance !== null}
                  onClick={() => removeSource(source.id)}
                  className="rounded-r4 border border-border px-2.5 py-1.5 text-[11.5px] text-ink3 hover:bg-fill-uncontained-hover hover:text-ink disabled:opacity-50"
                >
                  {maintenance?.kind === 'remove' && maintenance.id === source.id
                    ? '제거 중…'
                    : '자료원 제거'}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-r4 border border-red-300/40 bg-red-50/40 px-3 py-2 text-[12px] text-red-700"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 whitespace-pre-line rounded-r4 border border-border bg-panel px-3 py-2 text-[12px] text-ink3">
          {notice}
        </div>
      )}

      <form
        className="mb-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          run(() => search(conditions), '검색하지 못했습니다.')
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-r4 border border-border bg-panel px-3 py-2">
          <Icon name="search" size={15} className="text-ink3" />
          <input
            aria-label="메일 제목, 보낸 사람, 받는 사람, 본문, 첨부파일 이름 검색어"
            value={conditions.query}
            onChange={(event) => setConditions({ ...conditions, query: event.target.value })}
            placeholder="제목, 사람, 본문, 첨부파일 이름 검색"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink3"
          />
        </label>
        <select
          aria-label="검색할 자료원"
          value={conditions.sourceId}
          onChange={(event) => setConditions({ ...conditions, sourceId: event.target.value })}
          className="max-w-56 rounded-r4 border border-border bg-panel px-3 text-[12px] text-ink outline-none"
        >
          <option value={ALL_SOURCES}>전체 자료원</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.kind.toUpperCase()} · {source.name}
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
          : conditionsChanged
            ? '검색 조건이 바뀌었습니다. 검색을 실행하면 결과가 갱신됩니다.'
            : ''}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <section
          className={`min-w-0 flex-1 overflow-y-auto rounded-r5 border border-border bg-panel ${selection ? 'hidden lg:block' : 'block'}`}
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
                  onClick={() => openMessage(result.id)}
                  className={`block w-full px-4 py-3 text-left hover:bg-fill-uncontained-hover ${selection?.message.id === result.id ? 'bg-fill-uncontained-active' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <strong className="min-w-0 truncate text-[13px] font-medium text-ink">
                      {result.subject || '(제목 없음)'}
                    </strong>
                    <span className="shrink-0 text-[11px] text-ink3">
                      {result.date ? formatDate(result.date) : '날짜 미상'}
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
          className={`min-w-0 flex-1 overflow-y-auto rounded-r5 border border-border bg-panel ${selection ? 'block' : 'hidden lg:block'}`}
        >
          {selection ? (
            <MailMessageDetail
              key={selection.message.id}
              message={selection.message}
              thread={selection.thread}
              formatDate={formatDate}
              exportingAttachmentId={maintenance?.kind === 'export' ? maintenance.id : null}
              exportDisabled={busy || maintenance !== null}
              onOpen={openMessage}
              onClose={clearSelection}
              onExportAttachment={exportAttachment}
            />
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
