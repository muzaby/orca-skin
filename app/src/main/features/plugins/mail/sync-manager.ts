import { sliceBody } from './body-window'
import { joinsRunningSync, syncPlan, type MailSyncMode } from './sync-mode'
import { createHash } from 'node:crypto'
import { isFresh } from './freshness'
import { buildMailQuery } from './query-builder'
import { reconcileUidls } from './reconcile'
import { decideProtection } from './protection'
import { decideIngest, retentionCutoff } from './retention-window'
import { parseMail } from './mime'
import { Pop3Error, normalizePop3Error } from './pop3/errors'
import { withMailSession } from './auth'
import type { PluginAuth } from '../../../contracts/auth'
import { createMailStore, type MailStore } from './store'
import { getLogger } from '../../../infra/log/registry'
import { errorMessage } from '../../../infra/errors'
import type {
  MailBodyPage,
  MailPluginOptions,
  MailSearchResult,
  MailSessionConfig,
  MailSyncResult,
  MailSyncStageEvent,
  Pop3SocketFactory
} from './types'

export interface MailSyncManagerOptions {
  readonly auth: PluginAuth
  readonly options: MailPluginOptions
  // 좌표는 호출자가 `auth.origin` 에서 되읽어 넘긴다 (`mailSessionConfig`).
  readonly session: MailSessionConfig
  readonly socketFactory: Pop3SocketFactory
  readonly root: string
  readonly now?: () => number
}

export interface MailSyncManager {
  readonly store: MailStore
  sync(
    signal?: AbortSignal,
    onStage?: (event: MailSyncStageEvent) => void,
    mode?: MailSyncMode
  ): Promise<MailSyncResult>
  getMail(mailId: string, offset?: number, maxChars?: number): MailBodyPage | null
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
    host: options.session.host,
    port: options.session.port,
    tls: options.session.tls,
    now: options.now
  })
  let inFlight: { promise: Promise<MailSyncResult>; mode: MailSyncMode } | undefined
  const now = options.now ?? Date.now

  const sync = async (
    signal?: AbortSignal,
    onStage?: (event: MailSyncStageEvent) => void,
    mode: MailSyncMode = 'incremental'
  ): Promise<MailSyncResult> => {
    if (inFlight) {
      if (joinsRunningSync(inFlight.mode, mode)) return inFlight.promise
      await inFlight.promise.catch(() => undefined)
      return sync(signal, onStage, mode)
    }
    const plan = syncPlan(mode)
    const operationSignal = signal ?? new AbortController().signal
    const promise: Promise<MailSyncResult> = (async (): Promise<MailSyncResult> => {
      const current = store.state()
      const timestamp = now()
      onStage?.({ stage: 'freshness' })
      try {
        if (operationSignal.aborted) throw new Pop3Error('cancelled')
        onStage?.({ stage: 'cleanup' })
        const expired = await store.cleanupExpired(timestamp, options.options.retentionDays)
        if (
          !plan.bypassFreshness &&
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
              options.session,
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
                const active = new Set(
                  local.filter((entry) => entry.state === 'active').map((entry) => entry.uidl)
                )
                let updatedMails = 0
                let processed = 0
                // 본문 없이 저장한 수 · 파싱 실패로 건너뛴 수 (0302 D-007).
                let noBodyMails = 0
                let skippedMails = 0
                const newest = [...remote].sort((a, b) => b.messageNumber - a.messageNumber)
                // 연속 카운트는 `decideIngest`가 돌려주는 값만 쓴다 (D-062 · EP-28 ②).
                let consecutiveOld = 0
                const cutoff = retentionCutoff(timestamp, options.options.retentionDays)
                for (const item of newest) {
                  if (operationSignal.aborted) throw new Pop3Error('cancelled')
                  if (!plan.refetchKnown && !reconciled.fresh.includes(item.uidl)) continue
                  onStage?.({ stage: 'top' })
                  const top = await session.top(item.messageNumber)
                  const decision = decideIngest({
                    headerDate: dateFromHeaders(top),
                    cutoff,
                    consecutiveOld
                  })
                  consecutiveOld = decision.consecutiveOld
                  if (decision.action === 'stop') break
                  if (decision.action === 'skip') continue
                  onStage?.({ stage: 'retr' })
                  const raw = await session.retr(item.messageNumber)
                  // 파싱만 메시지별로 격리한다. 네트워크·저장·취소는 동기화 전체로 전파한다 (D-009).
                  // 건너뛴 메시지는 ledger 에 쓰지 않으므로 다음 비-fresh 동기화가 다시 받는다.
                  let document: Awaited<ReturnType<typeof parseMail>>
                  try {
                    document = await parseMail(raw, {
                      uidl: item.uidl,
                      messageNumber: item.messageNumber,
                      firstSeenAt: timestamp
                    })
                  } catch (error) {
                    skippedMails += 1
                    getLogger().warn('mail.sync.parse_failed', {
                      uidl: item.uidl,
                      message: errorMessage(error)
                    })
                    continue
                  }
                  onStage?.({ stage: 'persist' })
                  await store.saveMessage(document, operationSignal)
                  if (active.has(item.uidl)) updatedMails += 1
                  else processed += 1
                  if (document.bodySource === 'none') {
                    noBodyMails += 1
                    getLogger().warn('mail.sync.body_none', { uidl: item.uidl })
                  }
                }
                return {
                  synced: true,
                  mode,
                  updatedMails,
                  newMails: processed,
                  expired,
                  lastSyncAt: timestamp,
                  noBodyMails,
                  skippedMails
                }
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
          operationSignal.aborted ? new Pop3Error('cancelled') : error
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
    const flight = { promise, mode }
    inFlight = flight
    try {
      return await promise
    } finally {
      if (inFlight === flight) inFlight = undefined
    }
  }

  return {
    store,
    sync,
    search: (query, limit = 20, at = now()) => {
      const built = buildMailQuery(query)
      const state = store.state()
      const results = store.search(built.parameter, Math.min(Math.max(limit, 1), 50), built.mode)
      return {
        cacheAsOf: state.lastSyncAt,
        stale: !isFresh({
          now: at,
          lastSyncAt: state.lastSyncAt,
          freshnessMs: options.options.freshnessMs
        }),
        total: results.length,
        results
      }
    },
    getMail: (mailId, offset, maxChars) => {
      const stored = store.getMail(mailId)
      if (!stored) return null
      const { bodyText, ...meta } = stored
      return { ...meta, ...sliceBody(bodyText, offset, maxChars) }
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
