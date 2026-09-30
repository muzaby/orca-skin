import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { openFileDatabase } from '../../../infra/db/file-database'
import { applyMailArchiveMigrations } from './migrate'
import type {
  MailArchiveSource,
  MailArchiveSourceDeletion,
  MailArchiveSourceKind,
  MailArchiveStats
} from '../../../../shared/mail-archive'
import type {
  ArchivePluginRequest,
  ArchivePluginResponse
} from '../../../../shared/mail-archive-plugin'
import { archiveSourceId } from './identity'
import { initializeArchiveStore, rebuildArchiveRelations } from './store-maintenance'
import { createArchiveStoreReads, type MailArchiveReads } from './store-reads'
import { createArchivePluginStore } from './plugin-store'
import type { MailArchiveAttachmentLocation, NormalizedArchiveMail } from './types'

function attachmentId(mailId: string, index: number): string {
  return createHash('sha256').update(`${mailId}\0${index}`).digest('hex').slice(0, 32)
}

function mailId(identityKey: string): string {
  return createHash('sha256').update(`mail\0${identityKey}`).digest('hex')
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

export interface MailArchiveStore extends MailArchiveReads {
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
  sources(): MailArchiveSource[]
  pluginRequest(input: ArchivePluginRequest): ArchivePluginResponse
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
  let writeSegments: (id: string, body: string) => void
  try {
    writeSegments = initializeArchiveStore(db)
  } catch (error) {
    db.close()
    throw error
  }
  let relationsDirty = true
  const selectRevisionState = db.prepare(
    'SELECT state FROM archive_source_revision WHERE source_id=? AND revision=?'
  )
  const updateCurrentRevision = db.prepare(
    'UPDATE archive_source SET current_revision=?, current_fingerprint=? WHERE source_id=?'
  )
  const deleteOrphanMails = db.prepare(`DELETE FROM archive_mail WHERE NOT EXISTS (
    SELECT 1 FROM archive_source_occurrence o WHERE o.mail_id=archive_mail.id
  )`)

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

  const upsertBatchTransaction = db.transaction(
    (input: {
      sourceId: string
      revision: number
      mails: readonly NormalizedArchiveMail[]
      importedAt: number
    }): MailArchiveBatchCounts => {
      const revision = selectRevisionState.get(input.sourceId, input.revision) as
        { state: string } | undefined
      if (!revision || revision.state !== 'staging') throw new Error('mail_revision_not_staging')

      let inserted = 0
      let skipped = 0

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
          writeSegments(id, mail.bodyText)
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
      updateCurrentRevision.run(revision, fingerprint, sourceId)
      relationsDirty = true
    }
  )

  const abortRevisionTransaction = db.transaction(
    (sourceId: string, revision: number, state: 'interrupted' | 'failed'): void => {
      const row = selectRevisionState.get(sourceId, revision) as { state: string } | undefined
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
      deleteOrphanMails.run()
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
      updateCurrentRevision.run(revision, fingerprint, sourceId)
      relationsDirty = true
    }
  )

  const refreshRelations = db.transaction(() => rebuildArchiveRelations(db))
  const reads = createArchiveStoreReads(db, () => {
    if (!relationsDirty) return
    refreshRelations()
    relationsDirty = false
  })
  const plugin = createArchivePluginStore(db, reads)
  const store: MailArchiveStore = {
    pluginRequest: (input) => plugin.request(input),
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
    ...reads,
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
        name: basename(row.sourcePath),
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
            (source_id, source_path, source_fingerprint, item_key, folder_path)=(
              SELECT o.source_id, s.source_path, r.fingerprint, o.item_key, o.folder_path
              FROM archive_source_occurrence o
              JOIN archive_source_revision r ON r.source_id=o.source_id AND r.revision=o.revision
              JOIN archive_source s ON s.source_id=o.source_id
              WHERE o.mail_id=m.id
              ORDER BY CASE WHEN r.state='verified' THEN 0 ELSE 1 END,
                r.verified_at DESC, o.rowid DESC LIMIT 1
            )
          WHERE m.source_id=? AND EXISTS (
            SELECT 1 FROM archive_source_occurrence o WHERE o.mail_id=m.id
          )
        `
        ).run(id)
        deleteOrphanMails.run()
        relationsDirty = true
        return {
          sourceName: basename(source.sourcePath),
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
  return store
}
