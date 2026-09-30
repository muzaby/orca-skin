import { useEffect, useRef, useState } from 'react'
import type { SessionListItem } from '../../../../shared/ipc'
import type { MailArchiveSource } from '../../../../shared/mail-archive'
import type { ArchivePluginState } from '../../../../shared/mail-archive-plugin'
import { mailArchiveApi, sessionApi } from '../../shared/api/ipc'
import { useI18n } from '../../shared/i18n'
import { archiveSearchRequest, EMPTY_ARCHIVE_SEARCH } from './search-request'

const inputClass = 'rounded-r4 border border-border bg-bg px-3 py-2 text-[12.5px] text-ink'
function calendarInput(time: number | undefined, exclusive = false): string {
  if (time === undefined) return ''
  const date = new Date(time)
  if (exclusive) date.setDate(date.getDate() - 1)
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function MailArchivePluginCard({
  currentSessionId,
  onManageSources
}: {
  currentSessionId: string | null
  onManageSources(): void
}): React.JSX.Element {
  const { tr: t } = useI18n()
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [sessionId, setSessionId] = useState(currentSessionId ?? '')
  const [sources, setSources] = useState<MailArchiveSource[]>([])
  const [state, setState] = useState<ArchivePluginState | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const epoch = useRef(0)
  useEffect(() => {
    const request = ++epoch.current
    Promise.all([
      sessionApi.list(),
      mailArchiveApi.sources(),
      mailArchiveApi.pluginState(sessionId || undefined)
    ])
      .then(([list, availableSources, plugin]) => {
        if (epoch.current !== request) return
        setSessions(list)
        setSources(availableSources)
        setState(plugin)
        setSelected(
          plugin.scope?.sourceIds.filter((id) =>
            availableSources.some((source) => source.id === id)
          ) ?? []
        )
        setStartDate(calendarInput(plugin.scope?.sentAfter))
        setEndDate(calendarInput(plugin.scope?.sentBefore, true))
      })
      .catch(() => {
        if (epoch.current === request) {
          setState(null)
          setNotice(t('mailArchivePlugin.failed'))
        }
      })
      .finally(() => {
        if (epoch.current === request) setLoading(false)
      })
    const invalidate = (): void => {
      epoch.current++
    }
    return invalidate
  }, [sessionId, reload, t])
  const save = async (revoke = false): Promise<void> => {
    if (!sessionId || busy || loading) return
    const dates = archiveSearchRequest({ ...EMPTY_ARCHIVE_SEARCH, startDate, endDate })
    if (!revoke && dates.error) {
      setNotice(t('mailArchivePlugin.invalidDates'))
      return
    }
    const request = ++epoch.current
    setBusy(true)
    setNotice('')
    try {
      const scope = await mailArchiveApi.setScope({
        sessionId,
        sourceIds: revoke ? [] : selected,
        ...(!revoke && dates.request?.sentAfter !== undefined
          ? { sentAfter: dates.request.sentAfter }
          : {}),
        ...(!revoke && dates.request?.sentBefore !== undefined
          ? { sentBefore: dates.request.sentBefore }
          : {})
      })
      if (epoch.current !== request) return
      setState((previous) => (previous ? { ...previous, scope } : previous))
      if (!scope) {
        setSelected([])
        setStartDate('')
        setEndDate('')
      }
      setNotice(t(scope ? 'mailArchivePlugin.saved' : 'mailArchivePlugin.revoked'))
    } catch {
      if (epoch.current === request) setNotice(t('mailArchivePlugin.failed'))
    } finally {
      if (epoch.current === request) setBusy(false)
    }
  }
  return (
    <section
      aria-label={t('mailArchivePlugin.title')}
      data-mail-archive-plugin=""
      className="mb-5 space-y-3 rounded-r6 border border-border bg-panel p-4 text-[12.5px] text-ink2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-ink">{t('mailArchivePlugin.title')}</h2>
        <button
          type="button"
          onClick={onManageSources}
          className="rounded-r4 border border-border px-3 py-1.5 hover:bg-fill-uncontained-hover"
        >
          {t('mailArchive.manage')}
        </button>
      </div>
      <p>{t('mailArchivePlugin.help')}</p>
      <p className="text-ink3">
        {t(
          !state?.registered
            ? 'mailArchivePlugin.inactive'
            : state.available
              ? 'mailArchivePlugin.available'
              : 'mailArchivePlugin.empty'
        )}
      </p>
      {state && (
        <p className="break-words font-mono text-[11px] text-ink3">{state.tools.join(' · ')}</p>
      )}
      <label className="flex flex-col gap-1.5">
        {t('mailArchivePlugin.conversation')}
        <select
          value={sessionId}
          disabled={busy}
          onChange={(event) => {
            setLoading(true)
            setNotice('')
            setSessionId(event.target.value)
          }}
          className={inputClass}
        >
          <option value="">{t('mailArchivePlugin.selectConversation')}</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title ?? session.id}
            </option>
          ))}
        </select>
      </label>
      <fieldset disabled={!sessionId || loading || busy} className="space-y-2">
        <legend className="mb-2 font-medium">{t('mailArchivePlugin.allowedSources')}</legend>
        {sources.map((source) => (
          <label key={source.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.includes(source.id)}
              onChange={(event) =>
                setSelected((previous) =>
                  event.target.checked
                    ? [...previous, source.id]
                    : previous.filter((id) => id !== source.id)
                )
              }
            />
            <span className="min-w-0 break-words">
              {source.name} · {source.kind.toUpperCase()} · {source.messageCount}
            </span>
          </label>
        ))}
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            {t('mailArchive.startDate')}
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            {t('mailArchive.endDate')}
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <p className="text-ink3">{t('mailArchive.dateHelp')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!selected.length}
            onClick={() => void save()}
            className="rounded-r4 bg-fill-uncontained-active px-3 py-2 text-ink disabled:opacity-50"
          >
            {t('mailArchivePlugin.save')}
          </button>
          <button
            type="button"
            onClick={() => void save(true)}
            className="rounded-r4 border border-border px-3 py-2"
          >
            {t('mailArchivePlugin.revoke')}
          </button>
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => {
            setLoading(true)
            setNotice('')
            setReload((value) => value + 1)
          }}
          className="text-rust hover:underline disabled:opacity-50"
        >
          {t('mailArchive.retry')}
        </button>
        <p role="status">
          {loading ? t('common.loading') : busy ? t('mailArchivePlugin.saving') : notice}
        </p>
      </div>
    </section>
  )
}
