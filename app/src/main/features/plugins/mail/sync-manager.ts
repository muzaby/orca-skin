import { createHash } from 'node:crypto'
import { isFresh } from './freshness'
import { buildMailQuery } from './query-builder'
import { reconcileRemoteUids } from './reconcile'
import { decideProtection } from './protection'
import { parseMail } from './mime'
import { MailError, normalizeMailError } from './errors'
import { createMailStore, type MailStore } from './store'
import type { MailMessageRef, MailReadSession, MailReadSessionFactory } from './transport'
import type { CredentialMaterial } from '../../../contracts/auth'
import type {
  MailPluginOptions,
  MailSearchResult,
  MailSyncResult,
  MailSyncStageEvent,
  Pop3SocketFactory
} from './types'

// **프로토콜 모듈을 import 하지 않는다** (0237 D-056 · §10 EP-25). 세션은 주입된 factory 가
// 만들고, 이 파일은 `MailReadSession` 4메서드만 안다 — 두 번째 프로토콜이 여기를 고치지 않고
// 들어올 수 있는 이유가 그것이다.
export interface MailSyncManagerOptions {
  readonly authId: string
  // **선언이 편 형태**로 받는다 (D-054). 문자열을 받아 `:` 로 쪼개던 것이 0237 G4 다.
  readonly credential: () => CredentialMaterial | null
  readonly options: MailPluginOptions
  readonly sessionFactory: MailReadSessionFactory
  readonly socketFactory: Pop3SocketFactory
  readonly root: string
  readonly now?: () => number
  readonly reportCredentialRejected?: (authId: string) => void
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

function fingerprint(refs: readonly MailMessageRef[]): string {
  return createHash('sha256')
    .update(refs.map((item) => `${item.ordinal}:${item.uid}`).join('\n'))
    .digest('hex')
}

function dateFromHeaders(raw: string): number | null {
  const match = raw.match(/^Date:\s*(.+)$/im)
  if (!match) return null
  const date = Date.parse(match[1])
  return Number.isFinite(date) ? date : null
}

function signalOrUndefined(signal: AbortSignal | undefined): AbortSignal | undefined {
  return signal
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) throw new MailError('cancelled')
  let timer: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined
  const abort = new Promise<never>((_, reject) => {
    if (!signal) return
    abortHandler = () => reject(new MailError('cancelled'))
    signal.addEventListener('abort', abortHandler, { once: true })
  })
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new MailError('timeout')), timeoutMs)
  })
  try {
    return await Promise.race([promise, abort, timeout])
  } finally {
    if (timer) clearTimeout(timer)
    if (signal && abortHandler) signal.removeEventListener('abort', abortHandler)
  }
}

export async function createMailSyncManager(
  options: MailSyncManagerOptions
): Promise<MailSyncManager> {
  const store = await createMailStore({
    root: options.root,
    accountId: options.options.accountId,
    authId: options.authId,
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
    inFlight = (async () => {
      const current = store.state()
      const timestamp = now()
      onStage?.({ stage: 'freshness' })
      try {
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
        const credential = options.credential()
        if (!credential) throw new MailError('auth_failed')
        onStage?.({ stage: 'connect' })
        const session: MailReadSession = options.sessionFactory({
          connection: {
            host: options.options.host,
            port: options.options.port ?? (options.options.tls === false ? 110 : 995),
            tls: options.options.tls !== false,
            ...(options.options.tlsOptions ? { tlsOptions: options.options.tlsOptions } : {}),
            ...(options.options.timeouts?.commandMs
              ? { timeoutMs: options.options.timeouts.commandMs }
              : {})
          },
          credential,
          socketFactory: options.socketFactory,
          ...(signalOrUndefined(signal) ? { signal } : {})
        })
        const abortSession = (): void => void session.close('abort')
        signal?.addEventListener('abort', abortSession, { once: true })
        let destroySession = false
        try {
          await withTimeout(session.login(), options.options.timeouts?.connectMs ?? 15_000, signal)
          onStage?.({ stage: 'list' })
          const remote = await withTimeout(
            session.list(),
            options.options.timeouts?.commandMs ?? 30_000,
            signal
          )
          const local = store.ledger()
          const reconciled = reconcileRemoteUids(
            local,
            remote.map((item) => item.uid)
          )
          const protection = decideProtection({
            retainedRatio: reconciled.retainedRatio,
            activeLedgerCount: reconciled.activeLedgerCount,
            now: timestamp,
            remoteFingerprint: fingerprint(remote),
            previous: current.protection
          })
          store.markMissing(reconciled.missing)
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
          let processed = 0
          const newest = [...remote].sort((a, b) => b.ordinal - a.ordinal)
          let oldHeaders = 0
          const grace = 50
          for (const item of newest) {
            if (signal?.aborted) throw new MailError('cancelled')
            if (!reconciled.fresh.includes(item.uid)) continue
            onStage?.({ stage: 'header' })
            const top = await withTimeout(
              session.header(item),
              options.options.timeouts?.commandMs ?? 30_000,
              signal
            )
            const date = dateFromHeaders(top)
            if (
              date !== null &&
              date < timestamp - (options.options.retentionDays ?? 14) * 24 * 60 * 60 * 1000
            ) {
              oldHeaders += 1
              if (oldHeaders >= grace) break
              continue
            }
            onStage?.({ stage: 'body' })
            const raw = await withTimeout(
              session.body(item),
              options.options.timeouts?.commandMs ?? 30_000,
              signal
            )
            const document = await parseMail(raw, {
              remoteUid: item.uid,
              ordinal: item.ordinal,
              firstSeenAt: timestamp
            })
            onStage?.({ stage: 'persist' })
            await store.saveMessage(document)
            processed += 1
          }
          store.saveState({
            lastSyncAt: timestamp,
            lastErrorCode: null,
            protection: { kind: 'none' }
          })
          return { synced: true, newMails: processed, expired, lastSyncAt: timestamp }
        } catch (error) {
          const normalized = normalizeMailError(error)
          destroySession = normalized.code === 'timeout' || normalized.code === 'cancelled'
          throw error
        } finally {
          signal?.removeEventListener('abort', abortSession)
          await session
            .close(signal?.aborted || destroySession ? 'abort' : 'graceful')
            .catch(() => session.close('abort'))
        }
      } catch (error) {
        const normalized = normalizeMailError(error)
        store.saveState({ lastErrorCode: normalized.code })
        if (normalized.authFailure) options.reportCredentialRejected?.(options.authId)
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
