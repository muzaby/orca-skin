// ═══════════════════════════════════════════════════════════════════════════
// 내부 API (0178) — **앱 안의 다른 모듈이 인증을 쓰는 표면.**
//
// "내부" 는 *사내(회사)* 가 아니라 **이 앱 내부**를 뜻한다. 부르는 쪽이 사내 서버라는 사실은
// 부수적이고, 이 계약이 있는 이유는 **`features/usage`·`features/extensions` 같은 다른 슬라이스가
// 인증 구현을 몰라도 인증된 호출을 할 수 있게** 하는 것이다. 그래서 형상이 **한 벌**이다 —
// 소비자마다 자기 포트를 손으로 다시 선언하면 그 순간 인프라가 아니라 그냥 남의 클래스가 된다.
//
//   request  인증된 요청을 보낸다. 미선언 origin·예약 헤더 덮어쓰기는 거부된다.
//   token    외부 프로세스(MCP)에 넘길 값. 브라우저 세션처럼 값이 없는 대상은 null.
//
// 호출자는 `bindingId` 도 `connectorId` 도 들고 다니지 않는다. 아는 것은 **대상 이름 하나**
// (`target`)뿐이다 — 다른 모듈은 인증 레코드 id 를 알 방법이 애초에 없다(매 인증마다 새로
// 뽑히는 내부 값이다). 모듈간 API 의 인자는 **선언에 적힌 안정된 이름**이어야 한다.
//
// `token` 이 **동기**인 것은 의도다 — 소비자(`${BINDING:<대상>}` 치환)가 동기 계약이고, 그
// 위에 HTTP 왕복을 얹으면 렌더 시점에 할 수 없는 일을 계약이 약속하게 된다.
//
// ── 왜 `infra/` 가 아닌가 (0178 검토) ────────────────────────────────────────
//   "인프라 기능처럼 쓰인다" 와 "`infra/` 에 산다" 는 다르다. 인프라로 **떼어낼 수 있는 조각은
//   이미 `infra/auth/` 에 있다** — vault·browser session·전송자·정책·네트워크 스택 9모듈.
//   남은 것은 "어느 대상이 어느 방식으로 인증됐는가" 라는 **도메인 상태**(레코드 스토어·등록·
//   대상 descriptor)이고, `infra → infra·shared` 규칙상 infra 는 그것을 알 수 없다. 억지로
//   옮기면 infra 가 도메인 상태를 소유하게 되어 레이어가 무너진다.
//
//   그래서 인프라처럼 **쓰이는 것**은 위치가 아니라 배선으로 만든다 — **포트는 여기(contracts),
//   구현은 `features/auth-platform`, 주입은 컴포지션 루트(`app/bootstrap.ts`)**. 소비 슬라이스는
//   필요한 메서드만 `Pick<InternalApi, …>` 으로 받는다.
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
