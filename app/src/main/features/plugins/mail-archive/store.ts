import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import type Database from 'better-sqlite3'
import { openFileDatabase } from '../../../infra/db/file-database'
import { applyMailArchiveMigrations } from './migrate'
import type {
  MailArchiveAttachment,
  MailArchiveBodyKind,
  MailArchiveBodyQualityFlag,
  MailArchiveBodySelectionReason,
  MailArchiveMessage,
  MailArchiveSearchHit,
  MailArchiveSearchRequest,
  MailArchiveSource,
  MailArchiveSourceDeletion,
  MailArchiveSourceKind,
  MailArchiveThreadRequest,
  MailArchiveThreadResult,
  MailArchiveStats
} from '../../../../shared/mail-archive'
import { archiveMailIdentityKey, archiveSourceId } from './identity'
import { resolveArchiveMailRelations } from './relations'
import type { MailArchiveAttachmentLocation, NormalizedArchiveMail } from './types'

function attachmentId(mailId: string, index: number): string {
  return createHash('sha256').update(`${mailId}\0${index}`).digest('hex').slice(0, 32)
}

function mailId(identityKey: string): string {
  return createHash('sha256').update(`mail\0${identityKey}`).digest('hex')
}

function sourceName(sourcePath: string): string {
  return basename(sourcePath)
}

const BODY_QUALITY_FLAGS = new Set<MailArchiveBodyQualityFlag>([
  'alternative_mismatch',
  'decode_suspect',
  'html_converted',
  'oversized'
])

function parseBodyQualityFlags(value: string): MailArchiveBodyQualityFlag[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed)) throw new Error('mail_archive_body_quality_invalid')
  return parsed.filter(
    (flag): flag is MailArchiveBodyQualityFlag =>
      typeof flag === 'string' && BODY_QUALITY_FLAGS.has(flag as MailArchiveBodyQualityFlag)
  )
}

function queryTerms(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean)
}

function snippet(value: string, query: string): string {
  const text = value.replace(/\s+/g, ' ').trim()
  const terms = queryTerms(query)
  if (terms.length === 0) return text.slice(0, 280)
  const lowered = text.toLocaleLowerCase()
  const index = terms
    .map((term) => lowered.indexOf(term.toLocaleLowerCase()))
    .filter((match) => match >= 0)
    .sort((left, right) => left - right)[0]
  if (index === undefined) return text.slice(0, 280)
  const start = Math.max(0, index - 90)
  return `${start > 0 ? '…' : ''}${text.slice(start, index + Math.max(180, query.length + 80)).slice(0, 280)}${start + 280 < text.length ? '…' : ''}`
}

function ftsQuery(terms: readonly string[]): string {
  return terms.map((token) => `"${token.replaceAll('"', '""')}"`).join(' AND ')
}

