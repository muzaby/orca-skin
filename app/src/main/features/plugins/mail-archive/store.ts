import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { openFileDatabase } from '../../../infra/db/file-database'
import {
  migrationRecorder,
  readAppliedMigrations,
  type MigrationMetaDb
} from '../../../infra/db/migration-meta'
import migration0001 from './migrations/0001_mail_archive.sql?raw'
import type {
  MailArchiveAttachment,
  MailArchiveMessage,
  MailArchiveSearchHit,
  MailArchiveSearchRequest,
  MailArchiveSourceKind,
  MailArchiveStats
} from '../../../../shared/mail-archive'
import type { NormalizedArchiveMail } from './types'

const MIGRATIONS = [{ name: '0001_mail_archive', sql: migration0001 }] as const

function applyMigrations(db: MigrationMetaDb): void {
  const applied = readAppliedMigrations(db)
  const record = migrationRecorder(db)
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue
    db.exec(migration.sql)
    record(migration.name)
  }
}

function archiveId(mail: NormalizedArchiveMail): string {
  return createHash('sha256')
    .update(`${mail.sourceKind}\0${mail.sourceFingerprint}\0${mail.itemKey}`)
    .digest('hex')
}

function attachmentId(mailId: string, index: number): string {
  return createHash('sha256').update(`${mailId}\0${index}`).digest('hex').slice(0, 32)
}

function sourceName(sourcePath: string): string {
  return basename(sourcePath)
}

function snippet(value: string, query: string): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (!query.trim()) return text.slice(0, 280)
  const index = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase())
  if (index < 0) return text.slice(0, 280)
  const start = Math.max(0, index - 90)
  return `${start > 0 ? '…' : ''}${text.slice(start, index + Math.max(180, query.length + 80)).slice(0, 280)}${start + 280 < text.length ? '…' : ''}`
}

function ftsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replaceAll('"', '""')}"`)
    .join(' AND ')
}

function mapHit(
  row: {
    id: string
    source_kind: MailArchiveSourceKind
    source_path: string
    folder_path: string | null
    sent_at: number | null
    from_addr: string
    to_addrs: string
    cc_addrs: string
    subject: string
    body_text: string
    attachment_names: string
    rank: number
  },
  query: string
): MailArchiveSearchHit {
  const attachmentNames = row.attachment_names ? (JSON.parse(row.attachment_names) as string[]) : []
  return {
    id: row.id,
    sourceKind: row.source_kind,
    sourceName: sourceName(row.source_path),
    folderPath: row.folder_path,
    date: row.sent_at,
    from: row.from_addr,
    to: row.to_addrs,
    cc: row.cc_addrs,
    subject: row.subject,
    snippet: snippet(`${row.subject} ${row.body_text}`, query),
    rank: row.rank,
    attachmentNames
  }
}

function mapMessage(
  row: {
    id: string
    source_kind: MailArchiveSourceKind
    source_path: string
    source_fingerprint: string
    folder_path: string | null
    sent_at: number | null
    imported_at: number
    from_addr: string
    to_addrs: string
    cc_addrs: string
    subject: string
    body_text: string
    message_id: string | null
    in_reply_to: string | null
    references_header: string | null
    thread_key: string
    attachment_names: string
    rank: number
  },
  attachments: readonly MailArchiveAttachment[]
): MailArchiveMessage {
  const attachmentNames = row.attachment_names ? (JSON.parse(row.attachment_names) as string[]) : []
  return {
    id: row.id,
    sourceKind: row.source_kind,
    sourceName: sourceName(row.source_path),
    folderPath: row.folder_path,
    date: row.sent_at,
    from: row.from_addr,
    to: row.to_addrs,
    cc: row.cc_addrs,
    subject: row.subject,
    snippet: snippet(`${row.subject} ${row.body_text}`, ''),
    rank: row.rank,
    attachmentNames,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.references_header,
    threadKey: row.thread_key,
    bodyText: row.body_text,
    importedAt: row.imported_at,
    attachments
  }
}

export interface MailArchiveStore {
  readonly dbPath: string
  upsert(mail: NormalizedArchiveMail, importedAt?: number): { id: string; inserted: boolean }
  search(request: MailArchiveSearchRequest): MailArchiveSearchHit[]
  get(id: string): MailArchiveMessage | null
  stats(): MailArchiveStats
  close(): void
}

