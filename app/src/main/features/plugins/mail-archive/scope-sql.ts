import type { ArchiveReadScope } from '../../../../shared/mail-archive-plugin'

/** The same verified occurrence carries both source and folder constraints. */
export function archiveScopeSql(scope: ArchiveReadScope | undefined): {
  occurrence: string
  date: string
  parameters: Record<string, string | number>
} {
  if (!scope) return { occurrence: '', date: '', parameters: {} }
  const parameters: Record<string, string | number> = {}
  const ids = scope.sourceIds.map((id, index) => {
    parameters[`archiveSource${index}`] = id
    return `@archiveSource${index}`
  })
  let date = ''
  if (scope.sentAfter !== undefined) {
    parameters.archiveAfter = scope.sentAfter
    date += ' AND m.sent_at>=@archiveAfter'
  }
  if (scope.sentBefore !== undefined) {
    parameters.archiveBefore = scope.sentBefore
    date += ' AND m.sent_at<@archiveBefore'
  }
  return {
    occurrence: ids.length ? ` AND o.source_id IN (${ids.join(',')})` : ' AND 0',
    date,
    parameters
  }
}
