import type Database from 'better-sqlite3'
import { MailArchiveSearchRequestSchema } from '../../../../shared/mail-archive'
import type {
  MailArchiveAttachment,
  MailArchiveBodySegment,
  MailArchiveMessage,
  MailArchiveSearchHit,
  MailArchiveSearchRequest,
  MailArchiveThreadRequest,
  MailArchiveThreadResult
} from '../../../../shared/mail-archive'
import type { ArchiveReadScope } from '../../../../shared/mail-archive-plugin'
import { archiveScopeSql } from './scope-sql'
import {
  archiveHit,
  archiveMessage,
  archiveQueryTerms,
  type ArchiveHitRow,
  type ArchiveMessageRow
} from './store-records'

export interface MailArchiveReads {
  search(request: MailArchiveSearchRequest, scope?: ArchiveReadScope): MailArchiveSearchHit[]
  get(id: string, scope?: ArchiveReadScope): MailArchiveMessage | null
  thread(request: MailArchiveThreadRequest, scope?: ArchiveReadScope): MailArchiveThreadResult
}
function ftsQuery(terms: readonly string[]): string {
  return terms.map((token) => `"${token.replaceAll('"', '""')}"`).join(' AND ')
}

function escapeLike(value: string): string {
  return `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
}

function findOccurrenceColumnSql(column: 'source_path' | 'folder_path', filter = ''): string {
  const selected = `o.${column}`
  return `SELECT ${selected}
    FROM archive_verified_occurrence o WHERE o.mail_id=m.id${filter}
    ORDER BY o.verified_at DESC, o.revision DESC LIMIT 1`
}

function hitColumns(occurrence: string, scopedFolder: boolean): string {
  const folder = `(${findOccurrenceColumnSql('folder_path', occurrence)})`
  return `m.id, m.source_kind,
    COALESCE((${findOccurrenceColumnSql('source_path', occurrence)}), m.source_path) AS source_path,
    ${scopedFolder ? folder : `COALESCE(${folder}, m.folder_path)`} AS folder_path,
    m.sent_at, m.from_addr, m.to_addrs, m.cc_addrs, m.subject, m.body_text, m.attachment_names`
}
export function createArchiveStoreReads(
  db: Database.Database,
  ensureRelations: () => void
): MailArchiveReads {
  const selectAttachments = db.prepare(
    'SELECT id, name, mime_type AS mimeType, size_bytes AS sizeBytes FROM archive_attachment WHERE mail_id=? ORDER BY rowid'
  )

  const selectSegments = db.prepare(
    `SELECT ordinal, start_offset AS start, end_offset AS end,
        kind, rule_id AS ruleId, classifier_revision AS classifierRevision,
        confidence_class AS confidenceClass FROM archive_body_segment
        WHERE mail_id=? ORDER BY ordinal`
  )

  return {
    search: (input, scope) => {
      const request = MailArchiveSearchRequestSchema.parse(input)
      const access = archiveScopeSql(scope)
      const limit = request.limit ?? 30
      const terms = archiveQueryTerms(request.query)
      const parameters: Record<string, string | number> = { limit, ...access.parameters }
      let occurrenceFilter = access.occurrence
      for (const [key, column] of [
        ['sourceKind', 'source_kind'],
        ['sourceId', 'source_id'],
        ['folderPath', 'folder_path']
      ] as const) {
        const value = request[key]
        if (!value) continue
        parameters[key] = key === 'folderPath' ? escapeLike(value) : value
        occurrenceFilter +=
          key === 'folderPath'
            ? ` AND o.${column} LIKE @${key} ESCAPE '\\'`
            : ` AND o.${column}=@${key}`
      }
      let fieldFilters = access.date
      for (const [key, column] of [
        ['from', 'from_addr'],
        ['to', 'to_addrs'],
        ['cc', 'cc_addrs']
      ] as const) {
        if (!request[key]) continue
        parameters[key] = escapeLike(request[key])
        fieldFilters += ` AND m.${column} LIKE @${key} ESCAPE '\\'`
      }
      if (request.attachmentName) {
        parameters.attachmentName = escapeLike(request.attachmentName)
        fieldFilters += ` AND EXISTS (SELECT 1 FROM archive_attachment a
          WHERE a.mail_id=m.id AND a.name LIKE @attachmentName ESCAPE '\\')`
      }
      if (request.sentAfter !== undefined) {
        parameters.sentAfter = request.sentAfter
        fieldFilters += ' AND m.sent_at>=@sentAfter'
      }
      if (request.sentBefore !== undefined) {
        parameters.sentBefore = request.sentBefore
        fieldFilters += ' AND m.sent_at<@sentBefore'
      }
      const hasShortTerm = terms.some((term) => [...term].length < 3)
      const visibleMail = `EXISTS (
        SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id${occurrenceFilter}
      )`
      const select = `SELECT ${hitColumns(occurrenceFilter, true)}, `

      let rows: unknown[]
      if (terms.length > 0 && !hasShortTerm) {
        rows = db
          .prepare(
            `${select}bm25(archive_mail_fts) AS rank
             FROM archive_mail_fts f JOIN archive_mail m ON m.rowid=f.rowid
             WHERE archive_mail_fts MATCH @query AND ${visibleMail}${fieldFilters}
             ORDER BY rank, COALESCE(m.sent_at, m.imported_at) DESC, m.id LIMIT @limit`
          )
          .all({ ...parameters, query: ftsQuery(terms) })
      } else {
        const termFilters = terms.map((term, index) => {
          parameters[`term${index}`] = escapeLike(term)
          return `(m.from_addr || ' ' || m.to_addrs || ' ' || m.cc_addrs || ' ' || m.subject || ' ' || m.body_text || ' ' || m.attachment_names) LIKE @term${index} ESCAPE '\\'`
        })
        const filter = termFilters.length > 0 ? ` AND ${termFilters.join(' AND ')}` : ''
        rows = db
          .prepare(
            `${select}0 AS rank
             FROM archive_mail m
             WHERE ${visibleMail}${fieldFilters}${filter}
             ORDER BY COALESCE(m.sent_at, m.imported_at) DESC, m.id LIMIT @limit`
          )
          .all(parameters)
      }
      return (rows as ArchiveHitRow[]).map((row) => archiveHit(row, request.query))
    },
    get: (id, scope) => {
      const access = archiveScopeSql(scope)
      const row = db
        .prepare(
          `
          SELECT ${hitColumns(access.occurrence, Boolean(scope))}, m.imported_at,
            m.message_id, m.in_reply_to, m.references_header, m.thread_key,
            m.body_kind, m.body_alternate_text, m.body_alternate_kind, m.body_alternate_omitted,
            m.body_quality_flags, m.body_selection_reason,
            0 AS rank
          FROM archive_mail m WHERE m.id=@id AND EXISTS (
            SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id${access.occurrence}
          )${access.date}
        `
        )
        .get({ id, ...access.parameters }) as ArchiveMessageRow | undefined
      if (!row) return null
      const attachments = selectAttachments.all(id) as MailArchiveAttachment[]
      const segments = selectSegments.all(id) as MailArchiveBodySegment[]
      return archiveMessage(row, attachments, segments)
    },
    thread: (request, scope) => {
      const access = archiveScopeSql(scope)
      ensureRelations()
      const limit = request.limit ?? 50
      const rows = db
        .prepare(
          `
          WITH RECURSIVE connected(id) AS (
            SELECT m.id FROM archive_mail m
            WHERE m.id=@id AND EXISTS (
              SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id${access.occurrence}
            )${access.date}
            UNION
            SELECT CASE WHEN relation.child_mail_id=connected.id
              THEN relation.parent_mail_id ELSE relation.child_mail_id END
            FROM archive_mail_relation relation
            JOIN connected
              ON relation.child_mail_id=connected.id OR relation.parent_mail_id=connected.id
            JOIN archive_mail m ON m.id=CASE WHEN relation.child_mail_id=connected.id
              THEN relation.parent_mail_id ELSE relation.child_mail_id END
            WHERE relation.resolution='resolved' AND relation.parent_mail_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM archive_verified_occurrence o
                WHERE o.mail_id=m.id${access.occurrence})${access.date}
            LIMIT @limit
          )
          SELECT ${hitColumns(access.occurrence, Boolean(scope))}, 0 AS rank
          FROM connected JOIN archive_mail m ON m.id=connected.id
          WHERE EXISTS (
            SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id${access.occurrence}
          )${access.date}
          ORDER BY m.sent_at IS NULL, m.sent_at, m.id
        `
        )
        .all({ id: request.id, limit: limit + 1, ...access.parameters }) as ArchiveHitRow[]
      const truncated = rows.length > limit
      const selectedRows = rows.slice(0, limit)
      const ids = selectedRows.map((row) => row.id)
      const relations =
        ids.length === 0
          ? []
          : (db
              .prepare(
                `
                SELECT child_mail_id AS childMailId, parent_mail_id AS parentMailId, kind
                FROM archive_mail_relation
                WHERE resolution='resolved'
                  AND child_mail_id IN (${ids.map(() => '?').join(',')})
                  AND parent_mail_id IN (${ids.map(() => '?').join(',')})
                ORDER BY child_mail_id, parent_mail_id, kind
              `
              )
              .all(...ids, ...ids) as MailArchiveThreadResult['relations'])
      return {
        mails: selectedRows.map((row) => archiveHit(row, '')),
        relations,
        truncated
      }
    }
  }
}