export function createMailArchiveStore(rootDir: string): MailArchiveStore {
  const archiveRoot = join(rootDir, 'mail-archive')
  mkdirSync(archiveRoot, { recursive: true })
  const dbPath = join(archiveRoot, 'archive.db')
  const db = openFileDatabase(dbPath, { initialize: (connection) => applyMigrations(connection) })
  const insertMail = db.prepare(`
    INSERT INTO archive_mail (
      id, source_kind, source_path, source_fingerprint, item_key, folder_path, sent_at, imported_at,
      from_addr, to_addrs, cc_addrs, subject, body_text, message_id, in_reply_to, references_header,
      thread_key, attachment_names, size_bytes
    ) VALUES (
      @id, @sourceKind, @sourcePath, @sourceFingerprint, @itemKey, @folderPath, @sentAt, @importedAt,
      @from, @to, @cc, @subject, @bodyText, @messageId, @inReplyTo, @references,
      @threadKey, @attachmentNames, @sizeBytes
    )
    ON CONFLICT(source_kind, source_fingerprint, item_key) DO UPDATE SET
      source_path=excluded.source_path,
      folder_path=excluded.folder_path,
      sent_at=excluded.sent_at,
      imported_at=excluded.imported_at,
      from_addr=excluded.from_addr,
      to_addrs=excluded.to_addrs,
      cc_addrs=excluded.cc_addrs,
      subject=excluded.subject,
      body_text=excluded.body_text,
      message_id=excluded.message_id,
      in_reply_to=excluded.in_reply_to,
      references_header=excluded.references_header,
      thread_key=excluded.thread_key,
      attachment_names=excluded.attachment_names,
      size_bytes=excluded.size_bytes
  `)
  const transaction = db.transaction((mail: NormalizedArchiveMail, importedAt: number) => {
    const id = archiveId(mail)
    const existing = db
      .prepare(
        'SELECT id FROM archive_mail WHERE source_kind=? AND source_fingerprint=? AND item_key=?'
      )
      .get(mail.sourceKind, mail.sourceFingerprint, mail.itemKey) as { id: string } | undefined
    insertMail.run({
      id,
      sourceKind: mail.sourceKind,
      sourcePath: mail.sourcePath,
      sourceFingerprint: mail.sourceFingerprint,
      itemKey: mail.itemKey,
      folderPath: mail.folderPath,
      sentAt: mail.sentAt,
      importedAt,
      from: mail.from,
      to: mail.to,
      cc: mail.cc,
      subject: mail.subject,
      bodyText: mail.bodyText,
      messageId: mail.messageId,
      inReplyTo: mail.inReplyTo,
      references: mail.references,
      threadKey: mail.threadKey,
      attachmentNames: JSON.stringify(mail.attachments.map((attachment) => attachment.name)),
      sizeBytes: mail.sizeBytes
    })
    db.prepare('DELETE FROM archive_attachment WHERE mail_id=?').run(id)
    const insertAttachment = db.prepare(
      'INSERT INTO archive_attachment (id, mail_id, name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)'
    )
    mail.attachments.forEach((attachment, index) => {
      insertAttachment.run(
        attachmentId(id, index),
        id,
        attachment.name,
        attachment.mimeType,
        attachment.sizeBytes
      )
    })
    return { id, inserted: !existing }
  })

  return {
    dbPath,
    upsert: (mail, importedAt = Date.now()) => transaction(mail, importedAt),
    search: (request) => {
      const limit = request.limit ?? 30
      const sourceClause = request.sourceKind ? ' AND m.source_kind = ?' : ''
      const params: (string | number)[] = request.sourceKind ? [request.sourceKind] : []
      let rows: unknown[]
      if (request.query.trim().length >= 3) {
        const query = ftsQuery(request.query)
        rows = db
          .prepare(
            `SELECT m.id, m.source_kind, m.source_path, m.folder_path, m.sent_at, m.from_addr, m.to_addrs, m.cc_addrs, m.subject, m.body_text, m.attachment_names, bm25(archive_mail_fts) AS rank
             FROM archive_mail_fts f JOIN archive_mail m ON m.rowid=f.rowid
             WHERE archive_mail_fts MATCH ?${sourceClause} ORDER BY rank, COALESCE(m.sent_at, m.imported_at) DESC LIMIT ?`
          )
          .all(query, ...params, limit)
      } else {
        const like = `%${request.query.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
        const filter = request.query.trim()
          ? ` AND (m.from_addr || ' ' || m.to_addrs || ' ' || m.cc_addrs || ' ' || m.subject || ' ' || m.body_text || ' ' || m.attachment_names) LIKE ? ESCAPE '\\'`
          : ''
        rows = db
          .prepare(
            `SELECT m.id, m.source_kind, m.source_path, m.folder_path, m.sent_at, m.from_addr, m.to_addrs, m.cc_addrs, m.subject, m.body_text, m.attachment_names, 0 AS rank
             FROM archive_mail m WHERE 1=1${sourceClause}${filter}
             ORDER BY COALESCE(m.sent_at, m.imported_at) DESC LIMIT ?`
          )
          .all(...params, ...(request.query.trim() ? [like] : []), limit)
      }
      return (rows as Parameters<typeof mapHit>[0][]).map((row) => mapHit(row, request.query))
    },
    get: (id) => {
      const row = db.prepare('SELECT *, 0 AS rank FROM archive_mail WHERE id=?').get(id) as
        Parameters<typeof mapMessage>[0] | undefined
      if (!row) return null
      const attachments = db
        .prepare(
          'SELECT id, name, mime_type AS mimeType, size_bytes AS sizeBytes FROM archive_attachment WHERE mail_id=? ORDER BY rowid'
        )
        .all(id) as MailArchiveAttachment[]
      return mapMessage(row, attachments)
    },
    stats: () => {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS total, SUM(CASE WHEN source_kind='eml' THEN 1 ELSE 0 END) AS eml, SUM(CASE WHEN source_kind='pst' THEN 1 ELSE 0 END) AS pst, MAX(imported_at) AS latest FROM archive_mail`
        )
        .get() as { total: number; eml: number | null; pst: number | null; latest: number | null }
      return {
        totalMessages: row.total,
        emlMessages: row.eml ?? 0,
        pstMessages: row.pst ?? 0,
        lastImportedAt: row.latest
      }
    },
    close: () => db.close()
  }
}
