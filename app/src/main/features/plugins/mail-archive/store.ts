import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { basename, isAbsolute, join, relative } from 'node:path'
import { openFileDatabase } from '../../../infra/db/file-database'
import { applyMailArchiveMigrations } from './migrate'
import type {
  MailArchiveAttachment,
  MailArchiveBodyQualityFlag,
  MailArchiveMessage,
  MailArchiveSearchHit,
  MailArchiveSearchRequest,
  MailArchiveSource,
  MailArchiveSourceDeletion,
  MailArchiveSourceKind,
  MailArchiveStats,
  MailArchiveThreadItem,
  MailArchiveThreadRequest,
  MailArchiveThreadResult
} from '../../../../shared/mail-archive'
import { normalizedSourcePath } from './identity'
import { resolveArchiveMailRelations } from './relations'
import type { MailArchiveAttachmentLocation, NormalizedArchiveMail } from './types'

const SNIPPET_LENGTH = 240

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function attachmentId(mailId: string, index: number): string {
  return sha256(`${mailId}\0${index}`).slice(0, 32)
}

function mailId(identityKey: string): string {
  return sha256(`mail\0${identityKey}`)
}

function queryTerms(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean)
}

function ftsQuery(terms: readonly string[]): string {
  return terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(' AND ')
}

