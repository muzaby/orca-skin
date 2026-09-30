import type Database from 'better-sqlite3'
import type { MailArchiveAttachment } from '../../../../shared/mail-archive'
import { archiveSourceId } from './identity'
import { resolveArchiveMailRelations, type ArchiveMailRelationMessage } from './relations'
import { classifyArchiveBody, ARCHIVE_CLASSIFIER_REVISION } from './segment-classifier'
import { normalizedArchiveMail, type ArchiveMailRow } from './store-records'

function backfillLegacyRows(db: Database.Database): void {
  const index = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='archive_mail_identity_idx'")
    .get()
  if (index) return

  const rows = db
    .prepare('SELECT * FROM archive_mail ORDER BY imported_at, id')
    .all() as ArchiveMailRow[]
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

      const mail = normalizedArchiveMail(
        { ...row, source_id: sourceId },
        getAttachments.all(row.id) as Array<Omit<MailArchiveAttachment, 'id'>>
      )
      const canonicalId = canonicalByIdentity.get(mail.identityKey) ?? row.id
      canonicalByIdentity.set(mail.identityKey, canonicalId)
      if (canonicalId === row.id) updateMail.run(sourceId, mail.identityKey, row.id)
      insertOccurrence.run(sourceId, revision, row.item_key, canonicalId, row.folder_path)
      if (canonicalId !== row.id) deleteMail.run(row.id)
    }

    for (const sourceId of nextRevision.keys()) {
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

export function rebuildArchiveRelations(db: Database.Database): void {
  const visibleMail = db
    .prepare(
      `
      SELECT DISTINCT m.id, m.message_id AS messageId, m.in_reply_to AS inReplyTo,
        m.references_header AS "references"
      FROM archive_mail m
      WHERE EXISTS (
        SELECT 1 FROM archive_verified_occurrence o WHERE o.mail_id=m.id
      )
      ORDER BY m.id
    `
    )
    .all() as ArchiveMailRelationMessage[]
  const relations = resolveArchiveMailRelations(visibleMail)
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

export function initializeArchiveStore(db: Database.Database): (id: string, body: string) => void {
  backfillLegacyRows(db)
  recoverStagingRevisions(db)
  const deleteSegments = db.prepare('DELETE FROM archive_body_segment WHERE mail_id=?')
  const insert = db.prepare(`
      INSERT INTO archive_body_segment
        (mail_id, ordinal, start_offset, end_offset, kind, rule_id, classifier_revision, confidence_class)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
  const upsertProjection = db.prepare(
    `INSERT INTO archive_body_projection (mail_id, classifier_revision) VALUES (?, ?)
    ON CONFLICT(mail_id) DO UPDATE SET classifier_revision=excluded.classifier_revision`
  )
  const writeSegments = (id: string, body: string): void => {
    deleteSegments.run(id)
    for (const segment of classifyArchiveBody(body)) {
      insert.run(
        id,
        segment.ordinal,
        segment.start,
        segment.end,
        segment.kind,
        segment.ruleId,
        segment.classifierRevision,
        segment.confidenceClass
      )
    }
    upsertProjection.run(id, ARCHIVE_CLASSIFIER_REVISION)
  }
  db.transaction(() => {
    const selectPending = db.prepare(`SELECT m.id, m.body_text FROM archive_mail m
        LEFT JOIN archive_body_projection p ON p.mail_id=m.id
        WHERE p.classifier_revision IS NULL OR p.classifier_revision<>? ORDER BY m.id LIMIT 100`)
    while (true) {
      // Finish the SELECT before writing on the same SQLite connection.
      const pending = selectPending.all(ARCHIVE_CLASSIFIER_REVISION) as Pick<
        ArchiveMailRow,
        'id' | 'body_text'
      >[]
      if (pending.length === 0) break
      for (const row of pending) writeSegments(row.id, row.body_text)
    }
  })()
  return writeSegments
}
