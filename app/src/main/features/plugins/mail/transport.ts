// 비-HTTP Plugin 이 배포에게서 받는 전송 한 벌 (0237 ΔV2 — D-050).
//
// **왜 별도 인자인가**: Plugin 의 기본 전송은 `PluginAuth.request` 하나다(Chromium `net.fetch`).
// POP3 는 그 스택 밖이라 `security.md §1.8` 에 예외로 등재됐고, 그러면 자격증명도 헤더로 붙일
// 수 없어 **값 자체**가 필요하다. 그 둘이 이 타입의 존재 이유이자 경계다 — 여기 없는 것은
// Plugin 이 받지 않는다.
//
// **`AuthSecretReader` 를 통째로 받지 않는다**(D-022). `password` 는 컴포지션 루트가 **AuthId 를
// 닫아 만든 closure** 다. Plugin 은 자기 것 말고는 읽을 수 없고 vault 도 renderer 도 모른다.
import type { Pop3SocketFactory } from './types'

export interface MailTransport {
  // 이 Plugin 의 AuthId 를 닫은 closure. 값이 없으면 `null`(미인증 또는 해제됨).
  readonly password: () => string | null
  // 캐시 DB·첨부 staging 이 살 디렉터리.
  readonly root: string
  // 소켓 생성의 단일 출처 — `infra/net/pop3-socket.ts` 의 `createPop3Socket` 만 여기 들어온다.
  readonly socketFactory: Pop3SocketFactory
  // 서버가 자격증명을 **거부**했을 때 Auth 를 강등시키는 되먹임 (D-035). 도달 실패는 부르지
  // 않는다 — 네트워크가 한 번 끊긴 것이 도구 3종을 회수하면 캐시 검색까지 끊긴다(D-045).
  readonly reportCredentialRejected?: (authId: string) => void
}
