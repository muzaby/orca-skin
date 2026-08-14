// trusted-main 전용 raw credential 조회 (0188 — 구 `ProviderApi.token`).
//
// ── 왜 별도 파일인가 ──────────────────────────────────────────────────────────
// 0181 은 `request`·`materialize`·`token` 을 한 인터페이스(`ProviderApi`)에 뒀다. 그래서 인증된
// 요청 하나만 필요한 소비자(Confluence·Usage)도 raw secret 을 꺼낼 수 있는 객체를 손에 쥐었다.
// 표면이 넓어진 것 자체가 위험이 아니라, **좁혀 받을 이유가 타입에 없던 것**이 위험이었다.
//
// 여기서는 반대로 만든다: 일반 소비는 `BoundAuth.request()` 뿐이고, raw 값이 실제로 필요한
// 두 자리만 이 포트를 지난다.
//
//   MCP `${BINDING:<id>}`               — resolver 가 동기라 read 도 동기 계약이다.
//   Harness direct-credential augmenter — 사용자가 입력한 API key 를 subprocess env 에 직접
//                                         놓아야 하는 배포. config API 방식에는 주지 않는다.
//
// **`createAuthRuntime` 의 결과에만 실린다.** `RouterContext`·renderer IPC·일반 feature
// dependency 로 흘리지 않고, Bootstrap 이 AuthId 를 닫은 closure 만 넘긴다.
//
// 미인증이면 **`null`** 이다 — 빈 문자열 치환 금지(조용한 미인증 진행 방지, 0181 결정 유지).

import type { AuthId, AuthSecretReader } from '../../contracts/auth'
import type { AuthStore } from './store'

export function createAuthSecretReader(store: AuthStore): AuthSecretReader {
  return {
    read(authId: AuthId): string | null {
      return store.secret(authId)
    }
  }
}
