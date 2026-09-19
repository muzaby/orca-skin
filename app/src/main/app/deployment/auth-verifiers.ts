// 배포가 채우는 **후보 자격증명 verifier** 배선 (0237 ΔV2 — D-052).
//
// ── 무엇을 푸는가 ────────────────────────────────────────────────────────────
// `AuthDefinition.probe` 는 HTTP 왕복이다. POP3 처럼 칠 HTTP endpoint 가 아예 없는 Auth 는
// probe 를 선언할 수 없고(D-032), 그러면 **값만 입력해도 "연결됨"** 이 된다. verifier 는 그
// 자리에 자기 프로토콜의 실제 왕복을 끼운다 — 연결 버튼을 누른 순간 증명한다(D-040).
//
// ── 왜 map 인가 ──────────────────────────────────────────────────────────────
// 구 형상은 `LoginDeps.verify` **함수 하나**였고 `login.ts` 가 authId 를 보지 않고 분기했다.
// 그래서 verifier 를 하나라도 주입하면 후보가 있는 *모든* Auth 가 그것을 타고 HTTP probe 에
// 도달하지 못했다 — mail 과 Confluence 를 함께 켠 배포에서 **Confluence PAT 로그인이 POP3
// verifier 를 탔다.** 함수 시그니처에 "내 대상이 아니다" 를 말할 자리도 없어 배포 closure 로도
// 우회할 수 없었다. AuthId 를 열쇠로 쓰면 그 오적용이 **구조적으로 불가능**해진다.
//
// ── 형상 ─────────────────────────────────────────────────────────────────────
// `harness-runtime.ts` 의 augmenter factory 2종과 같다 — Bootstrap 이 능력을 넘기고, 배포가
// 채우고, 기본 배포는 비어 있다. 여기 없는 authId 는 기존 probe/무검증 경로를 그대로 탄다.

import type { AuthId } from '../../contracts/auth'
import type { AuthCandidateVerifier } from '../../features/auth/login'
import { unfoldCredential } from '../../features/auth/specs/credential'
import { normalizeMailError } from '../../features/plugins/mail/errors'
import { createPop3ReadSession } from '../../features/plugins/mail/pop3/session'
import type {
  MailConnectionOptions,
  MailReadSessionFactory
} from '../../features/plugins/mail/transport'
import type { Pop3SocketFactory } from '../../features/plugins/mail/types'

export interface AuthVerifierDeploymentDeps {
  /** 캐시 DB·staging 과 같은 루트. 비-HTTP verifier 가 임시 자원을 쓸 때의 기준점이다. */
  userDataRoot: string
}

// 배포가 채우는 자리. 기본 배포는 verifier 가 없다 — 모든 Auth 가 `probe` 경로를 탄다.
//
// 조립 예제는 `docs/guides/closed-network-extensions.md` §4 (Mail 레시피):
//
// ```ts
// return {
//   [MAIL_AUTH.id]: async (_authId, candidate, signal) =>
//     verifyPop3Credential(MAIL_PLUGIN_OPTIONS, createPop3Socket, candidate, signal)
// }
// ```
export function createAuthVerifiers(
  deps: AuthVerifierDeploymentDeps
): Readonly<Record<AuthId, AuthCandidateVerifier>> {
  void deps
  return {}
}

// POP3 후보 검증 — **read 경로와 같은 authenticator 를 탄다** (0237 D-040 · §10 EP-17).
//
// 검증 전용 로그인 코드를 따로 쓰면 그 순간 두 경로가 갈린다. 여기서는 `createPop3ReadSession`
// 이 만든 세션의 `login()` 을 그대로 부르고 바로 끊는다 — `login.ts` 주석이 말한 "검증 경로와
// 사용 경로가 글자까지 같아진다" 를 코드로 지킨다.
export function createPop3CandidateVerifier(deps: {
  readonly connection: MailConnectionOptions
  readonly socketFactory: Pop3SocketFactory
  readonly sessionFactory?: MailReadSessionFactory
}): AuthCandidateVerifier {
  const sessionFactory = deps.sessionFactory ?? createPop3ReadSession
  return async (_authId, candidate, signal) => {
    const material = candidate.secret
      ? unfoldCredential(candidate.grant.authKind, candidate.secret, candidate.grant.principalId)
      : null
    if (!material) return { ok: false, rejected: false }
    const session = sessionFactory({
      connection: deps.connection,
      credential: material,
      socketFactory: deps.socketFactory,
      ...(signal ? { signal } : {})
    })
    try {
      await session.login()
      return { ok: true, rejected: false }
    } catch (error) {
      // **거부와 도달 실패를 가른다** (D-041) — 전자는 값을 고쳐야 하고 후자는 환경을 고쳐야 한다.
      return { ok: false, rejected: normalizeMailError(error).authFailure }
    } finally {
      await session.close('abort').catch(() => undefined)
    }
  }
}
