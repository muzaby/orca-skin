import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { applyMailMigrations } from './migrate'
import { sanitizeAttachmentFilename } from '../attachment-export'
import type { MailDocument, MailSearchHit } from '../types'
import type { ProtectionState } from '../protection'

export interface MailStoreOptions {
  readonly root: string
  readonly accountId: string
  readonly authId: string
  readonly host: string
  readonly port: number
  readonly tls: boolean
  readonly now?: () => number
}

export interface MailSyncState {
  readonly lastSyncAt: number | null
  readonly lastErrorCode: string | null
  readonly protection: ProtectionState
}

export interface StoredAttachment {
  readonly id: string
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: number
  readonly storedName: string
}

export interface MailStore {
  readonly dbPath: string
  readonly attachmentRoot: string
  state(): MailSyncState
  saveState(state: {
    lastSyncAt?: number | null
    lastErrorCode?: string | null
    protection?: ProtectionState
  }): void
  ledger(): { uidl: string; messageNumber: number; state: 'active' | 'missing' }[]
  markMissing(uidls: readonly string[]): void
  saveMessage(document: MailDocument): Promise<void>
  cleanupExpired(now: number, retentionDays?: number): Promise<number>
  search(query: string, limit: number, mode?: 'match' | 'like'): MailSearchHit[]
  findAttachment(
    mailId: string,
    attachmentId: string
  ): Promise<(StoredAttachment & { path: string }) | null>
  readAttachment(attachment: StoredAttachment & { path: string }): Promise<Uint8Array>
  countMail(): number
  close(): void
}

function protectionFromRow(row: {
  protection_kind: string
  protection_first_observed_at: number | null
  protection_observations: number | null
  protection_fingerprint: string | null
}): ProtectionState {
  return row.protection_kind === 'suspected'
    ? {
        kind: 'suspected',
        firstObservedAt: row.protection_first_observed_at ?? undefined,
        observations: row.protection_observations ?? undefined,
        fingerprint: row.protection_fingerprint ?? undefined
      }
    : { kind: 'none' }
}

function safeRoot(root: string, accountId: string): string {
  const safeAccountId = accountId.replace(/[^A-Za-z0-9._-]/g, '_') || '_'
  return join(root, 'plugins', 'mail', safeAccountId)
}

