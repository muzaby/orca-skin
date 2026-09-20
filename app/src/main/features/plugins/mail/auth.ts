// POP3 인증 확인 구현 (0237 ΔV2 — D-052).
//
// **이 파일이 "새 프로토콜은 core 를 안 바꾼다" 의 증거다.** 코어가 아는 것은
// `AuthMethod.verify` 라는 optional 한 필드 하나뿐이고, POP3 가 무엇인지는 여기만 안다.
// IMAP·XOAUTH2 를 더할 때도 같은 자리에 같은 모양으로 들어온다 — `login.ts` 는 안 바뀐다.
//
// ── 왜 `AuthMethod` 가 아니라 `AuthVerifier` 를 내보내나 ──────────────────────
// `passwordSpec`(필드·compose)은 `features/auth` 에 있고 여기는 `features/plugins` 라
// **교차 슬라이스 import 가 금지**돼 있다(`app/src/main/AGENTS.md`, eslint boundaries 가 error).
// 경계를 뚫는 대신 역할을 가른다 — 이 슬라이스는 *확인하는 방법*(프로토콜)만 소유하고,
// 방식 선언의 조립은 컴포지션 루트(`app/deployment/auth-definitions.ts`)가 한다:
//
//   passwordSpec({ label: '메일 ID/비밀번호', verify: pop3Verifier({ endpoint: MAIL_ORIGIN }) })
//
// ── 검증 경로와 사용 경로가 같다 ─────────────────────────────────────────────
// `verify` 는 `pop3/session.ts` 의 `login()` 을 그대로 탄다. 검증 전용 경로를 따로 만들면
// "연결은 되는데 sync 는 안 되는" 상태가 생긴다(`login.ts` probe 절 주석과 같은 규칙).

import type { AuthVerifier } from '../../../contracts/auth'
import { parseMailEndpoint } from './endpoint'
import { createPop3Session } from './pop3/session'
import { normalizePop3Error } from './pop3/errors'
import type { Pop3SocketFactory } from './types'
import type { TlsOptions } from 'node:tls'

export interface Pop3VerifierOptions {
  /** `AuthDefinition.origin` 과 **같은 값**. 두 사본을 만들지 않으려고 여기서도 그것을 쓴다. */
  endpoint: string
  /** 사설 CA 등. `rejectUnauthorized:false` 는 조립에서 거부한다(§15 semantics). */
  tlsOptions?: TlsOptions
  connectTimeoutMs?: number
  /** 테스트 seam. 프로덕션은 기본값(`infra/net/pop3-socket.ts`)을 쓴다. */
  socketFactory?: Pop3SocketFactory
}

// `passwordSpec` 의 `compose` 가 접은 한 문자열이 `user:pass` 임을 전제한다 — 그 형식을 보장하는
// 것이 그 함수의 존재 이유다(`features/auth/specs/credential.ts`). 아이디의 `:` 는 거기서 거부된다.
export function splitMailCredential(secret: string): { user: string; password: string } {
  const at = secret.indexOf(':')
  if (at < 0) return { user: secret, password: '' }
  return { user: secret.slice(0, at), password: secret.slice(at + 1) }
}

export function pop3Verifier(options: Pop3VerifierOptions): AuthVerifier {
  // endpoint 해석은 **선언 시점**에 한 번 한다 — 형식이 틀렸으면 부팅에서 드러나야 하고,
  // 로그인 버튼을 누른 뒤 알게 되면 안 된다.
  const endpoint = parseMailEndpoint(options.endpoint)
  return async (input, signal) => {
    // 후보는 아직 vault 에 없다 — 값이 없으면 확인할 대상 자체가 없다.
    if (!input.secret) return { ok: false, rejected: true }
    const { user, password } = splitMailCredential(input.secret)
    const session = createPop3Session(
      {
        host: endpoint.host,
        port: endpoint.port,
        tls: endpoint.tls,
        ...(options.tlsOptions ? { tlsOptions: options.tlsOptions } : {}),
        ...(options.connectTimeoutMs ? { timeoutMs: options.connectTimeoutMs } : {}),
        user,
        password,
        ...(signal ? { signal } : {})
      },
      options.socketFactory
    )
    try {
      await session.login()
      // 확인이 끝나면 즉시 끊는다 — 확인용 연결을 들고 있지 않는다.
      await session.quit().catch(() => session.destroy())
      return { ok: true, principalId: user }
    } catch (error) {
      session.destroy()
      const normalized = normalizePop3Error(error)
      // **거부와 도달 실패를 가른다** (D-041). 서버가 `PASS` 에 `-ERR` 로 답한 것만 거부이고,
      // 연결·TLS·타임아웃은 "값이 틀렸다" 가 아니다 — 두 경우가 같은 문구면 사용자가 맞는
      // 비밀번호를 계속 다시 넣는다.
      return { ok: false, rejected: normalized.authFailure }
    }
  }
}
