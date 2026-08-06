// ═══════════════════════════════════════════════════════════════════════════
// 사내 API 호출 표면 (0178) — 앱이 인증을 **소비**하는 유일한 진입점.
//
// 호출자는 `bindingId` 도 `connectorId` 도 들고 다니지 않는다. 아는 것은 **대상 이름 하나**
// (`target`)뿐이고, 그 이름으로 인증 레코드를 찾아 헤더·쿠키를 붙이는 일은 구현이 한다.
//
//   request  인증된 요청을 보낸다. 미선언 origin·예약 헤더 덮어쓰기는 거부된다.
//   token    외부 프로세스(MCP)에 넘길 값. 브라우저 세션처럼 값이 없는 대상은 null.
//
// `token` 이 **동기**인 것은 의도다 — 소비자(`${BINDING:<대상>}` 치환)가 동기 계약이고, 그
// 위에 HTTP 왕복을 얹으면 렌더 시점에 할 수 없는 일을 계약이 약속하게 된다.
//
// 레이어: 이 파일은 **구조적 포트**다. 소비 feature(`features/connectors`·`features/extensions`)
// 는 `features/auth-platform` 을 직접 import 하지 않고 이 타입만 안다 — 컴포지션 루트
// (`app/bootstrap.ts`)가 구현을 주입한다.
// ═══════════════════════════════════════════════════════════════════════════

export interface InternalApiRequest {
  // 대상 이름. 인증 레코드·origin·credential 표현이 전부 여기서 파생된다.
  target: string
  method: string
  // 대상 origin 기준 상대 경로. 절대 URL 은 거부된다(origin 우회 방지). 컨텍스트 경로
  // (`/confluence`)가 있는 배포는 호출자가 여기에 prefix 를 붙인다.
  path: string
  headers?: Record<string, string>
  query?: Record<string, string>
  body?: string
  // 응답 본문 형태. **미지정 = `'text'`**. 첨부·이미지처럼 바이트가 필요한 요청만 `'binary'`.
  responseType?: 'text' | 'binary'
  // 수신 상한. 미지정이면 상한 없음. 선언된 `content-length` 와 실제 누적 바이트를 **둘 다**
  // 검사한다 — 서버가 길이를 속이거나 안 보낼 수 있다.
  maxBytes?: number
}

export interface InternalApiResponse {
  status: number
  headers: Record<string, string>
  // `responseType:'binary'` 응답에서는 빈 문자열이다.
  body: string
  // `responseType:'binary'` 일 때만 채워진다.
  bodyBytes?: Uint8Array
}

export interface InternalApi {
  request(req: InternalApiRequest, signal?: AbortSignal): Promise<InternalApiResponse>
  // 미인증·미지원·미설정이면 null. 값이 나가는 유일한 문서화된 예외 경로다.
  token(target: string): string | null
}
