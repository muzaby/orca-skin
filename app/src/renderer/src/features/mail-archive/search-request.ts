import type { MailArchiveSearchRequest } from '../../../../shared/mail-archive'
import { MailArchiveSearchRequestSchema } from '../../../../shared/mail-archive'

export interface ArchiveSearchFields {
  query: string
  source: string
  from: string
  to: string
  cc: string
  attachmentName: string
  folderPath: string
  startDate: string
  endDate: string
}

export const EMPTY_ARCHIVE_SEARCH: ArchiveSearchFields = {
  query: '',
  source: 'all',
  from: '',
  to: '',
  cc: '',
  attachmentName: '',
  folderPath: '',
  startDate: '',
  endDate: ''
}

function localCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null
}

export function archiveSearchRequest(
  fields: ArchiveSearchFields
):
  | { request: MailArchiveSearchRequest; error?: never }
  | { error: 'invalidDate' | 'reversedDates' | 'invalidFilters'; request?: never } {
  const start = fields.startDate ? localCalendarDate(fields.startDate) : null
  const end = fields.endDate ? localCalendarDate(fields.endDate) : null
  if ((fields.startDate && !start) || (fields.endDate && !end)) return { error: 'invalidDate' }
  if (start && end && start.getTime() > end.getTime()) return { error: 'reversedDates' }
  // Calendar arithmetic retains the correct next local midnight across DST changes.
  end?.setDate(end.getDate() + 1)
  const parsed = MailArchiveSearchRequestSchema.safeParse({
    query: fields.query,
    ...(fields.source === 'all'
      ? {}
      : fields.source === 'eml' || fields.source === 'pst'
        ? { sourceKind: fields.source }
        : { sourceId: fields.source }),
    ...Object.fromEntries(
      (['from', 'to', 'cc', 'attachmentName', 'folderPath'] as const).flatMap((key) =>
        fields[key].trim() ? [[key, fields[key].trim()]] : []
      )
    ),
    ...(start ? { sentAfter: start.getTime() } : {}),
    ...(end ? { sentBefore: end.getTime() } : {}),
    limit: 50
  })
  return parsed.success ? { request: parsed.data } : { error: 'invalidFilters' }
}
