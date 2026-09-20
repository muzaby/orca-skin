import { createHash } from 'node:crypto'
import { isFresh } from './freshness'
import { buildMailQuery } from './query-builder'
import { reconcileUidls } from './reconcile'
import { decideProtection } from './protection'
import { parseMail } from './mime'
import { Pop3Error, normalizePop3Error } from './pop3/errors'
import { withMailSession } from './auth'
import type { PluginAuth } from '../../../contracts/auth'
import { createMailStore, type MailStore } from './store'
import type {
  MailPluginOptions,
  MailSearchResult,
  MailSyncResult,
  MailSyncStageEvent,
  Pop3SocketFactory
} from './types'

export interface MailSyncManagerOptions {
  readonly auth: PluginAuth
  readonly options: MailPluginOptions
  readonly socketFactory: Pop3SocketFactory
  readonly root: string
  readonly now?: () => number
}

export interface MailSyncManager {
  readonly store: MailStore
  sync(signal?: AbortSignal, onStage?: (event: MailSyncStageEvent) => void): Promise<MailSyncResult>
  search(query: string, limit?: number, now?: number): MailSearchResult
  getAttachment(
    mailId: string,
    attachmentId: string
  ): Promise<{ filename: string; mimeType: string; sizeBytes: number; bytes: Uint8Array } | null>
  close(): void
}

function fingerprint(uidls: readonly { messageNumber: number; uidl: string }[]): string {
  return createHash('sha256')
    .update(uidls.map((item) => `${item.messageNumber}:${item.uidl}`).join('\n'))
    .digest('hex')
}

function dateFromHeaders(raw: string): number | null {
  const match = raw.match(/^Date:\s*(.+)$/im)
  if (!match) return null
  const date = Date.parse(match[1])
  return Number.isFinite(date) ? date : null
}

export async function createMailSyncManager(
  options: MailSyncManagerOptions
): Promise<MailSyncManager> {
  const store = await createMailStore({
    root: options.root,
    accountId: options.options.accountId,
    authId: options.auth.authId,
    host: options.options.host,
    port: options.options.port ?? (options.options.tls === false ? 110 : 995),
    tls: options.options.tls !== false,
    now: options.now
  })
  let inFlight: Promise<MailSyncResult> | undefined
  const now = options.now ?? Date.now

  const sync = async (
    signal?: AbortSignal,
    onStage?: (event: MailSyncStageEvent) => void
  ): Promise<MailSyncResult> => {
    if (inFlight) return inFlight
    const budget = new AbortController()
    const timeout = setTimeout(() => budget.abort(), options.options.timeouts?.syncMs ?? 120_000)
    const operationSignal = signal ? AbortSignal.any([signal, budget.signal]) : budget.signal
    inFlight = (async () => {
      const current = store.state()
      const timestamp = now()
      onStage?.({ stage: 'freshness' })
      try {
        if (operationSignal.aborted) throw new Pop3Error('cancelled')
        onStage?.({ stage: 'cleanup' })
        const expired = await store.cleanupExpired(timestamp, options.options.retentionDays)
        if (
          isFresh({
            now: timestamp,
            lastSyncAt: current.lastSyncAt,
            freshnessMs: options.options.freshnessMs
          })
        ) {
          return { synced: false, fresh: true, lastSyncAt: current.lastSyncAt }
        }
        return await options.auth.withCredential(async (credential, reject) => {
          try {
            onStage?.({ stage: 'connect' })
            const result = await withMailSession<MailSyncResult>(
              credential,
              options.options,
              options.socketFactory,
              operationSignal,
              async (session) => {
                onStage?.({ stage: 'uidl' })
                const remote = await session.uidls()
                const local = store.ledger()
                const reconciled = reconcileUidls(
                  local,
                  remote.map((item) => item.uidl)
                )
                const protection = decideProtection({
                  retainedRatio: reconciled.retainedRatio,
                  activeLedgerCount: reconciled.activeLedgerCount,
                  now: timestamp,
                  remoteFingerprint: fingerprint(remote),
                  previous: current.protection
                })
                store.saveState({ protection: protection.state })
                if (!protection.ingest) {
                  store.saveState({ lastErrorCode: 'bulk_loss_suspected' })
                  return {
                    synced: false,
                    error: 'bulk_loss_suspected',
                    stale: true,
                    lastSyncAt: current.lastSyncAt,
                    protection: 'bulk_loss_suspected',
                    newMails: 0,
                    removed: 0
                  }
                }
                // 보호 관측 중에는 다음 비교의 활성 ledger 기준을 유지한다.
                store.markMissing(reconciled.missing)
                let processed = 0
                const newest = [...remote].sort((a, b) => b.messageNumber - a.messageNumber)
                let oldHeaders = 0
                const grace = 50
                for (const item of newest) {
                  if (operationSignal.aborted)
                    throw new Pop3Error(budget.signal.aborted ? 'timeout' : 'cancelled')
                  if (!reconciled.fresh.includes(item.uidl)) continue
                  onStage?.({ stage: 'top' })
                  const top = await session.top(item.messageNumber)
                  const date = dateFromHeaders(top)
                  if (
                    date !== null &&
                    date < timestamp - (options.options.retentionDays ?? 14) * 24 * 60 * 60 * 1000
                  ) {
                    oldHeaders += 1
                    if (oldHeaders >= grace) break
                    continue
                  }
                  onStage?.({ stage: 'retr' })
                  const raw = await session.retr(item.messageNumber)
                  const document = await parseMail(raw, {
                    uidl: item.uidl,
                    messageNumber: item.messageNumber,
                    firstSeenAt: timestamp
                  })
                  onStage?.({ stage: 'persist' })
                  await store.saveMessage(document, operationSignal)
                  processed += 1
                }
                return { synced: true, newMails: processed, expired, lastSyncAt: timestamp }
              }
            )
            if (result.synced)
              store.saveState({
                lastSyncAt: timestamp,
                lastErrorCode: null,
                protection: { kind: 'none' }
              })
            return result
          } catch (error) {
            if (normalizePop3Error(error).authFailure) reject()
            throw error
          }
        })
      } catch (error) {
        const normalized = normalizePop3Error(
          budget.signal.aborted
            ? new Pop3Error('timeout')
            : operationSignal.aborted
              ? new Pop3Error('cancelled')
              : error
        )
        store.saveState({ lastErrorCode: normalized.code })
        return {
          synced: false,
          error: normalized.code,
          stale: true,
          lastSyncAt: store.state().lastSyncAt
        }
      }
    })()
    try {
      return await inFlight
    } finally {
      clearTimeout(timeout)
      inFlight = undefined
    }
  }

  return {
    store,
    sync,
    search: (query, limit = 20, at = now()) => {
      const built = buildMailQuery(query)
      const state = store.state()
      return {
        cacheAsOf: state.lastSyncAt,
        stale: !isFresh({
          now: at,
          lastSyncAt: state.lastSyncAt,
          freshnessMs: options.options.freshnessMs
        }),
        total: store.search(built.parameter, Math.min(Math.max(limit, 1), 50), built.mode).length,
        results: store.search(built.parameter, Math.min(Math.max(limit, 1), 50), built.mode)
      }
    },
    getAttachment: async (mailId, attachmentId) => {
      const attachment = await store.findAttachment(mailId, attachmentId)
      if (!attachment) return null
      return {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        bytes: await store.readAttachment(attachment)
      }
    },
    close: () => store.close()
  }
}
