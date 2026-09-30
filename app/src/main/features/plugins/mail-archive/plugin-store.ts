import { createHash, randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { ArchiveScopeSchema } from '../../../../shared/mail-archive-plugin'
import type {
  ArchivePluginRequest,
  ArchivePluginResponse,
  ArchiveScopeLease,
  ArchiveReadScope,
  ArchiveEvidence
} from '../../../../shared/mail-archive-plugin'
import type { MailArchiveStore } from './store'

type ScopeRow = {
  source_ids: string
  sent_after: number | null
  sent_before: number | null
  token: string
}
const bodyHash = (body: string): string => createHash('sha256').update(body).digest('hex')

export function createArchivePluginStore(
  db: Database.Database,
  reads: Pick<MailArchiveStore, 'search' | 'get' | 'thread'>
): {
  request(input: ArchivePluginRequest): ArchivePluginResponse
} {
  const revision = (): number =>
    (
      db.prepare('SELECT revision FROM archive_plugin_revision WHERE id=1').get() as {
        revision: number
      }
    ).revision
  const scope = (sessionId: string): ArchiveScopeLease | null => {
    const row = db
      .prepare('SELECT * FROM archive_session_scope WHERE session_id=?')
      .get(sessionId) as ScopeRow | undefined
    if (!row) return null
    return {
      sessionId,
      token: row.token,
      sourceIds: JSON.parse(row.source_ids) as string[],
      corpusRevision: revision(),
      ...(row.sent_after !== null ? { sentAfter: row.sent_after } : {}),
      ...(row.sent_before !== null ? { sentBefore: row.sent_before } : {})
    }
  }
  const assertLease = (lease: ArchiveScopeLease): void => {
    const current = scope(lease.sessionId)
    if (!current || current.token !== lease.token) throw new Error('mail_archive_scope_required')
    if (current.corpusRevision !== lease.corpusRevision)
      throw new Error('mail_archive_index_changed')
    // A caller cannot fabricate a wider lease, even across a process boundary.
    if (
      current.sentAfter !== lease.sentAfter ||
      current.sentBefore !== lease.sentBefore ||
      current.sourceIds.length !== lease.sourceIds.length ||
      current.sourceIds.some((id, index) => id !== lease.sourceIds[index])
    )
      throw new Error('mail_archive_out_of_scope')
  }
  return {
    request(input): ArchivePluginResponse {
      if ('lease' in input) assertLease(input.lease)
      switch (input.operation) {
        case 'scope':
          return scope(input.sessionId)
        case 'assert':
          return null
        case 'prune': {
          const retained = new Set(input.sessionIds)
          db.transaction(() => {
            const ids = db
              .prepare(
                'SELECT session_id FROM archive_session_scope UNION SELECT session_id FROM archive_evidence'
              )
              .all() as { session_id: string }[]
            for (const { session_id: id } of ids)
              if (!retained.has(id)) {
                db.prepare('DELETE FROM archive_session_scope WHERE session_id=?').run(id)
                db.prepare('DELETE FROM archive_evidence WHERE session_id=?').run(id)
              }
          })()
          return null
        }
        case 'setScope': {
          const value = ArchiveScopeSchema.parse(input.input)
          return db.transaction(() => {
            if (!value.sourceIds.length) {
              db.prepare('DELETE FROM archive_session_scope WHERE session_id=?').run(
                value.sessionId
              )
              return null
            }
            for (const id of value.sourceIds) {
              if (!db.prepare('SELECT 1 FROM archive_source WHERE source_id=?').get(id))
                throw new Error('mail_archive_scope_invalid')
            }
            db.prepare(
              `INSERT INTO archive_session_scope VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(session_id) DO UPDATE SET source_ids=excluded.source_ids,
              sent_after=excluded.sent_after, sent_before=excluded.sent_before, token=excluded.token`
            ).run(
              value.sessionId,
              JSON.stringify(value.sourceIds),
              value.sentAfter ?? null,
              value.sentBefore ?? null,
              randomUUID()
            )
            return {
              sourceIds: value.sourceIds,
              ...(value.sentAfter !== undefined ? { sentAfter: value.sentAfter } : {}),
              ...(value.sentBefore !== undefined ? { sentBefore: value.sentBefore } : {})
            } satisfies ArchiveReadScope
          })()
        }
        case 'dispose': {
          db.transaction(() => {
            db.prepare('DELETE FROM archive_session_scope WHERE session_id=?').run(input.sessionId)
            db.prepare('DELETE FROM archive_evidence WHERE session_id=?').run(input.sessionId)
          })()
          return null
        }
        case 'search':
          return reads.search(input.query, input.lease)
        case 'get':
          return reads.get(input.id, input.lease)
        case 'thread':
          return reads.thread({ id: input.id, limit: input.limit }, input.lease)
        case 'evidence':
          return db.transaction(() => {
            if (input.spans.length > 6) throw new Error('mail_archive_invalid_input')
            const runId = randomUUID()
            const insert = db.prepare('INSERT INTO archive_evidence VALUES (?, ?, ?, ?, ?, ?, ?)')
            return input.spans.map((span): ArchiveEvidence => {
              const mail = reads.get(span.mailId, input.lease)
              if (
                !mail ||
                !Number.isInteger(span.start) ||
                !Number.isInteger(span.end) ||
                span.start < 0 ||
                span.end <= span.start ||
                span.end > mail.bodyText.length ||
                span.end - span.start > 1500
              )
                throw new Error('mail_archive_out_of_scope')
              const id = randomUUID()
              insert.run(
                id,
                input.lease.sessionId,
                runId,
                mail.id,
                span.start,
                span.end,
                bodyHash(mail.bodyText)
              )
              return {
                id,
                mailId: mail.id,
                start: span.start,
                end: span.end,
                text: mail.bodyText.slice(span.start, span.end),
                subject: mail.subject,
                from: mail.from,
                date: mail.date
              }
            })
          })()
        case 'resolve': {
          const row = db
            .prepare('SELECT * FROM archive_evidence WHERE id=? AND session_id=?')
            .get(input.id, input.sessionId) as
            | {
                id: string
                mail_id: string | null
                start_offset: number
                end_offset: number
                body_hash: string
              }
            | undefined
          if (!row) return { state: 'forbidden' }
          if (!row.mail_id) return { state: 'removed' }
          const allowed = scope(input.sessionId)
          if (!allowed) return { state: 'forbidden' }
          const mail = reads.get(row.mail_id, allowed)
          if (!mail || bodyHash(mail.bodyText) !== row.body_hash) return { state: 'forbidden' }
          return {
            state: 'available',
            mail,
            evidence: {
              id: row.id,
              mailId: mail.id,
              start: row.start_offset,
              end: row.end_offset,
              text: mail.bodyText.slice(row.start_offset, row.end_offset),
              subject: mail.subject,
              from: mail.from,
              date: mail.date
            }
          }
        }
      }
    }
  }
}
