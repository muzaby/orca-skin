// POP3 인증 메커니즘 (0237 ΔV3 — D-055).
//
// **`Presentation` 에 `'sasl'` 을 더하지 않는 이유**: 그 타입은 HTTP 전용이고(`location:
// 'header'|'query'|'cookie'`), 거기에 프로토콜 축을 더하면 `contracts/auth.ts` 헤더가 0181 에서
// 지웠다고 적은 `AuthMechanism × AuthTargetKind × CredentialPresentation` 곱이 되살아난다.
// "싣는 법" 의 소유권을 전송 계층으로 내리는 것이 그 곱을 피하는 방법이다.
//
// **구현체는 `USERPASS` 1종이다** (D-039 유지 — 사용자가 "id passwd만 지원하고 나머지 인증
// 방식에 대해서는 한계점으로 남겨두고 홀드하라" 를 확정했다). `XOAUTH2` 는 여기 자리만 있고
// 구현이 없다 — 붙일 때 이 배열에 한 줄 더하고 `accepts:'token'` 을 쓴다.

import type { CredentialMaterial } from '../../../../contracts/auth'
import { MailError } from '../errors'

// authenticator 가 쓰는 최소 명령 표면. 세션 전체를 넘기면 authenticator 가 `RETR` 도 부를 수
// 있게 되므로 인증에 필요한 것만 준다.
export interface Pop3CommandPort {
  send(name: string, args?: string): Promise<string[]>
}

export interface MailAuthenticator {
  readonly mechanism: string
  // 이 메커니즘이 받는 자격증명 갈래.
  readonly accepts: CredentialMaterial['kind']
  // 서버가 광고한 능력으로 이 메커니즘을 쓸 수 있는가. `USER`/`PASS` 는 POP3 기본 명령이라
  // 광고를 요구하지 않는다(RFC 1939 필수 명령).
  supportedBy(capabilities: readonly string[]): boolean
  authenticate(cmd: Pop3CommandPort, credential: CredentialMaterial): Promise<void>
}

// ID/비밀번호 — RFC 1939 `USER`/`PASS`.
export const userPassAuthenticator: MailAuthenticator = {
  mechanism: 'USERPASS',
  accepts: 'password',
  supportedBy: () => true,
  async authenticate(cmd, credential) {
    if (credential.kind !== 'password') throw new MailError('auth_failed')
    // **두 값이 각각 다른 명령으로 나간다.** 합성 문자열을 통째로 `PASS` 로 보내던 것이 0237 G4 다.
    await cmd.send('USER', credential.username)
    await cmd.send('PASS', credential.password)
  }
}

// 등록된 메커니즘 전부. **순서 = 선호도** 이고 지금은 1종이다.
export const POP3_AUTHENTICATORS: readonly MailAuthenticator[] = [userPassAuthenticator]

// 서버 능력 ∩ 자격증명 갈래로 하나를 고른다.
//
// **폴백하지 않는다.** 광고되지 않은 메커니즘을 쓰려 하거나 갈래가 맞지 않으면 실패시킨다 —
// token material 을 `PASS` 로 흘려보내면 **액세스 토큰이 평문 비밀번호로 전송된다.**
export function selectAuthenticator(
  credential: CredentialMaterial,
  capabilities: readonly string[],
  authenticators: readonly MailAuthenticator[] = POP3_AUTHENTICATORS
): MailAuthenticator {
  const selected = authenticators.find(
    (item) => item.accepts === credential.kind && item.supportedBy(capabilities)
  )
  if (!selected) throw new MailError('auth_failed', `no_mechanism_for_${credential.kind}`, true)
  return selected
}
