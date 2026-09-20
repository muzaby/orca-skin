import { createHash } from 'node:crypto'
import { isFresh } from './freshness'
import { buildMailQuery } from './query-builder'
import { reconcileUidls } from './reconcile'
import { decideProtection } from './protection'
import { parseMail } from './mime'
import { Pop3Error, normalizePop3Error } from './pop3/errors'
import { createPop3Session, type Pop3Session } from './pop3/session'
import { splitMailCredential } from './auth'
import { createMailStore, type MailStore } from './store'
import type { MailEndpoint } from './endpoint'
import type {
  MailPluginOptions,
  MailSearchResult,
  MailSyncResult,
  MailSyncStageEvent,
  Pop3SocketFactory
} from './types'

export interface MailSyncManagerOptions {
  readonly authId: string
  /** `PluginAuth.origin` 에서 파생한 연결 좌표 (0237 ΔV2 — D-054). 두 번째 사본이 없다. */
  readonly endpoint: MailEndpoint
  /** `PluginAuth.secret()` — authId 가 닫힌 closure 다 (D-055). */
  readonly secret: () => string | null
  readonly options: MailPluginOptions
  /** `PluginAuth.reportAuthFailure()` — 인자가 없다. 자격증명 거부만 여기로 온다 (D-055). */
  readonly reportAuthFailure?: () => void
  /** 테스트 seam. 프로덕션은 `pop3/session.ts` 의 기본값(infra)을 쓴다 (D-058). */
  readonly socketFactory?: Pop3SocketFactory
  /** 테스트 seam. 프로덕션은 `pluginDataDir()` 이 해석한다 (D-057). */
  readonly dataDir?: string
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

function signalOrUndefined(signal: AbortSignal | undefined): AbortSignal | undefined {
  return signal
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) throw new Pop3Error('cancelled')
  let timer: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined
  const abort = new Promise<never>((_, reject) => {
    if (!signal) return
    abortHandler = () => reject(new Pop3Error('cancelled'))
    signal.addEventListener('abort', abortHandler, { once: true })
  })
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Pop3Error('timeout')), timeoutMs)
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
    ...(options.dataDir ? { dataDir: options.dataDir } : {}),
    accountId: options.options.accountId,
    authId: options.authId,
    host: options.endpoint.host,
    port: options.endpoint.port,
    tls: options.endpoint.tls,
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
        // `PluginAuth.secret()` 는 `passwordSpec` 이 접은 `user:pass` 한 문자열이다 — 아이디를
        // 따로 받지 않는다(두 번째 사본 금지). 값이 없으면 커밋된 자격증명이 없다는 뜻이다.
        const credential = options.secret()
        if (!credential) throw new Pop3Error('auth_failed')
        const { user, password } = splitMailCredential(credential)
        onStage?.({ stage: 'connect' })
        const session: Pop3Session = createPop3Session(
          {
            host: options.endpoint.host,
            port: options.endpoint.port,
            tls: options.endpoint.tls,
            ...(options.options.tlsOptions ? { tlsOptions: options.options.tlsOptions } : {}),
            ...(options.options.timeouts?.commandMs
              ? { timeoutMs: options.options.timeouts.commandMs }
              : {}),
            user,
            password,
            signal: signalOrUndefined(signal)
          },
          options.socketFactory
        )
        const abortSession = (): void => session.destroy()
        signal?.addEventListener('abort', abortSession, { once: true })
        let destroySession = false
        try {
          await withTimeout(session.login(), options.options.timeouts?.connectMs ?? 15_000, signal)
          onStage?.({ stage: 'uidl' })
          const remote = await withTimeout(
            session.uidls(),
            options.options.timeouts?.commandMs ?? 30_000,
            signal
          )
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
          const newest = [...remote].sort((a, b) => b.messageNumber - a.messageNumber)
          let oldHeaders = 0
          const grace = 50
          for (const item of newest) {
            if (signal?.aborted) throw new Pop3Error('cancelled')
            if (!reconciled.fresh.includes(item.uidl)) continue
            onStage?.({ stage: 'top' })
            const top = await withTimeout(
              session.top(item.messageNumber),
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
            onStage?.({ stage: 'retr' })
            const raw = await withTimeout(
              session.retr(item.messageNumber),
              options.options.timeouts?.commandMs ?? 30_000,
              signal
            )
            const document = await parseMail(raw, {
              uidl: item.uidl,
              messageNumber: item.messageNumber,
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
          const normalized = normalizePop3Error(error)
          destroySession = normalized.code === 'timeout' || normalized.code === 'cancelled'
          throw error
        } finally {
          signal?.removeEventListener('abort', abortSession)
          if (signal?.aborted || destroySession) session.destroy()
          else await session.quit().catch(() => session.destroy())
        }
      } catch (error) {
        const normalized = normalizePop3Error(error)
        store.saveState({ lastErrorCode: normalized.code })
        if (normalized.authFailure) options.reportAuthFailure?.()
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
