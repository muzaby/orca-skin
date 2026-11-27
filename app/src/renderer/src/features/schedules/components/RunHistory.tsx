import { useEffect, useState } from 'react'
import { useI18n, type MessageKey } from '../../../shared/i18n'
import { runErrorKey } from '../lib/runError'
import { formatDateTime } from '../lib/triggerLabel'
import { Button } from '../../../shared/ui/Button'
import { type ScheduledRun, type ScheduledRunStatus } from '../../../../../shared/scheduled-tasks'

const STATUS_KEYS: Record<ScheduledRunStatus, MessageKey> = {
  running: 'schedules.history.statusRunning',
  success: 'schedules.history.statusSuccess',
  error: 'schedules.history.statusError',
  skipped: 'schedules.history.statusSkipped'
}

const STATUS_TONE: Record<ScheduledRunStatus, string> = {
  running: 'text-ink',
  success: 'text-ink2',
  error: 'text-danger',
  skipped: 'text-ink3'
}

// Large stored tails are laid out only when their run is opened.
const INLINE_OUTPUT_LIMIT = 4_096
const OUTPUT_CLASS =
  'mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-r3 bg-fill-uncontained-hover p-2 font-mono text-caption text-ink2'

function RunOutput({ output }: { output: string }): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  if (output.length <= INLINE_OUTPUT_LIMIT) return <pre className={OUTPUT_CLASS}>{output}</pre>
  return (
    <details className="mt-1.5" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-caption text-ink2">
        {tr('schedules.history.output')}
      </summary>
      {open && <pre className={OUTPUT_CLASS}>{output}</pre>}
    </details>
  )
}

interface RunHistoryProps {
  // null = 불러오는 중.
  runs: readonly ScheduledRun[] | null
  onOpenSession: (sessionId: string) => void
}

// 실행 이력 목록 — 최신순. 상태를 갖지 않는다.
export function RunHistory({ runs, onOpenSession }: RunHistoryProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  if (runs == null) {
    return (
      <p role="status" className="px-3 py-3 text-caption text-ink3">
        {tr('common.loading')}
      </p>
    )
  }
  if (runs.length === 0) {
    return (
      <p role="status" className="px-3 py-3 text-caption text-ink3">
        {tr('schedules.history.empty')}
      </p>
    )
  }
  return (
    <ul
      data-schedule-history=""
      aria-label={tr('schedules.history.title')}
      className="m-0 flex list-none flex-col gap-2 px-3 pb-3 pt-1"
    >
      {runs.map((run) => {
        const errorKey = run.error ? runErrorKey(run.error) : null
        return (
          <li
            key={run.id}
            data-schedule-run={run.status}
            className="rounded-r4 border border-border px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
              <span className={`font-medium ${STATUS_TONE[run.status]}`}>
                {tr(STATUS_KEYS[run.status])}
              </span>
              <span className="text-ink3">{formatDateTime(run.startedAt, locale)}</span>
              <span className="text-ink3">
                {tr(
                  run.origin === 'manual'
                    ? 'schedules.history.originManual'
                    : 'schedules.history.originSchedule'
                )}
              </span>
              {run.exitCode != null && (
                <span className="text-ink3">
                  {tr('schedules.history.exitCode', { code: run.exitCode })}
                </span>
              )}
              {run.error && (
                <span className="min-w-0 break-words text-ink2">
                  {errorKey ? tr(errorKey) : run.error}
                </span>
              )}
              {run.sessionId && (
                <Button
                  size="small"
                  className="ml-auto"
                  onClick={() => onOpenSession(run.sessionId!)}
                >
                  {tr('schedules.history.openSession')}
                </Button>
              )}
            </div>
            {run.output ? (
              <>
                {run.outputTruncated && (
                  <p className="mt-1.5 text-caption text-ink3">
                    {tr('schedules.history.truncated')}
                  </p>
                )}
                <RunOutput output={run.output} />
              </>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

interface RunHistoryPanelProps {
  taskId: string
  // 바뀌면 다시 읽는다(변경 push).
  revision: number
  loadRuns: (taskId: string) => Promise<ScheduledRun[]>
  onOpenSession: (sessionId: string) => void
}

export function RunHistoryPanel({
  taskId,
  revision,
  loadRuns,
  onOpenSession
}: RunHistoryPanelProps): React.JSX.Element {
  const [loaded, setLoaded] = useState<{ taskId: string; runs: ScheduledRun[] } | null>(null)
  useEffect(() => {
    let stale = false
    void loadRuns(taskId).then(
      (next) => {
        // 늦게 도착한 이전 조회가 최신 목록을 덮지 않게 한다.
        if (!stale) setLoaded({ taskId, runs: next })
      },
      () => {
        if (!stale) setLoaded({ taskId, runs: [] })
      }
    )
    return () => {
      stale = true
    }
  }, [taskId, revision, loadRuns])
  return (
    <RunHistory
      runs={loaded?.taskId === taskId ? loaded.runs : null}
      onOpenSession={onOpenSession}
    />
  )
}
