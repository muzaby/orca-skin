// Optional 원격 사용량 포트 (0186) — **타입만 있는 파일이다.**
//
// ── 왜 여기에, 왜 이 모양인가 ─────────────────────────────────────────────────
// `features/usage` 는 `features/providers` 를 직접 import 할 수 없다(수직 슬라이스 교차 금지).
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

// 원격이 보고한 provider 사용량 한 장. `provider_usage_report_cache`(마이그레이션 0014) 한 행에
// 대응한다 — 스칼라 3종은 컬럼으로, 나머지는 `raw` 가 통째로 보존한다.
export interface UsageSnapshot {
  // 사용량 축의 식별자(`${adapter}-${provider}`). `Provider.id` 가 아니다 — 좌표 조인은
  // 컴포지션 루트가 `findLlmProvider`/`llmProviderKey` 로 한 번만 한다.
  providerKey: string
  // 원격이 이 수치를 집계한 기준 시각(epoch ms). **`fetchedAt` 과 다르다.**
  asOf: number | null
  // 우리가 응답을 받은 시각(epoch ms).
  fetchedAt: number
  // 원격이 보고한 월 한도. null = 원격이 한도를 주지 않았다 → 사용자 설정 한도로 폴백.
  limitUsd: number | null
  // `asOf` 시점까지 원격이 집계한 누적 사용액. 기준선으로 쓰인다.
  usedUsd: number | null
  remainingUsd: number | null
  // ── 기준선 사용 게이트 ──────────────────────────────────────────────────────
  // `asOf` 가 **billing aggregation watermark** 임을 배포 fetcher 가 보장할 때만 true.
  //
  // watermark 가 아니면(예: 단순 응답 생성 시각) 원격이 이미 센 턴의 로컬 행이
  // `created_at > asOf` 가 되어 **같은 턴이 두 번 더해진다**. 판별할 방법이 코어에는 없으므로
  // 배포가 선언한다.
  //
  // **미지정 = false 로 접는다(fail-closed).** 그러면 사용량은 로컬로 가고 한도만 원격을 쓴다 —
  // 틀린 숫자를 그리느니 덜 정확한 쪽으로 떨어지는 것이 낫다.
  baselineUsable?: boolean
  // 원격 응답 원본. 스칼라로 접히지 않은 필드(모델별 내역·기간 구분 등)를 잃지 않기 위해
  // 통째로 보관한다. 나중에 주간 기준선 같은 것이 필요해지면 여기서 꺼내 컬럼을 늘린다.
  raw: unknown
}

// 컴포지션 루트가 주입하는 포트. **`undefined` 는 오류가 아니라 정상 구성이다** — 원격 사용량
// endpoint 가 없는 배포에서는 주입하지 않고, 그러면 관련 cron 잡도 등록되지 않는다.
export interface UsageFetcher {
  // 실패는 throw 가 아니라 `null` 로도 표현할 수 있다. 미인증·사내망 밖은 **정상 상태**이므로
  // 호출자가 오류로 올리지 않고 다음 틱을 기다린다.
  fetchUsage(providerKey: string, signal?: AbortSignal): Promise<UsageSnapshot | null>
}