export async function createMailStore(options: MailStoreOptions): Promise<MailStore> {
  const accountRoot = safeRoot(options.root, options.accountId)
  const attachmentRoot = join(accountRoot, 'attachments')
  await mkdir(attachmentRoot, { recursive: true })
  const dbPath = join(accountRoot, 'mail.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applyMailMigrations(db)
  db.prepare(
    `INSERT INTO account (id, auth_id, host, port, tls, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET auth_id=excluded.auth_id, host=excluded.host, port=excluded.port, tls=excluded.tls`
  ).run(
    options.accountId,
    options.authId,
    options.host,
    options.port,
    options.tls ? 1 : 0,
    (options.now ?? Date.now)()
  )
  db.prepare(
    `INSERT INTO sync_state (account_id, last_sync_at, last_error_code, protection_kind)
     VALUES (?, NULL, NULL, 'none') ON CONFLICT(account_id) DO NOTHING`
  ).run(options.accountId)

  const getStateRow = (): {
    last_sync_at: number | null
    last_error_code: string | null
    protection_kind: string
    protection_first_observed_at: number | null
    protection_observations: number | null
    protection_fingerprint: string | null
  } =>
    db
      .prepare(
        'SELECT last_sync_at, last_error_code, protection_kind, protection_first_observed_at, protection_observations, protection_fingerprint FROM sync_state WHERE account_id = ?'
      )
      .get(options.accountId) as {
      last_sync_at: number | null
      last_error_code: string | null
      protection_kind: string
      protection_first_observed_at: number | null
      protection_observations: number | null
      protection_fingerprint: string | null
    }

  return {
    dbPath,
    attachmentRoot,
    state: () => {
      const row = getStateRow()
      return {
        lastSyncAt: row.last_sync_at,
        lastErrorCode: row.last_error_code,
        protection: protectionFromRow(row)
      }
    },
    saveState: (next) => {
      const current = getStateRow()
      const protection = next.protection ?? protectionFromRow(current)
      db.prepare(
        `UPDATE sync_state SET last_sync_at=?, last_error_code=?, protection_kind=?, protection_first_observed_at=?, protection_observations=?, protection_fingerprint=? WHERE account_id=?`
      ).run(
        next.lastSyncAt === undefined ? current.last_sync_at : next.lastSyncAt,
        next.lastErrorCode === undefined ? current.last_error_code : next.lastErrorCode,
        protection.kind,
        protection.kind === 'suspected' ? (protection.firstObservedAt ?? null) : null,
        protection.kind === 'suspected' ? (protection.observations ?? null) : null,
        protection.kind === 'suspected' ? (protection.fingerprint ?? null) : null,
        options.accountId
      )
    },
    ledger: () =>
      db
        .prepare(
          'SELECT uidl, message_number AS messageNumber, state FROM uidl_ledger WHERE account_id = ?'
        )
        .all(options.accountId) as {
        uidl: string
        messageNumber: number
        state: 'active' | 'missing'
      }[],
    markMissing: (uidls) => {
      if (uidls.length === 0) return
      const update = db.prepare(
        `UPDATE uidl_ledger SET state='missing' WHERE account_id=? AND uidl=?`
      )
      const transaction = db.transaction(() =>
        uidls.forEach((uidl) => update.run(options.accountId, uidl))
      )
      transaction()
    },
    saveMessage: async (document) => {
      const written: string[] = []
      try {
        const storedNames = new Map<number, string>()
        for (const [index, attachment] of document.attachments.entries()) {
          if (!attachment.bytes) continue
          const storedName = `${randomUUID()}-${sanitizeAttachmentFilename(attachment.filename)}`
          await writeFile(join(attachmentRoot, storedName), attachment.bytes, {
            flag: 'wx',
            mode: 0o600
          })
          written.push(storedName)
          storedNames.set(index, storedName)
        }
        const previous = db
          .prepare(
            'SELECT a.stored_name AS storedName FROM attachment a JOIN mail m ON m.id=a.mail_id WHERE m.account_id=? AND m.uidl=?'
          )
          .all(options.accountId, document.uidl) as { storedName: string }[]
        const transaction = db.transaction(() => {
          const result = db
            .prepare(
              `INSERT INTO mail (account_id, uidl, header_date, first_seen_at, from_addr, to_addrs, cc_addrs, subject, body_text, size_bytes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(account_id, uidl) DO UPDATE SET header_date=excluded.header_date, from_addr=excluded.from_addr, to_addrs=excluded.to_addrs, cc_addrs=excluded.cc_addrs, subject=excluded.subject, body_text=excluded.body_text, size_bytes=excluded.size_bytes`
            )
            .run(
              options.accountId,
              document.uidl,
              document.headerDate,
              document.firstSeenAt,
              document.fromAddr,
              document.toAddrs,
              document.ccAddrs,
              document.subject,
              document.bodyText,
              document.sizeBytes ?? 0
            )
          const row = db
            .prepare('SELECT id FROM mail WHERE account_id=? AND uidl=?')
            .get(options.accountId, document.uidl) as { id: number }
          db.prepare(
            `INSERT INTO uidl_ledger (account_id, uidl, message_number, first_seen_at, state) VALUES (?, ?, ?, ?, 'active') ON CONFLICT(account_id, uidl) DO UPDATE SET message_number=excluded.message_number, state='active'`
          ).run(options.accountId, document.uidl, document.messageNumber, document.firstSeenAt)
          if (result.changes > 0) db.prepare('DELETE FROM attachment WHERE mail_id=?').run(row.id)
          const insertAttachment = db.prepare(
            'INSERT INTO attachment (mail_id, filename, mime_type, size_bytes, stored_name) VALUES (?, ?, ?, ?, ?)'
          )
          document.attachments.forEach((attachment, index) => {
            const storedName = storedNames.get(index)
            if (storedName)
              insertAttachment.run(
                row.id,
                attachment.filename,
                attachment.mimeType,
                attachment.sizeBytes,
                storedName
              )
          })
        })
        transaction()
        await Promise.all(
          previous.map((row) =>
            unlink(join(attachmentRoot, basename(row.storedName))).catch(() => undefined)
          )
        )
      } catch (error) {
        await Promise.all(
          written.map((name) => unlink(join(attachmentRoot, name)).catch(() => undefined))
        )
        throw error
      }
    },
    cleanupExpired: async (now, retentionDays = 14) => {
      const cutoff = now - retentionDays * 24 * 60 * 60 * 1000
      const rows = db
        .prepare(
          `SELECT m.id, a.stored_name AS storedName FROM mail m LEFT JOIN attachment a ON a.mail_id=m.id WHERE m.account_id=? AND COALESCE(m.header_date,m.first_seen_at) < ?`
        )
        .all(options.accountId, cutoff) as { id: number; storedName: string | null }[]
      if (rows.length === 0) return 0
      const transaction = db.transaction(() =>
        rows.forEach((row) => db.prepare('DELETE FROM mail WHERE id=?').run(row.id))
      )
      transaction()
      await Promise.all(
        rows
          .filter((row) => row.storedName)
          .map((row) =>
            unlink(join(attachmentRoot, row.storedName as string)).catch(() => undefined)
          )
      )
      return new Set(rows.map((row) => row.id)).size
    },
    search: (query, limit, mode = 'match') => {
      const rows = query.trim()
        ? mode === 'like'
          ? db
              .prepare(
                `SELECT m.id, COALESCE(m.header_date,m.first_seen_at) AS date, m.from_addr AS fromAddr, m.to_addrs AS toAddrs, m.subject, m.body_text AS bodyText, 0 AS rank FROM mail m WHERE m.account_id=? AND (m.from_addr || ' ' || m.to_addrs || ' ' || m.cc_addrs || ' ' || m.subject || ' ' || m.body_text) LIKE ? ESCAPE '\\' ORDER BY date DESC LIMIT ?`
              )
              .all(options.accountId, query, limit)
          : db
              .prepare(
                `SELECT m.id, COALESCE(m.header_date,m.first_seen_at) AS date, m.from_addr AS fromAddr, m.to_addrs AS toAddrs, m.subject, m.body_text AS bodyText, bm25(mail_fts) AS rank FROM mail_fts JOIN mail m ON m.id=mail_fts.rowid WHERE m.account_id=? AND mail_fts MATCH ? ORDER BY rank LIMIT ?`
              )
              .all(options.accountId, query, limit)
        : db
            .prepare(
              `SELECT m.id, COALESCE(m.header_date,m.first_seen_at) AS date, m.from_addr AS fromAddr, m.to_addrs AS toAddrs, m.subject, m.body_text AS bodyText, 0 AS rank FROM mail m WHERE m.account_id=? ORDER BY date DESC LIMIT ?`
            )
            .all(options.accountId, limit)
      return (
        rows as {
          id: number
          date: number
          fromAddr: string
          toAddrs: string
          subject: string
          bodyText: string
          rank: number
        }[]
      ).map((row) => {
        const attachments = db
          .prepare(
            'SELECT id, filename, mime_type AS mimeType, size_bytes AS sizeBytes FROM attachment WHERE mail_id=? ORDER BY id'
          )
          .all(row.id) as { id: number; filename: string; mimeType: string; sizeBytes: number }[]
        const visible = attachments.slice(0, 10).map((attachment) => ({
          attachmentId: String(attachment.id),
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes
        }))
        return {
          mailId: String(row.id),
          date: row.date,
          from: row.fromAddr,
          to: row.toAddrs,
          subject: row.subject,
          snippet: row.bodyText.slice(0, 300),
          rank: row.rank,
          attachmentCount: attachments.length,
          attachments: visible,
          ...(attachments.length > visible.length ? { attachmentsTruncated: true } : {})
        }
      })
    },
    findAttachment: async (mailId, attachmentId) => {
      const row = db
        .prepare(
          'SELECT id, filename, mime_type AS mimeType, size_bytes AS sizeBytes, stored_name AS storedName FROM attachment WHERE mail_id=? AND id=?'
        )
        .get(Number(mailId), Number(attachmentId)) as
        | { id: number; filename: string; mimeType: string; sizeBytes: number; storedName: string }
        | undefined
      if (!row) return null
      return {
        id: String(row.id),
        filename: row.filename,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        storedName: row.storedName,
        path: join(attachmentRoot, basename(row.storedName))
      }
    },
    readAttachment: (attachment) => readFile(attachment.path),
    countMail: () =>
      (
        db
          .prepare('SELECT COUNT(*) AS count FROM mail WHERE account_id=?')
          .get(options.accountId) as { count: number }
      ).count,
    close: () => db.close()
  }
}
