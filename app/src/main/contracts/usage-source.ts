// ═══════════════════════════════════════════════════════════════════════════
// 범용 usage source 계약 (0176) — "인증된 호출의 결과" 를 usage provider 에게 나르는 형상.
//
// **connector 를 usage provider 에 매달지 않는다.** provider 가 보는 것은 `UsageSample`
// (누구의 결과인지 + 무엇이 왔는지)뿐이고, connection·binding·credential 은 경계 너머에
// 남는다. LLM provider 마다 응답 포맷이 다르므로 **해석은 구독자(usage provider)의 map 이**
// 하고 프레임워크는 형식을 모른다 — 그것이 이 계약이 `payload: unknown` 인 이유다.
//
// ── 레이어 주의 ──────────────────────────────────────────────────────────────
//   `features/usage` 는 `features/auth-platform` 을 **직접 import 할 수 없다**
//   (feature 수직 슬라이스 교차 금지). 그래서 `UsageSourcePort` 를 여기 **구조적 포트**로
//   선언하고, 컴포지션 루트(`app/usage-source.ts` → `app/bootstrap.ts`)가 PluginHost 기반
//   구현을 주입한다 — `src/main/AGENTS.md` §해소책 1+3.
// ═══════════════════════════════════════════════════════════════════════════

export interface UsageSampleRequest {
  // connector 가 선언한 operation 이름. 미선언 operation 은 connector 가 거부한다.
  operation: string
  params?: Record<string, unknown>
}

export interface UsageSample {
  // **`sourceId` = connectorId 다** (0176 결정). 별칭 체계를 두지 않는다 — 모듈이 선언하는
  // 값과 배포가 `USAGE_CONNECTORS[].id` 에 적는 값이 같아야 배선이 한 겹으로 끝난다.
  sourceId: string
  operation: string
  fetchedAt: number
  status?: number
  contentType?: string
  // 원문 그대로. JSON 이면 파싱된 값, 아니면 문자열 — 판정은 구독자 몫이다.
  payload: unknown
}

export type UsageSampleFailureReason =
  // 그런 connector 자체가 없다(설정 오타·패키지 미등록).
  | 'unknown_source'
  // connector 는 있으나 연결되지 않았다. **정상 상태다** — 부팅 직후·사내망 밖·로그아웃 후.
  | 'not_connected'
  // 호출이 실패했다(원격 오류·타임아웃·취소).
  | 'invoke_failed'
  // 호출은 됐으나 결과 형상이 계약과 어긋난다.
  | 'bad_shape'

export type UsageSampleOutcome =
  | { ok: true; sample: UsageSample }
  | {
      ok: false
      sourceId: string
      operation: string
      reason: UsageSampleFailureReason
      message?: string
    }

export interface UsageSourceInfo {
  sourceId: string
  label: string
  connected: boolean
}

export interface UsageSourcePort {
  list(): readonly UsageSourceInfo[]
  invoke(
    sourceId: string,
    request: UsageSampleRequest,
    signal?: AbortSignal
  ): Promise<UsageSampleOutcome>
}
