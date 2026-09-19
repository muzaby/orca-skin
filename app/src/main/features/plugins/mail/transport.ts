// 비-HTTP Plugin 이 배포에게서 받는 전송 한 벌 + **프로토콜 경계** (0237 ΔV2·ΔV3).
//
// **왜 별도 인자인가**: Plugin 의 기본 전송은 `PluginAuth.request` 하나다(Chromium `net.fetch`).
// POP3 는 그 스택 밖이라 `security.md §1.8` 에 예외로 등재됐고, 그러면 자격증명도 헤더로 붙일
// 수 없어 **값 자체**가 필요하다.
//
// **`AuthSecretReader` 를 통째로 받지 않는다**(D-022). `credential` 은 컴포지션 루트가 **AuthId 를
// 닫아 만든 closure** 이고, 값은 **선언이 편 형태**(`CredentialMaterial`)로 온다(D-054) — mail
// 슬라이스는 `user:pass` 의 `:` 규칙을 알지 못하고 알 필요도 없다.

import type { CredentialMaterial } from '../../../contracts/auth'
import type { Pop3SocketFactory } from './types'

export interface MailTransport {
  // 이 Plugin 의 AuthId 를 닫은 closure. 미인증이면 `null`.
  readonly credential: () => CredentialMaterial | null
  // 캐시 DB·첨부 staging 이 살 디렉터리.
  readonly root: string
  // 소켓 생성의 단일 출처 — `infra/net/pop3-socket.ts` 의 `createPop3Socket` 만 여기 들어온다.
  readonly socketFactory: Pop3SocketFactory
  // 서버가 자격증명을 **거부**했을 때 Auth 를 강등시키는 되먹임 (D-035). 도달 실패는 부르지
  // 않는다 — 네트워크가 한 번 끊긴 것이 도구 3종을 회수하면 캐시 검색까지 끊긴다(D-045).
  readonly reportCredentialRejected?: (authId: string) => void
}

// ── 프로토콜 경계 (0237 D-056) ────────────────────────────────────────────────
//
// `sync-manager` 는 이 포트만 안다. POP3 도 IMAP 도 여기 뒤에 있고, **이번 구현체는 POP3 1종**이다.
//
// 이름이 프로토콜 중립인 이유: POP3 는 `UIDL`/`TOP`/`RETR`, IMAP 은 `UID FETCH` 로 같은 일을
// 한다. 어휘를 한쪽에 맞추면 다른 쪽이 들어올 때 `sync-manager` 를 고쳐야 한다.

export interface MailMessageRef {
  // 계정 안에서 **안정적인** 원격 식별자. POP3 UIDL | IMAP `UIDVALIDITY:UID`.
  readonly uid: string
  // **세션 안에서만 유효한** 순번. POP3 message number | IMAP sequence number.
  // 다음 세션에 같은 값이라는 보장이 없으므로 영속 키로 쓰지 않는다.
  readonly ordinal: number
}

export interface MailReadSession {
  // 서버가 광고한 능력(POP3 `CAPA` | IMAP `CAPABILITY`). 메커니즘 선택이 이것을 본다.
  capabilities(): Promise<readonly string[]>
  // 자격증명을 실어 로그인한다. **메커니즘 선택은 구현이 한다** — 호출자는 고르지 않는다.
  login(): Promise<void>
  list(): Promise<readonly MailMessageRef[]>
  header(ref: MailMessageRef): Promise<string>
  body(ref: MailMessageRef): Promise<Uint8Array>
  // `'graceful'` 은 프로토콜 종료 명령을, `'abort'` 는 소켓 즉시 파괴를 뜻한다.
  close(kind: 'graceful' | 'abort'): Promise<void>
}

export interface MailConnectionOptions {
  readonly host: string
  readonly port: number
  readonly tls: boolean
  readonly tlsOptions?: import('node:tls').TlsOptions
  readonly timeoutMs?: number
}

export type MailReadSessionFactory = (input: {
  readonly connection: MailConnectionOptions
  readonly credential: CredentialMaterial
  readonly socketFactory: Pop3SocketFactory
  readonly signal?: AbortSignal
}) => MailReadSession
