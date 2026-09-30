import { useI18n } from '../../shared/i18n'
import type { MailArchiveSource } from '../../../../shared/mail-archive'
import type { ArchiveSearchFields } from './search-request'

export function MailArchiveSearchForm({
  fields,
  sources,
  onChange,
  onSearch
}: {
  fields: ArchiveSearchFields
  sources: readonly MailArchiveSource[]
  onChange(fields: ArchiveSearchFields): void
  onSearch(): void
}): React.JSX.Element {
  const { tr: t } = useI18n()
  const sourceMissing =
    !['all', 'eml', 'pst'].includes(fields.source) &&
    !sources.some((source) => source.id === fields.source)
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSearch()
      }}
      className="mb-3 space-y-2"
    >
      <div className="flex flex-wrap gap-2">
        <input
          aria-label={t('mailArchive.query')}
          value={fields.query}
          maxLength={500}
          onChange={(event) => onChange({ ...fields, query: event.target.value })}
          placeholder={t('mailArchive.queryPlaceholder')}
          className="min-w-40 flex-1 rounded-r4 border border-border bg-panel px-3 py-2 text-[13px] text-ink outline-none focus:border-ink3"
        />
        <select
          aria-label={t('mailArchive.source')}
          value={fields.source}
          onChange={(event) => onChange({ ...fields, source: event.target.value })}
          className="max-w-60 rounded-r4 border border-border bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-ink3"
        >
          <option value="all">{t('mailArchive.allSources')}</option>
          <option value="eml">EML</option>
          <option value="pst">PST</option>
          {sourceMissing && <option value={fields.source}>{t('mailArchive.removedSource')}</option>}
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
          {t('mailArchive.search')}
        </button>
      </div>
      <details className="rounded-r4 border border-border bg-panel px-3 py-2 text-[12px] text-ink3">
        <summary className="cursor-pointer">{t('mailArchive.filters')}</summary>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(
            ['from', 'to', 'cc', 'attachmentName', 'folderPath', 'startDate', 'endDate'] as const
          ).map((key) => (
            <label key={key} className="flex flex-col gap-1">
              <span>{t(`mailArchive.${key}`)}</span>
              <input
                type={key === 'startDate' || key === 'endDate' ? 'date' : 'text'}
                value={fields[key]}
                maxLength={500}
                onChange={(event) => onChange({ ...fields, [key]: event.target.value })}
                className="min-w-0 rounded-r4 border border-border bg-bg px-2 py-1.5 text-ink outline-none focus:border-ink3"
              />
            </label>
          ))}
        </div>
        <p className="mt-2">{t('mailArchive.dateHelp')}</p>
      </details>
    </form>
  )
}
