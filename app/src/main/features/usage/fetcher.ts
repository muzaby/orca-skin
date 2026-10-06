// Optional 원격 사용량 포트 (0186) — **타입만 있는 파일이다.**
//
// ── 왜 여기에, 왜 이 모양인가 ─────────────────────────────────────────────────
// `features/usage` 는 `features/auth` 를 직접 import 할 수 없다(수직 슬라이스 교차 금지).
// 그래서 소비 측인 여기가 **필요한 메서드만 담은 구조적 포트**를 선언하고, 컴포지션 루트가
// `ProviderApi.request` 로 만든 concrete 를 주입한다(`src/main/AGENTS.md` §해소책 1+3,
// 절차는 `docs/guides/closed-network-extensions.md` §5-b).
//
// **선언 슬롯을 만들지 않는다 (0183 r2 유지).** `Provider.usage` 같은 필드를 계약에 되살리지
// 않는다 — 배포는 이 포트를 구현한 *평범한 코드* 를 컴포지션 루트에 꽂는다.
//
// **JSON → UsageSnapshot 매핑도 코어에 두지 않는다.** endpoint 응답 형태는 배포마다 다르고
// 아직 미상(OQ1)이라, 코어가 쓰지도 않을 mapper 를 미리 만들면 0183 이 지운 "슬롯" 과 같은
// 냄새가 난다. 매핑은 이 포트를 구현하는 쪽이 소유한다.

// 미제공 수치는 NULL로 저장한다. 원격 기간 칸을 표시할 때만 NULL을 0으로 읽으며 SDK로 채우지 않는다.
export interface RemoteUsageMetrics {
  inputTokens?: number | null
  outputTokens?: number | null
  cacheCreationInputTokens?: number | null
  cacheReadInputTokens?: number | null
  costUsd?: number | null
}

export interface RemoteModelUsage extends RemoteUsageMetrics {
  model: string
}

export interface RemoteDailyUsage {
  day: string // YYYY-MM-DD, Orca OS 로컬 날짜 달력. 변환은 배포 매퍼 책임.
  total?: RemoteUsageMetrics | null
  models?: readonly RemoteModelUsage[] | null
}

export interface RemoteMonthlyUsage {
  month: string // YYYY-MM
  total?: RemoteUsageMetrics | null
  models?: readonly RemoteModelUsage[] | null
}

// 스칼라는 0014 캐시, 내역은 기간별 이력으로 저장한다. 빈 내역은 미제공이며 기존 행을 지우지 않는다.
export interface UsageSnapshot {
  // 사용량 축의 식별자(`${adapter}-${provider}`). `Provider.id` 가 아니다 — 좌표 조인은
  // 컴포지션 루트가 `findLlmProvider`/`llmProviderKey` 로 한 번만 한다.
  providerKey: string
  // 월 누적값의 월 판정 시각(epoch ms). 없으면 fetchedAt으로 이번 달인지 판정한다.
  asOf: number | null
  // 우리가 응답을 받은 시각(epoch ms).
  fetchedAt: number
  // 원격이 보고한 월 한도. null = 원격이 한도를 주지 않았다 → 사용자 설정 한도로 폴백.
  limitUsd: number | null
  // 원격 월 누적 사용액. 이번 달이면 SDK 증분 없이 이 값만 쓴다.
  usedUsd: number | null
  remainingUsd: number | null
  /** @deprecated 월 계산에 쓰지 않는 호환 필드. 봉투 저장만 유지한다. */
  baselineUsable?: boolean
  daily?: readonly RemoteDailyUsage[] | null
  monthly?: readonly RemoteMonthlyUsage[] | null
  // 배포 응답 원본. 표시 수치는 검증 후 커밋된 DB 행으로 만든다.
  raw: unknown
}

// 컴포지션 루트가 주입하는 포트. **`undefined` 는 오류가 아니라 정상 구성이다** — 원격 사용량
// endpoint 가 없는 배포에서는 주입하지 않고, 그러면 관련 cron 잡도 등록되지 않는다.
export interface UsageFetcher {
  // cache row 의 존재만으로 원격 권위를 부여하지 않는다. 현재 배포에서 이 provider 를 실제로
  // 지원할 때만 cached snapshot 과 원격 갱신을 사용할 수 있다.
  supports(providerKey: string): boolean
  // `null` 은 지원 provider 가 이번 호출에서 snapshot 을 얻지 못했다는 뜻이다. Tracker 가 이를
  // 실패로 올리고, background 호출자는 다음 틱까지 삼키며 manual 호출자는 command reject 한다.
  fetchUsage(providerKey: string, signal?: AbortSignal): Promise<UsageSnapshot | null>
}
