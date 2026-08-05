// 범용 usage connector 설정 계약 (0176).
//
// **코드가 아니라 선언으로 서버를 늘린다.** 사내 사용량 API 는 배포마다 경로·쿼리·헤더가 다를
// 뿐 형태는 같다 — "인증된 GET/POST 한 번, 응답을 그대로 돌려주기". 그래서 connector 구현은
// 하나만 두고 배포는 이 설정을 `servers.ts` 에 적는다.
//
// 응답 **해석은 여기서 하지 않는다** — usage provider 의 `map` 이 한다(0176 요구:
// "llm provider 반환 포맷이 다를 수 있다").

import type { AuthMechanism, CredentialPresentation } from '../../../../../shared/ipc'

export interface UsageOperationSpec {
  method: 'GET' | 'POST'
  // baseUrl(+apiBasePath) 기준 상대 경로. `{name}` 자리표시자를 쓸 수 있다.
  path: string
  // 값에도 `{name}` 치환이 적용된다.
  query?: Record<string, string>
  headers?: Record<string, string>
  // 문자열 그대로 전송한다(치환 적용). JSON 이면 호출자가 직렬화해 적는다.
  body?: string
}

export interface UsageConnectorConfig {
  // connector ID = usage provider 가 구독하는 `sourceId` 다. 한 번 정하면 유지한다 —
  // 모듈 선언과 binding 이 이 문자열에 묶인다.
  id: string
  label: string
  // 경로 없는 origin. manifest `OriginSchema` 가 형태를 강제한다.
  baseUrl: string
  // 컨텍스트 경로(`/api`). 모든 operation 경로 앞에 붙는다.
  apiBasePath?: string
  // 이 서버에 붙일 수 있는 auth provider. 미지정이면 이 패키지의 PAT·Basic 2종.
  // 다른 패키지의 provider(사내 ADFS 등)를 적어도 된다 — manifest 가 교차 참조를 허용한다.
  acceptedAuthProviders?: readonly string[]
  // credential 을 요청 어디에 넣을지. 미지정이면 `Authorization: Bearer <secret>`.
  presentation?: CredentialPresentation
  presentations?: Partial<Record<AuthMechanism, CredentialPresentation>>
  // 연결 시 유효성을 확인할 operation. **미지정이면 요청 없이 ready** — probe 를 강요하면
  // 확인용 endpoint 가 없는 배포가 연결 자체를 못 한다.
  probe?: { operation: string; params?: Record<string, unknown> }
  // 호출 가능한 operation 전부. **여기 없는 operation 은 거부된다**(허용 목록).
  operations: Record<string, UsageOperationSpec>
}

export const DEFAULT_USAGE_PRESENTATION: CredentialPresentation = {
  location: 'header',
  name: 'Authorization',
  scheme: 'Bearer'
}