function likePattern(value: string): string {
  return `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
}

/** 첨부 이름은 FTS·LIKE가 JSON 구두점을 색인하지 않도록 줄바꿈으로 잇는다. */
function joinAttachmentNames(names: readonly string[]): string {
  return names.map((name) => name.replace(/[\r\n]+/g, ' ')).join('\n')
}

function splitAttachmentNames(value: string): string[] {
  // 초기 색인은 JSON 배열로 저장했다.
  if (value.startsWith('[')) return JSON.parse(value) as string[]
  return value ? value.split('\n') : []
}

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const VISIBLE = (alias: string): string =>
  `EXISTS (SELECT 1 FROM archive_visible_occurrence v WHERE v.mail_id=${alias}.id)`

interface MailRow {
  readonly id: string
  readonly sent_at: number | null
  readonly from_addr: string
  readonly subject: string
}

interface OccurrenceInfo {
  readonly sourceName: string
  readonly folderPath: string | null
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

export interface MailArchiveRevisionRef {
  readonly sourceId: string
  readonly revision: number
}

export interface MailArchiveStore {
  beginRevision(input: {
    sourceId: string
    sourceKind: MailArchiveSourceKind
    sourcePath: string
    fingerprint: string
  }): MailArchiveRevisionStart
  upsertBatch(
    input: MailArchiveRevisionRef & { mails: readonly NormalizedArchiveMail[] }
  ): MailArchiveBatchCounts
  verifyRevision(input: MailArchiveRevisionRef & { fingerprint: string }): void
  abortRevision(input: MailArchiveRevisionRef): void
  refreshRelations(): void
  search(request: MailArchiveSearchRequest): MailArchiveSearchHit[]
  get(id: string): MailArchiveMessage | null
  thread(request: MailArchiveThreadRequest): MailArchiveThreadResult
  attachmentLocation(attachmentId: string): MailArchiveAttachmentLocation | null
  sourcePathInUse(path: string): boolean
  sources(): MailArchiveSource[]
  removeSource(sourceId: string): MailArchiveSourceDeletion | null
  stats(): MailArchiveStats
  close(): void
}

export function createMailArchiveStore(rootDir: string): MailArchiveStore {
  const archiveRoot = join(rootDir, 'mail-archive')
  mkdirSync(archiveRoot, { recursive: true })
  const db = openFileDatabase(join(archiveRoot, 'archive.db'), {
    initialize: (connection) => applyMailArchiveMigrations(connection)
  })

  const deleteOrphanMail = db.prepare(`
    DELETE FROM archive_mail WHERE NOT EXISTS (
      SELECT 1 FROM archive_source_occurrence o WHERE o.mail_id=archive_mail.id
    )
  `)
  const deleteRevision = (sourceId: string, revision: number): void => {
    db.prepare('DELETE FROM archive_source_occurrence WHERE source_id=? AND revision=?').run(
      sourceId,
      revision
    )
    db.prepare('DELETE FROM archive_source_revision WHERE source_id=? AND revision=?').run(
      sourceId,
      revision
    )
  }

  /** 관계는 보이는 메일 전체의 함수다. 파일마다가 아니라 가져오기 작업이 끝날 때 한 번 다시 만든다. */
  const rebuildRelations = (): void => {
    const visible = db
      .prepare(
        `SELECT m.id, m.message_id AS messageId, m.in_reply_to AS inReplyTo,
           m.references_header AS "references"
         FROM archive_mail m WHERE ${VISIBLE('m')} ORDER BY m.id`
      )
      .all() as Array<{
      id: string
      messageId: string | null
      inReplyTo: string | null
      references: string | null
    }>
    db.prepare('DELETE FROM archive_mail_relation').run()
    const insert = db.prepare(`
      INSERT OR IGNORE INTO archive_mail_relation
        (child_mail_id, parent_message_id, parent_mail_id, kind, resolution)
      VALUES (?, ?, ?, ?, 'resolved')
    `)
    for (const relation of resolveArchiveMailRelations(visible)) {
      if (relation.resolution !== 'resolved') continue
      insert.run(
        relation.childMailId,
        relation.parentMessageId,
        relation.parentMailId,
        relation.kind
      )
    }
  }

  // 강제 종료로 남은 미검증 revision은 검색에 쓰지 않는다. 다음 가져오기가 처음부터 다시 검증한다.
  db.transaction(() => {
    const stale = db
      .prepare(
        "SELECT source_id AS sourceId, revision FROM archive_source_revision WHERE state<>'verified'"
      )
      .all() as MailArchiveRevisionRef[]
    for (const { sourceId, revision } of stale) deleteRevision(sourceId, revision)
    deleteOrphanMail.run()
    rebuildRelations()
  })()

  /** 결과 메일마다 가장 최근에 확인된 자료원·폴더. */
  const occurrenceInfo = (ids: readonly string[]): Map<string, OccurrenceInfo> => {
    const info = new Map<string, OccurrenceInfo>()
    if (ids.length === 0) return info
    const rows = db
      .prepare(
        `SELECT v.mail_id AS mailId, s.source_path AS sourcePath, v.folder_path AS folderPath
         FROM archive_visible_occurrence v JOIN archive_source s ON s.source_id=v.source_id
         WHERE v.mail_id IN (${ids.map(() => '?').join(',')})
         ORDER BY v.occurrence_order`
      )
      .all(...ids) as Array<{ mailId: string; sourcePath: string; folderPath: string | null }>
    for (const row of rows) {
      info.set(row.mailId, { sourceName: basename(row.sourcePath), folderPath: row.folderPath })
    }
    return info
  }

  const insertMail = db.prepare(`
    INSERT INTO archive_mail (
      id, identity_key, sent_at, imported_at, from_addr, to_addrs, cc_addrs, subject, body_text,
      body_kind, body_alternate_text, body_alternate_kind, body_alternate_omitted,
      body_quality_flags, body_selection_reason, message_id, in_reply_to, references_header,
      attachment_names,
      source_kind, source_path, source_fingerprint, item_key, thread_key, size_bytes
    ) VALUES (
      @id, @identityKey, @sentAt, @importedAt, @from, @to, @cc, @subject, @bodyText,
      @bodyKind, @bodyAlternateText, @bodyAlternateKind, @bodyAlternateOmitted,
      @bodyQualityFlags, @bodySelectionReason, @messageId, @inReplyTo, @references,
      @attachmentNames,
      @sourceKind, '', @id, @id, '', 0
    )
  `)
  const insertAttachment = db.prepare(
    'INSERT INTO archive_attachment (id, mail_id, name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)'
  )
  const insertOccurrence = db.prepare(`
    INSERT OR IGNORE INTO archive_source_occurrence (source_id, revision, item_key, mail_id, folder_path)
    VALUES (?, ?, ?, ?, ?)
  `)
  const findMail = db.prepare('SELECT id FROM archive_mail WHERE identity_key=?')
  const revisionState = db.prepare(
    'SELECT state FROM archive_source_revision WHERE source_id=? AND revision=?'
  )
  const sourceKindOf = db.prepare(
    'SELECT source_kind AS kind FROM archive_source WHERE source_id=?'
  )

  return {
    beginRevision: db.transaction((input: Parameters<MailArchiveStore['beginRevision']>[0]) => {
      db.prepare(
        `INSERT INTO archive_source (source_id, source_kind, source_path, created_at)
         VALUES (@sourceId, @sourceKind, @sourcePath, @now)
         ON CONFLICT(source_id) DO UPDATE SET source_path=excluded.source_path`
      ).run({ ...input, now: Date.now() })
      const existing = db
        .prepare(
          'SELECT revision, state FROM archive_source_revision WHERE source_id=? AND fingerprint=?'
        )
        .get(input.sourceId, input.fingerprint) as { revision: number; state: string } | undefined
      if (existing?.state === 'verified') {
        const count = db
          .prepare(
            'SELECT COUNT(DISTINCT mail_id) AS count FROM archive_source_occurrence WHERE source_id=? AND revision=?'
          )
          .get(input.sourceId, existing.revision) as { count: number }
        const start: MailArchiveRevisionStart = {
          revision: existing.revision,
          unchanged: true,
          existingMessages: count.count
        }
        return start
      }
      if (existing) deleteRevision(input.sourceId, existing.revision)
      const { revision } = db
        .prepare(
          'SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM archive_source_revision WHERE source_id=?'
        )
        .get(input.sourceId) as { revision: number }
      db.prepare(
        `INSERT INTO archive_source_revision (source_id, revision, fingerprint, state, started_at)
         VALUES (?, ?, ?, 'staging', ?)`
      ).run(input.sourceId, revision, input.fingerprint, Date.now())
      return { revision, unchanged: false, existingMessages: 0 }
    }),

    upsertBatch: db.transaction((input: Parameters<MailArchiveStore['upsertBatch']>[0]) => {
      const state = revisionState.get(input.sourceId, input.revision) as
        { state: string } | undefined
      if (state?.state !== 'staging') throw new Error('mail_revision_not_staging')
      const { kind } = sourceKindOf.get(input.sourceId) as { kind: MailArchiveSourceKind }
      const importedAt = Date.now()
      let inserted = 0
      for (const mail of input.mails) {
        if (mail.sourceId !== input.sourceId) throw new Error('mail_source_identity_mismatch')
        const existing = findMail.get(mail.identityKey) as { id: string } | undefined
        const id = existing?.id ?? mailId(mail.identityKey)
        if (!existing) {
          insertMail.run({
            ...mail,
            id,
            importedAt,
            bodyAlternateOmitted: mail.bodyAlternateOmitted ? 1 : 0,
            bodyQualityFlags: JSON.stringify(mail.bodyQualityFlags),
            attachmentNames: joinAttachmentNames(
              mail.attachments.map((attachment) => attachment.name)
            ),
            sourceKind: kind
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
        }
        insertOccurrence.run(input.sourceId, input.revision, mail.itemKey, id, mail.folderPath)
      }
      const counts: MailArchiveBatchCounts = { inserted, skipped: input.mails.length - inserted }
      return counts
    }),

    verifyRevision: ({ sourceId, revision, fingerprint }) => {
      const updated = db
        .prepare(
          `UPDATE archive_source_revision SET state='verified', verified_at=?
           WHERE source_id=? AND revision=? AND fingerprint=? AND state='staging'`
        )
        .run(Date.now(), sourceId, revision, fingerprint)
      if (updated.changes !== 1) throw new Error('mail_revision_not_staging')
    },

    abortRevision: db.transaction(({ sourceId, revision }: MailArchiveRevisionRef): void => {
      const state = revisionState.get(sourceId, revision) as { state: string } | undefined
      if (state?.state !== 'staging') return
      deleteRevision(sourceId, revision)
      deleteOrphanMail.run()
    }),

    refreshRelations: db.transaction(() => rebuildRelations()),

    search: (request) => {
      const terms = queryTerms(request.query)
      const scope = request.sourceId
        ? 'EXISTS (SELECT 1 FROM archive_visible_occurrence v WHERE v.mail_id=m.id AND v.source_id=?)'
        : VISIBLE('m')
      const scopeParams = request.sourceId ? [request.sourceId] : []
      const limit = request.limit ?? 30
      // trigram FTS는 3글자 미만 검색어를 찾지 못한다. 하나라도 있으면 모든 검색어를 LIKE로 AND 검색한다.
      const useFts = terms.length > 0 && terms.every((term) => [...term].length >= 3)
      const firstTerm = terms[0] ?? ''
      let rows: Array<MailRow & { snippet: string; attachment_names: string }>
      if (useFts) {
        rows = db
          .prepare(
            `SELECT m.id, m.sent_at, m.from_addr, m.subject, m.attachment_names,
               snippet(archive_mail_fts, 4, '', '', '…', 48) AS snippet
             FROM archive_mail_fts f JOIN archive_mail m ON m.rowid=f.rowid
             WHERE archive_mail_fts MATCH ? AND ${scope}
             ORDER BY bm25(archive_mail_fts), COALESCE(m.sent_at, m.imported_at) DESC LIMIT ?`
          )
          .all(ftsQuery(terms), ...scopeParams, limit) as typeof rows
      } else {
        const haystack = `(m.from_addr || ' ' || m.to_addrs || ' ' || m.cc_addrs || ' ' || m.subject || ' ' || m.body_text || ' ' || m.attachment_names)`
        const termFilter = terms.map(() => ` AND ${haystack} LIKE ? ESCAPE '\\'`).join('')
        rows = db
          .prepare(
            `SELECT m.id, m.sent_at, m.from_addr, m.subject, m.attachment_names,
               substr(m.body_text, max(1, instr(lower(m.body_text), lower(?)) - 60), ${SNIPPET_LENGTH}) AS snippet
             FROM archive_mail m
             WHERE ${scope}${termFilter}
             ORDER BY COALESCE(m.sent_at, m.imported_at) DESC LIMIT ?`
          )
          .all(firstTerm, ...scopeParams, ...terms.map(likePattern), limit) as typeof rows
      }
      const info = occurrenceInfo(rows.map((row) => row.id))
      return rows.map((row) => ({
        id: row.id,
        sourceName: info.get(row.id)?.sourceName ?? '',
        folderPath: info.get(row.id)?.folderPath ?? null,
        date: row.sent_at,
        from: row.from_addr,
        subject: row.subject,
        snippet: row.snippet.replace(/\s+/g, ' ').trim(),
        attachmentNames: splitAttachmentNames(row.attachment_names)
      }))
    },

    get: (id) => {
      const row = db
        .prepare(`SELECT * FROM archive_mail m WHERE m.id=? AND ${VISIBLE('m')}`)
        .get(id) as
        | (MailRow & {
            to_addrs: string
            cc_addrs: string
            body_text: string
            body_kind: MailArchiveMessage['bodyKind']
            body_alternate_text: string | null
            body_alternate_kind: MailArchiveMessage['bodyAlternateKind']
            body_alternate_omitted: number
            body_quality_flags: string
            body_selection_reason: MailArchiveMessage['bodySelectionReason']
          })
        | undefined
      if (!row) return null
      const attachments = db
        .prepare(
          'SELECT id, name, mime_type AS mimeType, size_bytes AS sizeBytes FROM archive_attachment WHERE mail_id=? ORDER BY rowid'
        )
        .all(id) as MailArchiveAttachment[]
      const info = occurrenceInfo([id]).get(id)
      return {
        id: row.id,
        sourceName: info?.sourceName ?? '',
        folderPath: info?.folderPath ?? null,
        date: row.sent_at,
        from: row.from_addr,
        to: row.to_addrs,
        cc: row.cc_addrs,
        subject: row.subject,
        bodyText: row.body_text,
        bodyKind: row.body_kind,
        bodyAlternateText: row.body_alternate_text,
        bodyAlternateKind: row.body_alternate_kind,
        bodyAlternateOmitted: row.body_alternate_omitted === 1,
        bodyQualityFlags: JSON.parse(row.body_quality_flags) as MailArchiveBodyQualityFlag[],
        bodySelectionReason: row.body_selection_reason,
        attachments
      }
    },

    thread: (request) => {
      const limit = request.limit ?? 50
      const rows = db
        .prepare(
          `WITH RECURSIVE connected(id) AS (
             SELECT m.id FROM archive_mail m WHERE m.id=? AND ${VISIBLE('m')}
             UNION
             SELECT CASE WHEN r.child_mail_id=connected.id THEN r.parent_mail_id ELSE r.child_mail_id END
             FROM archive_mail_relation r
             JOIN connected ON r.child_mail_id=connected.id OR r.parent_mail_id=connected.id
             WHERE r.parent_mail_id IS NOT NULL
             LIMIT ?
           )
           SELECT m.id, m.sent_at, m.from_addr, m.subject
           FROM connected JOIN archive_mail m ON m.id=connected.id
           WHERE ${VISIBLE('m')}
           ORDER BY m.sent_at IS NULL, m.sent_at, m.id`
        )
        .all(request.id, limit + 1) as MailRow[]
      const mails: MailArchiveThreadItem[] = rows.slice(0, limit).map((row) => ({
        id: row.id,
        subject: row.subject,
        from: row.from_addr,
        date: row.sent_at
      }))
      return { mails, truncated: rows.length > limit }
    },

    attachmentLocation: (id) => {
      const row = db
        .prepare(
          `SELECT s.source_kind AS sourceKind, s.source_path AS root, r.fingerprint AS sourceFingerprint,
             v.item_key AS itemKey,
             (SELECT COUNT(*) FROM archive_attachment prior
               WHERE prior.mail_id=a.mail_id AND prior.rowid<a.rowid) AS attachmentIndex,
             a.name, a.mime_type AS mimeType, a.size_bytes AS sizeBytes
           FROM archive_attachment a
           JOIN archive_visible_occurrence v ON v.mail_id=a.mail_id
           JOIN archive_source_revision r ON r.source_id=v.source_id AND r.revision=v.revision
           JOIN archive_source s ON s.source_id=v.source_id
           WHERE a.id=?
           ORDER BY r.verified_at DESC, v.occurrence_order DESC LIMIT 1`
        )
        .get(id) as
        (Omit<MailArchiveAttachmentLocation, 'sourcePath'> & { root: string }) | undefined
      if (!row) return null
      const { root, ...location } = row
      // EML 폴더 자료원은 루트 + 상대 경로가 원본 파일이다. 루트 밖으로 나가는 경로는 거절한다.
      const sourcePath = row.sourceKind === 'eml' && row.itemKey ? join(root, row.itemKey) : root
      if (!isInside(root, sourcePath)) return null
      return { ...location, sourcePath }
    },

    sourcePathInUse: (path) => {
      const target = normalizedSourcePath(path)
      const roots = db.prepare('SELECT source_path AS root FROM archive_source').all() as Array<{
        root: string
      }>
      return roots.some(({ root }) => isInside(normalizedSourcePath(root), target))
    },

    sources: () => {
      const rows = db
        .prepare(
          `SELECT s.source_id AS id, s.source_kind AS kind, s.source_path AS sourcePath,
             COUNT(DISTINCT v.mail_id) AS messageCount,
             COUNT(DISTINCT CASE WHEN EXISTS (
               SELECT 1 FROM archive_visible_occurrence other
               WHERE other.mail_id=v.mail_id AND other.source_id<>s.source_id
             ) THEN v.mail_id END) AS sharedMessageCount
           FROM archive_source s
           LEFT JOIN archive_visible_occurrence v ON v.source_id=s.source_id
           GROUP BY s.source_id
           ORDER BY s.created_at, s.source_id`
        )
        .all() as Array<Omit<MailArchiveSource, 'name'> & { sourcePath: string }>
      return rows.map(({ sourcePath, ...row }) => ({ ...row, name: basename(sourcePath) }))
    },

    removeSource: db.transaction((sourceId: string): MailArchiveSourceDeletion | null => {
      const source = db
        .prepare('SELECT source_path AS sourcePath FROM archive_source WHERE source_id=?')
        .get(sourceId) as { sourcePath: string } | undefined
      if (!source) return null
      const counts = db
        .prepare(
          `SELECT COUNT(DISTINCT o.mail_id) AS total,
             COUNT(DISTINCT CASE WHEN EXISTS (
               SELECT 1 FROM archive_source_occurrence other
               WHERE other.mail_id=o.mail_id AND other.source_id<>o.source_id
             ) THEN o.mail_id END) AS preserved
           FROM archive_source_occurrence o WHERE o.source_id=?`
        )
        .get(sourceId) as { total: number; preserved: number }
      db.prepare('DELETE FROM archive_source_occurrence WHERE source_id=?').run(sourceId)
      db.prepare('DELETE FROM archive_source_revision WHERE source_id=?').run(sourceId)
      db.prepare('DELETE FROM archive_source WHERE source_id=?').run(sourceId)
      deleteOrphanMail.run()
      rebuildRelations()
      return {
        sourceName: basename(source.sourcePath),
        removedMessages: counts.total - counts.preserved,
        preservedMessages: counts.preserved
      }
    }),

    stats: () => {
      const row = db
        .prepare(
          `SELECT COUNT(DISTINCT v.mail_id) AS total,
             COUNT(DISTINCT CASE WHEN s.source_kind='eml' THEN v.mail_id END) AS eml,
             COUNT(DISTINCT CASE WHEN s.source_kind='pst' THEN v.mail_id END) AS pst
           FROM archive_visible_occurrence v JOIN archive_source s ON s.source_id=v.source_id`
        )
        .get() as { total: number; eml: number; pst: number }
      return { totalMessages: row.total, emlMessages: row.eml, pstMessages: row.pst }
    },

    close: () => db.close()
  }
}