function escapeLike(value: string): string {
  return `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
}

function findOccurrenceColumnSql(column: 'source_path' | 'folder_path'): string {
  const selected = `o.${column}`
  return `SELECT ${selected}
    FROM archive_verified_occurrence o WHERE o.mail_id=m.id
    ORDER BY o.verified_at DESC, o.revision DESC LIMIT 1`
}

function rowMail(row: {
  source_kind: MailArchiveSourceKind
  source_id: string | null
  source_path: string
  source_fingerprint: string
  item_key: string
  folder_path: string | null
  sent_at: number | null
  from_addr: string
  to_addrs: string
  cc_addrs: string
  subject: string
  body_text: string
  body_kind: MailArchiveBodyKind
  body_alternate_text: string | null
  body_alternate_kind: Exclude<MailArchiveBodyKind, 'none' | 'legacy'> | null
  body_alternate_omitted: number
  body_quality_flags: string
  body_selection_reason: MailArchiveBodySelectionReason
  message_id: string | null
  in_reply_to: string | null
  references_header: string | null
  thread_key: string
  size_bytes: number
  attachments: readonly Omit<MailArchiveAttachment, 'id'>[]
}): NormalizedArchiveMail {
  const partial: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceKind: row.source_kind,
    sourceId: row.source_id ?? archiveSourceId(row.source_kind, row.source_path),
    sourcePath: row.source_path,
    sourceFingerprint: row.source_fingerprint,
    itemKey: row.item_key,
    folderPath: row.folder_path,
    sentAt: row.sent_at,
    from: row.from_addr,
    to: row.to_addrs,
    cc: row.cc_addrs,
    subject: row.subject,
    bodyText: row.body_text,
    bodyKind: row.body_kind,
    bodyAlternateText: row.body_alternate_text,
    bodyAlternateKind: row.body_alternate_kind,
    bodyAlternateOmitted: row.body_alternate_omitted === 1,
    bodyQualityFlags: parseBodyQualityFlags(row.body_quality_flags),
    bodySelectionReason: row.body_selection_reason,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.references_header,
    threadKey: row.thread_key,
    attachments: row.attachments,
    sizeBytes: row.size_bytes
  }
  return { ...partial, identityKey: archiveMailIdentityKey(partial) }
}

function backfillLegacyRows(db: Database.Database): void {
  const index = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='archive_mail_identity_idx'")
    .get()
  if (index) return

  const rows = db.prepare('SELECT * FROM archive_mail ORDER BY imported_at, id').all() as Array<{
    id: string
    source_kind: MailArchiveSourceKind
    source_path: string
    source_fingerprint: string
    item_key: string
    folder_path: string | null
    sent_at: number | null
    imported_at: number
    from_addr: string
    to_addrs: string
    cc_addrs: string
    subject: string
    body_text: string
    body_kind: MailArchiveBodyKind
    body_alternate_text: string | null
    body_alternate_kind: Exclude<MailArchiveBodyKind, 'none' | 'legacy'> | null
    body_alternate_omitted: number
    body_quality_flags: string
    body_selection_reason: MailArchiveBodySelectionReason
    message_id: string | null
    in_reply_to: string | null
    references_header: string | null
    thread_key: string
    size_bytes: number
  }>
  const getAttachments = db.prepare(
    'SELECT name, mime_type AS mimeType, size_bytes AS sizeBytes FROM archive_attachment WHERE mail_id=? ORDER BY rowid'
  )
  const insertSource = db.prepare(`
    INSERT INTO archive_source (source_id, source_kind, source_path, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(source_id) DO UPDATE SET source_path=excluded.source_path
  `)
  const insertRevision = db.prepare(`
    INSERT OR IGNORE INTO archive_source_revision
      (source_id, revision, fingerprint, state, started_at, verified_at)
    VALUES (?, ?, ?, 'verified', ?, ?)
  `)
  const updateMail = db.prepare('UPDATE archive_mail SET source_id=?, identity_key=? WHERE id=?')
  const insertOccurrence = db.prepare(`
    INSERT OR IGNORE INTO archive_source_occurrence
      (source_id, revision, item_key, mail_id, folder_path)
    VALUES (?, ?, ?, ?, ?)
  `)
  const deleteMail = db.prepare('DELETE FROM archive_mail WHERE id=?')
  const merge = db.transaction(() => {
    const revisionBySourceAndFingerprint = new Map<string, number>()
    const nextRevision = new Map<string, number>()
    const canonicalByIdentity = new Map<string, string>()

    for (const row of rows) {
      const sourceId = archiveSourceId(row.source_kind, row.source_path)
      const sourceRevisionKey = `${sourceId}\0${row.source_fingerprint}`
      let revision = revisionBySourceAndFingerprint.get(sourceRevisionKey)
      if (revision === undefined) {
        revision = (nextRevision.get(sourceId) ?? 0) + 1
        nextRevision.set(sourceId, revision)
        revisionBySourceAndFingerprint.set(sourceRevisionKey, revision)
        insertSource.run(sourceId, row.source_kind, row.source_path, row.imported_at)
        insertRevision.run(
          sourceId,
          revision,
          row.source_fingerprint,
          row.imported_at,
          row.imported_at
        )
      }

      const mail = rowMail({
        ...row,
        source_id: sourceId,
        attachments: getAttachments.all(row.id) as Array<Omit<MailArchiveAttachment, 'id'>>
      })
      const canonicalId = canonicalByIdentity.get(mail.identityKey) ?? row.id
      canonicalByIdentity.set(mail.identityKey, canonicalId)
      if (canonicalId === row.id) updateMail.run(sourceId, mail.identityKey, row.id)
      insertOccurrence.run(sourceId, revision, row.item_key, canonicalId, row.folder_path)
      if (canonicalId !== row.id) deleteMail.run(row.id)
    }

    for (const [sourceId, revision] of nextRevision) {
      const current = db
        .prepare(
          "SELECT revision, fingerprint FROM archive_source_revision WHERE source_id=? AND state='verified' ORDER BY revision DESC LIMIT 1"
        )
        .get(sourceId) as { revision: number; fingerprint: string } | undefined
      if (current) {
        db.prepare(
          'UPDATE archive_source SET current_revision=?, current_fingerprint=? WHERE source_id=?'
        ).run(current.revision, current.fingerprint, sourceId)
      }
      void revision
    }
  })
  merge()
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS archive_mail_identity_idx ON archive_mail(identity_key)'
  )
}

function recoverStagingRevisions(db: Database.Database): void {
  const recover = db.transaction(() => {
    db.exec(`
      DELETE FROM archive_source_occurrence
      WHERE EXISTS (
        SELECT 1 FROM archive_source_revision r
        WHERE r.source_id=archive_source_occurrence.source_id
          AND r.revision=archive_source_occurrence.revision AND r.state='staging'
      );
      UPDATE archive_source_revision SET state='interrupted', verified_at=NULL
      WHERE state='staging';
      DELETE FROM archive_mail WHERE NOT EXISTS (
        SELECT 1 FROM archive_source_occurrence o WHERE o.mail_id=archive_mail.id
      );
    `)
  })
  recover()
}

function rebuildRelations(db: Database.Database): void {
  const visibleMail = db
    .prepare(
      `
      SELECT DISTINCT m.id, m.message_id AS messageId, m.in_reply_to AS inReplyTo,
        m.references_header AS referencesHeader
      FROM archive_mail m
      WHERE EXISTS (
        SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id
      )
      ORDER BY m.id
    `
    )
    .all() as Array<{
    id: string
    messageId: string | null
    inReplyTo: string | null
    referencesHeader: string | null
  }>
  const relations = resolveArchiveMailRelations(
    visibleMail.map(({ referencesHeader, ...message }) => ({
      ...message,
      references: referencesHeader
    }))
  )
  db.prepare('DELETE FROM archive_mail_relation').run()
  const insert = db.prepare(`
    INSERT INTO archive_mail_relation
      (child_mail_id, parent_message_id, parent_mail_id, kind, resolution)
    VALUES (?, ?, ?, ?, ?)
  `)
  for (const relation of relations) {
    insert.run(
      relation.childMailId,
      relation.parentMessageId,
      relation.parentMailId,
      relation.kind,
      relation.resolution
    )
  }
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
    body_kind: MailArchiveBodyKind
    body_alternate_text: string | null
    body_alternate_kind: Exclude<MailArchiveBodyKind, 'none' | 'legacy'> | null
    body_alternate_omitted: number
    body_quality_flags: string
    body_selection_reason: MailArchiveBodySelectionReason
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
    bodyKind: row.body_kind,
    bodyAlternateText: row.body_alternate_text,
    bodyAlternateKind: row.body_alternate_kind,
    bodyAlternateOmitted: row.body_alternate_omitted === 1,
    bodyQualityFlags: parseBodyQualityFlags(row.body_quality_flags),
    bodySelectionReason: row.body_selection_reason,
    importedAt: row.imported_at,
    attachments
  }
}

export interface MailArchiveRevisionStart {
  readonly revision: number
  readonly unchanged: boolean
  readonly existingMessages: number
}

export interface MailArchiveBatchCounts {
  readonly inserted: number
  readonly skipped: number
}

export interface MailArchiveStore {
  readonly dbPath: string
  beginRevision(input: {
    sourceId: string
    sourceKind: MailArchiveSourceKind
    sourcePath: string
    fingerprint: string
    startedAt?: number
  }): MailArchiveRevisionStart
  upsertBatch(input: {
    sourceId: string
    revision: number
    mails: readonly NormalizedArchiveMail[]
    importedAt?: number
  }): MailArchiveBatchCounts
  verifyRevision(sourceId: string, revision: number, fingerprint: string, verifiedAt?: number): void
  activateRevision(sourceId: string, revision: number, fingerprint: string): void
  abortRevision(sourceId: string, revision: number, state?: 'interrupted' | 'failed'): void
  search(request: MailArchiveSearchRequest): MailArchiveSearchHit[]
  get(id: string): MailArchiveMessage | null
  sources(): MailArchiveSource[]
  thread(request: MailArchiveThreadRequest): MailArchiveThreadResult
  attachmentLocation(attachmentId: string): MailArchiveAttachmentLocation | null
  sourcePathInUse(path: string): boolean
  removeSource(sourceId: string): MailArchiveSourceDeletion | null
  stats(): MailArchiveStats
  close(): void
}

export function createMailArchiveStore(rootDir: string): MailArchiveStore {
  const archiveRoot = join(rootDir, 'mail-archive')
  mkdirSync(archiveRoot, { recursive: true })
  const dbPath = join(archiveRoot, 'archive.db')
  const db = openFileDatabase(dbPath, {
    initialize: (connection) => applyMailArchiveMigrations(connection)
  })
  backfillLegacyRows(db)
  recoverStagingRevisions(db)
  let relationsDirty = true

  const beginRevisionTransaction = db.transaction(
    (input: {
      sourceId: string
      sourceKind: MailArchiveSourceKind
      sourcePath: string
      fingerprint: string
      startedAt: number
    }): MailArchiveRevisionStart => {
      db.prepare(
        `
      INSERT INTO archive_source (source_id, source_kind, source_path, created_at)
      VALUES (@sourceId, @sourceKind, @sourcePath, @startedAt)
      ON CONFLICT(source_id) DO UPDATE SET source_path=excluded.source_path
    `
      ).run(input)

      const verified = db
        .prepare(
          `
        SELECT revision FROM archive_source_revision
        WHERE source_id=? AND fingerprint=? AND state='verified'
      `
        )
        .get(input.sourceId, input.fingerprint) as { revision: number } | undefined
      if (verified) {
        const count = db
          .prepare(
            'SELECT COUNT(DISTINCT mail_id) AS count FROM archive_source_occurrence WHERE source_id=? AND revision=?'
          )
          .get(input.sourceId, verified.revision) as { count: number }
        return { revision: verified.revision, unchanged: true, existingMessages: count.count }
      }

      const incomplete = db
        .prepare(
          `
        SELECT revision FROM archive_source_revision
        WHERE source_id=? AND fingerprint=? AND state IN ('staging', 'interrupted', 'failed')
      `
        )
        .get(input.sourceId, input.fingerprint) as { revision: number } | undefined
      if (incomplete) {
        db.prepare('DELETE FROM archive_source_occurrence WHERE source_id=? AND revision=?').run(
          input.sourceId,
          incomplete.revision
        )
        db.prepare(
          `
        UPDATE archive_source_revision SET state='staging', started_at=?, verified_at=NULL
        WHERE source_id=? AND revision=?
      `
        ).run(input.startedAt, input.sourceId, incomplete.revision)
        return { revision: incomplete.revision, unchanged: false, existingMessages: 0 }
      }

      const revisionRow = db
        .prepare(
          'SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM archive_source_revision WHERE source_id=?'
        )
        .get(input.sourceId) as { revision: number }
      db.prepare(
        `
      INSERT INTO archive_source_revision (source_id, revision, fingerprint, state, started_at)
      VALUES (?, ?, ?, 'staging', ?)
    `
      ).run(input.sourceId, revisionRow.revision, input.fingerprint, input.startedAt)
      return { revision: revisionRow.revision, unchanged: false, existingMessages: 0 }
    }
  )

  const upsertBatchTransaction = db.transaction(
    (input: {
      sourceId: string
      revision: number
      mails: readonly NormalizedArchiveMail[]
      importedAt: number
    }): MailArchiveBatchCounts => {
      const revision = db
        .prepare(`SELECT state FROM archive_source_revision WHERE source_id=? AND revision=?`)
        .get(input.sourceId, input.revision) as { state: string } | undefined
      if (!revision || revision.state !== 'staging') throw new Error('mail_revision_not_staging')

      let inserted = 0
      let skipped = 0
      const findMail = db.prepare('SELECT id FROM archive_mail WHERE identity_key=?')
      const insertMail = db.prepare(`
      INSERT INTO archive_mail (
        id, source_kind, source_path, source_fingerprint, item_key, folder_path, sent_at, imported_at,
        from_addr, to_addrs, cc_addrs, subject, body_text, message_id, in_reply_to, references_header,
        thread_key, attachment_names, size_bytes, source_id, identity_key,
        body_kind, body_alternate_text, body_alternate_kind, body_alternate_omitted,
        body_quality_flags, body_selection_reason
      ) VALUES (
        @id, @sourceKind, @sourcePath, @sourceFingerprint, @itemKey, @folderPath, @sentAt, @importedAt,
        @from, @to, @cc, @subject, @bodyText, @messageId, @inReplyTo, @references,
        @threadKey, @attachmentNames, @sizeBytes, @sourceId, @identityKey,
        @bodyKind, @bodyAlternateText, @bodyAlternateKind, @bodyAlternateOmitted,
        @bodyQualityFlags, @bodySelectionReason
      )
    `)
      const insertAttachment = db.prepare(
        'INSERT INTO archive_attachment (id, mail_id, name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)'
      )
      const insertOccurrence = db.prepare(`
      INSERT OR IGNORE INTO archive_source_occurrence
        (source_id, revision, item_key, mail_id, folder_path)
      VALUES (?, ?, ?, ?, ?)
    `)

      input.mails.forEach((mail) => {
        if (mail.sourceId !== input.sourceId) throw new Error('mail_source_identity_mismatch')
        const existing = findMail.get(mail.identityKey) as { id: string } | undefined
        const id = existing?.id ?? mailId(mail.identityKey)
        if (!existing) {
          insertMail.run({
            id,
            sourceKind: mail.sourceKind,
            sourcePath: mail.sourcePath,
            sourceFingerprint: mail.sourceFingerprint,
            itemKey: mail.itemKey,
            folderPath: mail.folderPath,
            sentAt: mail.sentAt,
            importedAt: input.importedAt,
            from: mail.from,
            to: mail.to,
            cc: mail.cc,
            subject: mail.subject,
            bodyText: mail.bodyText,
            bodyKind: mail.bodyKind,
            bodyAlternateText: mail.bodyAlternateText,
            bodyAlternateKind: mail.bodyAlternateKind,
            bodyAlternateOmitted: mail.bodyAlternateOmitted ? 1 : 0,
            bodyQualityFlags: JSON.stringify(mail.bodyQualityFlags),
            bodySelectionReason: mail.bodySelectionReason,
            messageId: mail.messageId,
            inReplyTo: mail.inReplyTo,
            references: mail.references,
            threadKey: mail.threadKey,
            attachmentNames: JSON.stringify(mail.attachments.map((attachment) => attachment.name)),
            sizeBytes: mail.sizeBytes,
            sourceId: input.sourceId,
            identityKey: mail.identityKey
          })
          mail.attachments.forEach((attachment, index) => {
            insertAttachment.run(
              attachmentId(id, index),
              id,
              attachment.name,
              attachment.mimeType,
              attachment.sizeBytes
            )
          })
          inserted += 1
        } else {
          skipped += 1
        }
        insertOccurrence.run(input.sourceId, input.revision, mail.itemKey, id, mail.folderPath)
      })
      return { inserted, skipped }
    }
  )

  const verifyRevisionTransaction = db.transaction(
    (sourceId: string, revision: number, fingerprint: string, verifiedAt: number): void => {
      const updated = db
        .prepare(
          `
          UPDATE archive_source_revision SET state='verified', verified_at=?
          WHERE source_id=? AND revision=? AND fingerprint=? AND state='staging'
        `
        )
        .run(verifiedAt, sourceId, revision, fingerprint)
      if (updated.changes !== 1) throw new Error('mail_revision_not_staging')
      db.prepare(
        `
        UPDATE archive_source SET current_revision=?, current_fingerprint=? WHERE source_id=?
      `
      ).run(revision, fingerprint, sourceId)
      relationsDirty = true
    }
  )

  const abortRevisionTransaction = db.transaction(
    (sourceId: string, revision: number, state: 'interrupted' | 'failed'): void => {
      const row = db
        .prepare(`SELECT state FROM archive_source_revision WHERE source_id=? AND revision=?`)
        .get(sourceId, revision) as { state: string } | undefined
      if (!row || row.state !== 'staging') return
      db.prepare('DELETE FROM archive_source_occurrence WHERE source_id=? AND revision=?').run(
        sourceId,
        revision
      )
      db.prepare(
        `
        UPDATE archive_source_revision SET state=?, verified_at=NULL
        WHERE source_id=? AND revision=?
      `
      ).run(state, sourceId, revision)
      db.prepare(
        `
        DELETE FROM archive_mail WHERE NOT EXISTS (
          SELECT 1 FROM archive_source_occurrence o WHERE o.mail_id=archive_mail.id
        )
      `
      ).run()
    }
  )

  const activateRevision = db.transaction(
    (sourceId: string, revision: number, fingerprint: string): void => {
      const existing = db
        .prepare(
          `
          SELECT 1 FROM archive_source_revision
          WHERE source_id=? AND revision=? AND fingerprint=? AND state='verified'
        `
        )
        .get(sourceId, revision, fingerprint)
      if (!existing) throw new Error('mail_revision_not_verified')
      db.prepare(
        `
        UPDATE archive_source SET current_revision=?, current_fingerprint=? WHERE source_id=?
      `
      ).run(revision, fingerprint, sourceId)
      relationsDirty = true
    }
  )

  return {
    dbPath,
    beginRevision: (input) =>
      beginRevisionTransaction({ ...input, startedAt: input.startedAt ?? Date.now() }),
    upsertBatch: (input) =>
      upsertBatchTransaction({ ...input, importedAt: input.importedAt ?? Date.now() }),
    verifyRevision: (sourceId, revision, fingerprint, verifiedAt = Date.now()) =>
      verifyRevisionTransaction(sourceId, revision, fingerprint, verifiedAt),
    activateRevision: (sourceId, revision, fingerprint) =>
      activateRevision(sourceId, revision, fingerprint),
    abortRevision: (sourceId, revision, state = 'interrupted') =>
      abortRevisionTransaction(sourceId, revision, state),
    search: (request) => {
      const limit = request.limit ?? 30
      const terms = queryTerms(request.query)
      const sourceKindFilter =
        (request.sourceKind ? ' AND m.source_kind=?' : '') +
        (request.sourceId
          ? ' AND EXISTS (SELECT 1 FROM archive_verified_occurrence scoped WHERE scoped.mail_id=m.id AND scoped.source_id=?)'
          : '')
      const sourceKindParams = [
        ...(request.sourceKind ? [request.sourceKind] : []),
        ...(request.sourceId ? [request.sourceId] : [])
      ]
      const hasShortTerm = terms.some((term) => [...term].length < 3)
      const visibleMail = `EXISTS (
        SELECT 1 FROM archive_verified_occurrence vo WHERE vo.mail_id=m.id
      )`
      const select = `SELECT m.id, m.source_kind,
        COALESCE((${findOccurrenceColumnSql('source_path')}), m.source_path) AS source_path,
        COALESCE((${findOccurrenceColumnSql('folder_path')}), m.folder_path) AS folder_path,
        m.sent_at, m.from_addr, m.to_addrs, m.cc_addrs, m.subject, m.body_text,
        m.attachment_names, `

      let rows: unknown[]
      if (terms.length > 0 && !hasShortTerm) {
        rows = db
          .prepare(
            `${select}bm25(archive_mail_fts) AS rank
             FROM archive_mail_fts f JOIN archive_mail m ON m.rowid=f.rowid
             WHERE archive_mail_fts MATCH ? AND ${visibleMail}${sourceKindFilter}
             ORDER BY rank, COALESCE(m.sent_at, m.imported_at) DESC LIMIT ?`
          )
          .all(ftsQuery(terms), ...sourceKindParams, limit)
      } else {
        const termFilters = terms.map(
          () =>
            `(m.from_addr || ' ' || m.to_addrs || ' ' || m.cc_addrs || ' ' || m.subject || ' ' || m.body_text || ' ' || m.attachment_names) LIKE ? ESCAPE '\\'`
        )
        const termParams = terms.map(escapeLike)
        const filter = termFilters.length > 0 ? ` AND ${termFilters.join(' AND ')}` : ''
        rows = db
          .prepare(
            `${select}0 AS rank
             FROM archive_mail m
             WHERE ${visibleMail}${sourceKindFilter}${filter}
             ORDER BY COALESCE(m.sent_at, m.imported_at) DESC LIMIT ?`
          )
          .all(...sourceKindParams, ...termParams, limit)
      }
      return (rows as Parameters<typeof mapHit>[0][]).map((row) => mapHit(row, request.query))
    },
    get: (id) => {
      const row = db
        .prepare(
          `
          SELECT m.id, m.source_kind,
            COALESCE((${findOccurrenceColumnSql('source_path')}), m.source_path) AS source_path,
            m.source_fingerprint,
            m.item_key,
            COALESCE((${findOccurrenceColumnSql('folder_path')}), m.folder_path) AS folder_path,
            m.sent_at, m.imported_at, m.from_addr, m.to_addrs, m.cc_addrs, m.subject, m.body_text,
            m.message_id, m.in_reply_to, m.references_header, m.thread_key, m.attachment_names,
            m.body_kind, m.body_alternate_text, m.body_alternate_kind, m.body_alternate_omitted,
            m.body_quality_flags, m.body_selection_reason,
            0 AS rank
          FROM archive_mail m WHERE m.id=? AND EXISTS (
            SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id
          )
        `
        )
        .get(id) as Parameters<typeof mapMessage>[0] | undefined
      if (!row) return null
      const attachments = db
        .prepare(
          'SELECT id, name, mime_type AS mimeType, size_bytes AS sizeBytes FROM archive_attachment WHERE mail_id=? ORDER BY rowid'
        )
        .all(id) as MailArchiveAttachment[]
      return mapMessage(row, attachments)
    },
    thread: (request) => {
      if (relationsDirty) {
        db.transaction(() => rebuildRelations(db))()
        relationsDirty = false
      }
      const limit = request.limit ?? 50
      const rows = db
        .prepare(
          `
          WITH RECURSIVE connected(id) AS (
            SELECT m.id FROM archive_mail m
            WHERE m.id=? AND EXISTS (
              SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id
            )
            UNION
            SELECT CASE WHEN relation.child_mail_id=connected.id
              THEN relation.parent_mail_id ELSE relation.child_mail_id END
            FROM archive_mail_relation relation
            JOIN connected
              ON relation.child_mail_id=connected.id OR relation.parent_mail_id=connected.id
            WHERE relation.resolution='resolved' AND relation.parent_mail_id IS NOT NULL
            LIMIT ?
          )
          SELECT m.id, m.source_kind,
            COALESCE((${findOccurrenceColumnSql('source_path')}), m.source_path) AS source_path,
            COALESCE((${findOccurrenceColumnSql('folder_path')}), m.folder_path) AS folder_path,
            m.sent_at, m.from_addr, m.to_addrs, m.cc_addrs, m.subject, m.body_text,
            m.attachment_names, 0 AS rank
          FROM connected JOIN archive_mail m ON m.id=connected.id
          WHERE EXISTS (
            SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id
          )
          ORDER BY m.sent_at IS NULL, m.sent_at, m.id
        `
        )
        .all(request.id, limit + 1) as Parameters<typeof mapHit>[0][]
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
        mails: selectedRows.map((row) => mapHit(row, '')),
        relations,
        truncated
      }
    },
    attachmentLocation: (attachmentId) => {
      const row = db
        .prepare(
          `
          SELECT a.id AS attachmentId, s.source_id AS sourceId,
            s.source_kind AS sourceKind, s.source_path AS sourcePath,
            r.fingerprint AS sourceFingerprint, o.item_key AS itemKey,
            (SELECT COUNT(*) FROM archive_attachment prior
              WHERE prior.mail_id=a.mail_id AND prior.rowid<a.rowid) AS attachmentIndex,
            a.name, a.mime_type AS mimeType, a.size_bytes AS sizeBytes
          FROM archive_attachment a
          JOIN archive_mail m ON m.id=a.mail_id
          JOIN archive_source_occurrence o ON o.mail_id=m.id
          JOIN archive_source_revision r ON r.source_id=o.source_id AND r.revision=o.revision
          JOIN archive_source s ON s.source_id=o.source_id
          WHERE a.id=? AND r.state='verified'
          ORDER BY r.verified_at DESC, s.source_id LIMIT 1
        `
        )
        .get(attachmentId) as MailArchiveAttachmentLocation | undefined
      return row ?? null
    },
    sourcePathInUse: (path) => {
      const emlSourceId = archiveSourceId('eml', path)
      const pstSourceId = archiveSourceId('pst', path)
      return Boolean(
        db
          .prepare('SELECT 1 FROM archive_source WHERE source_id IN (?, ?) LIMIT 1')
          .get(emlSourceId, pstSourceId)
      )
    },
    sources: () => {
      const rows = db
        .prepare(
          `
          SELECT s.source_id AS id, s.source_kind AS kind, s.source_path AS sourcePath,
            MAX(r.verified_at) AS lastImportedAt, COUNT(DISTINCT o.mail_id) AS messageCount,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM archive_verified_occurrence other
              WHERE other.mail_id=o.mail_id AND other.source_id<>s.source_id
            ) THEN o.mail_id END) AS sharedMessageCount
          FROM archive_source s
          JOIN archive_source_revision r ON r.source_id=s.source_id AND r.state='verified'
          LEFT JOIN archive_source_occurrence o ON o.source_id=s.source_id AND o.revision=r.revision
          GROUP BY s.source_id
          ORDER BY s.created_at, s.source_id
        `
        )
        .all() as Array<{
        id: string
        kind: MailArchiveSourceKind
        sourcePath: string
        messageCount: number
        sharedMessageCount: number
        lastImportedAt: number | null
      }>
      return rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: sourceName(row.sourcePath),
        messageCount: row.messageCount,
        sharedMessageCount: row.sharedMessageCount,
        lastImportedAt: row.lastImportedAt
      }))
    },
    removeSource: (sourceId) => {
      const remove = db.transaction((id: string): MailArchiveSourceDeletion | null => {
        const source = db
          .prepare('SELECT source_path AS sourcePath FROM archive_source WHERE source_id=?')
          .get(id) as { sourcePath: string } | undefined
        if (!source) return null

        const counts = db
          .prepare(
            `
            SELECT COUNT(DISTINCT o.mail_id) AS candidateMessages,
              COUNT(DISTINCT CASE WHEN EXISTS (
                SELECT 1 FROM archive_verified_occurrence other
                WHERE other.mail_id=o.mail_id AND other.source_id<>o.source_id
              ) THEN o.mail_id END) AS preservedMessages
            FROM archive_source_occurrence o WHERE o.source_id=?
          `
          )
          .get(id) as { candidateMessages: number; preservedMessages: number }

        db.prepare('DELETE FROM archive_source WHERE source_id=?').run(id)

        // A canonical mail row can be shared by several sources. Re-point the retained row to an
        // occurrence that still exists so removing the original source also removes its path and
        // revision fingerprint from the retained record.
        db.prepare(
          `
          UPDATE archive_mail AS m SET
            source_id=(SELECT o.source_id FROM archive_source_occurrence o
              JOIN archive_source_revision r ON r.source_id=o.source_id AND r.revision=o.revision
              JOIN archive_source s ON s.source_id=o.source_id
              WHERE o.mail_id=m.id
              ORDER BY CASE WHEN r.state='verified' THEN 0 ELSE 1 END,
                r.verified_at DESC, o.rowid DESC LIMIT 1),
            source_path=(SELECT s.source_path FROM archive_source_occurrence o
              JOIN archive_source_revision r ON r.source_id=o.source_id AND r.revision=o.revision
              JOIN archive_source s ON s.source_id=o.source_id
              WHERE o.mail_id=m.id
              ORDER BY CASE WHEN r.state='verified' THEN 0 ELSE 1 END,
                r.verified_at DESC, o.rowid DESC LIMIT 1),
            source_fingerprint=(SELECT r.fingerprint FROM archive_source_occurrence o
              JOIN archive_source_revision r ON r.source_id=o.source_id AND r.revision=o.revision
              JOIN archive_source s ON s.source_id=o.source_id
              WHERE o.mail_id=m.id
              ORDER BY CASE WHEN r.state='verified' THEN 0 ELSE 1 END,
                r.verified_at DESC, o.rowid DESC LIMIT 1),
            item_key=(SELECT o.item_key FROM archive_source_occurrence o
              JOIN archive_source_revision r ON r.source_id=o.source_id AND r.revision=o.revision
              JOIN archive_source s ON s.source_id=o.source_id
              WHERE o.mail_id=m.id
              ORDER BY CASE WHEN r.state='verified' THEN 0 ELSE 1 END,
                r.verified_at DESC, o.rowid DESC LIMIT 1),
            folder_path=(SELECT o.folder_path FROM archive_source_occurrence o
              JOIN archive_source_revision r ON r.source_id=o.source_id AND r.revision=o.revision
              JOIN archive_source s ON s.source_id=o.source_id
              WHERE o.mail_id=m.id
              ORDER BY CASE WHEN r.state='verified' THEN 0 ELSE 1 END,
                r.verified_at DESC, o.rowid DESC LIMIT 1)
          WHERE m.source_id=? AND EXISTS (
            SELECT 1 FROM archive_source_occurrence o WHERE o.mail_id=m.id
          )
        `
        ).run(id)
        db.prepare(
          `DELETE FROM archive_mail WHERE NOT EXISTS (
          SELECT 1 FROM archive_source_occurrence o WHERE o.mail_id=archive_mail.id
        )`
        ).run()
        relationsDirty = true
        return {
          sourceName: sourceName(source.sourcePath),
          removedMessages: counts.candidateMessages - counts.preservedMessages,
          preservedMessages: counts.preservedMessages
        }
      })
      return remove(sourceId)
    },
    stats: () => {
      const row = db
        .prepare(
          `
          SELECT COUNT(*) AS total,
            SUM(CASE WHEN m.source_kind='eml' THEN 1 ELSE 0 END) AS eml,
            SUM(CASE WHEN m.source_kind='pst' THEN 1 ELSE 0 END) AS pst,
            MAX(m.imported_at) AS latest
          FROM archive_mail m
          WHERE EXISTS (
            SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id
          )
        `
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
