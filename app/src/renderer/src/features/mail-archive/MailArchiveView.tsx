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
  const [stats, setStats] = useState<MailArchiveStats | null>(null)
  const [progress, setProgress] = useState<MailArchiveProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const searchSequence = useRef(0)

  const loadStats = async (): Promise<void> => {
    setStats(await mailArchiveApi.stats())
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
      setSelected((current) =>
        current && found.some((result) => result.id === current.id) ? current : null
      )
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
    const message = await mailArchiveApi.get({ id })
    setSelected(message)
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
            disabled={busy}
            className="rounded-r4 bg-fill-uncontained-active px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-fill-uncontained-hover disabled:opacity-50"
          >
            파일 추가
          </button>
          <button
            type="button"
            onClick={() => void pickFolder()}
            disabled={busy}
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
                onClick={() => setSelected(null)}
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
              <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-[1.7] text-ink2">
                {selected.bodyText || '(본문 없음)'}
              </pre>
              {selected.attachments.length > 0 && (
                <div className="mt-5 border-t border-border pt-4 text-[12px] text-ink3">
                  <div className="mb-2 font-medium text-ink">첨부파일 이름</div>
                  {selected.attachments.map((attachment) => (
                    <div key={attachment.id}>
                      {attachment.name} · {attachment.sizeBytes.toLocaleString()} bytes
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
