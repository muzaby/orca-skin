import type { TlsOptions } from 'node:tls'
import type { Pop3Socket, Pop3SocketOptions } from '../../../infra/net/pop3-socket'

export type { Pop3Socket, Pop3SocketOptions }

export interface MailTimeouts {
  readonly connectMs?: number
  readonly commandMs?: number
  readonly syncMs?: number
}

// ── 연결 좌표 ─────────────────────────────────────────────────────────────────
//
// **사본은 하나다.** 배포는 `MailEndpointInput` 으로 한 번 적고, 그 값은 곧바로
// `AuthDefinition.origin` 이 된다. 런타임은 좌표를 옵션에서 다시 받지 않고 `origin` 에서
// `parseMailOrigin` 으로 되읽는다 — 두 사본이 없으니 어긋남을 대조할 일도 없다.
export interface MailEndpointInput {
  readonly host: string
  readonly port?: number
  readonly tls?: boolean
}

// 기본값이 적용된 좌표. 이 형태를 만드는 곳은 `resolveMailEndpoint` 하나다.
export interface MailEndpoint {
  readonly host: string
  readonly port: number
  readonly tls: boolean
}

// 선언(`createMailAuth`)이 받는 입력 — 좌표 + 전송 설정.
export interface MailAuthOptions extends MailEndpointInput {
  readonly tlsOptions?: TlsOptions
  readonly timeouts?: MailTimeouts
}

// 한 세션을 열기 위한 완결 설정.
export interface MailSessionConfig extends MailEndpoint {
  readonly tlsOptions?: TlsOptions
  readonly timeouts?: MailTimeouts
}

// 도구 런타임 옵션. **연결 좌표를 담지 않는다** — 담으면 두 번째 사본이 된다.
export interface MailPluginOptions {
  readonly accountId: string
  readonly tlsOptions?: TlsOptions
  readonly retentionDays?: number
  readonly freshnessMs?: number
  readonly timeouts?: MailTimeouts
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
