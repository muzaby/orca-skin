import type { TlsOptions } from 'node:tls'
import type { Pop3Socket, Pop3SocketOptions } from '../../../infra/net/pop3-socket'

export type { Pop3Socket, Pop3SocketOptions }

// 배포가 채우는 Plugin 옵션 (0237 ΔV2 — D-054·D-057).
//
// **연결 좌표(`host`·`port`·`tls`)가 없다.** 그 값은 `AuthDefinition.origin` 에서 나오고
// `PluginAuth.origin` 으로 도착한다 — 두 사본을 만들면 갈린다. **`root` 도 없다** — 데이터
// 루트는 배포가 고를 값이 아니라 infra 가 해석한다(`pluginDataDir`).
export interface MailPluginOptions {
  readonly accountId: string
  /** 사설 CA 등. `rejectUnauthorized:false` 는 조립에서 거부한다. */
  readonly tlsOptions?: TlsOptions
  readonly retentionDays?: number
  readonly freshnessMs?: number
  readonly timeouts?: {
    readonly connectMs?: number
    readonly commandMs?: number
    readonly syncMs?: number
  }
}

export interface MailAttachment {
  readonly id?: number
  readonly attachmentId?: string
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: number
  readonly storedName?: string
  readonly bytes?: Uint8Array
}

export interface MailDocument {
  readonly uidl: string
  readonly messageNumber: number
  readonly headerDate: number | null
  readonly firstSeenAt: number
  readonly effectiveDate: number
  readonly fromAddr: string
  readonly toAddrs: string
  readonly ccAddrs: string
  readonly subject: string
  readonly bodyText: string
  readonly sizeBytes?: number
  readonly attachments: readonly MailAttachment[]
}

export interface MailAttachmentManifest {
  readonly attachmentId: string
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: number
}

export interface MailSearchHit {
  readonly mailId: string
  readonly date: number
  readonly from: string
  readonly to: string
  readonly subject: string
  readonly snippet: string
  readonly rank: number
  readonly attachmentCount: number
  readonly attachments: readonly MailAttachmentManifest[]
  readonly attachmentsTruncated?: boolean
}

export interface MailSearchResult {
  readonly cacheAsOf: number | null
  readonly stale: boolean
  readonly total: number
  readonly results: readonly MailSearchHit[]
}

export type MailSyncResult =
  | { readonly synced: false; readonly fresh: true; readonly lastSyncAt: number | null }
  | {
      readonly synced: true
      readonly fresh?: false
      readonly newMails: number
      readonly expired: number
      readonly lastSyncAt: number
      readonly partial?: boolean
      readonly protection?: 'bulk_loss_suspected'
      readonly removed?: 0
    }
  | {
      readonly synced: false
      readonly fresh?: false
      readonly error: string
      readonly stale: true
      readonly lastSyncAt: number | null
      readonly protection?: 'bulk_loss_suspected'
      readonly newMails?: 0
      readonly removed?: 0
    }

export type Pop3SocketFactory = (options: Pop3SocketOptions) => Pop3Socket

export interface MailSyncStageEvent {
  readonly stage: 'freshness' | 'cleanup' | 'connect' | 'uidl' | 'top' | 'retr' | 'persist'
}
