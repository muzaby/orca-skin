import type { UsageReportConfig, ExternalUsageReport } from '../../shared/ipc'
import type { UsageSample, UsageSampleRequest } from './usage-source'

export interface ExternalUsageContext {
  providerKey: string
  fetch: typeof fetch
  signal: AbortSignal
  secret: { get(name: string): string | null; set(name: string, value: string): void }
  env: Record<string, string>
  settings: Record<string, unknown>
  store: { get(key: string): unknown; set(key: string, value: unknown): void }
  logger: (message: string, meta?: Record<string, unknown>) => void
  clock: () => number
}

export interface ExternalUsageProvider {
  fetchUsageReport(ctx: ExternalUsageContext): Promise<ExternalUsageReport | null>
}

// ── 구독 경로 (0176) ─────────────────────────────────────────────────────────
//
// 인증 플랫폼(0157~) 이 자격증명을 소유한 뒤로, usage provider 는 **자기 손으로 요청을 만들 수
// 없다** — `provider:<key>:` 네임스페이스(0130 핸드셰이크)에 쓰는 쪽이 사라졌기 때문이다.
// 대신 usage connector 가 인증된 호출을 하고, 그 **결과 표본**을 이 구독이 받아 자기 포맷으로
// 매핑한다.
//
// **`map` 의 컨텍스트에는 `fetch` 도 `secret` 도 없다.** 그것이 이 계약에서 확인할 수 있는
// 보안 속성이다(AUTH-PLAT-009 를 usage 경로까지 확장).
export interface UsageMapContext {
  providerKey: string
  settings: Record<string, unknown>
  store: { get(key: string): unknown; set(key: string, value: unknown): void }
  logger: (message: string, meta?: Record<string, unknown>) => void
  clock: () => number
}

export interface UsageSubscription {
  // 어느 usage connector 의 결과를 받을지. **미지정이면 연결된 source 전부**를 받고 map 이
  // 판정한다(해당 없으면 null).
  sourceId?: string
  request: UsageSampleRequest
  // 범용 표본 → 이 provider 의 리포트. **형식이 맞지 않으면 `null`** — 그것이 정상 경로이며
  // 프레임워크가 마지막 성공 baseline 으로 접는다(조용한 빈 성공을 만들지 않는다).
  map(sample: UsageSample, ctx: UsageMapContext): ExternalUsageReport | null
}

export interface StaticUsageProviderModule {
  adapter: 'claude'
  provider: string
  defaultSettings: Record<string, unknown>
  // 해소 우선순위는 **subscription > provider > config** 다.
  //   subscription — 인증이 필요한 사내 endpoint (usage connector 경유, 0176)
  //   provider     — 직접 구현 훅 (공개 endpoint·복잡한 핸드셰이크, 0099)
  //   config       — 선언형 HTTP 1회 + JSON 경로 매핑 (공개 endpoint, 0099)
  usage?: {
    config?: UsageReportConfig
    provider?: ExternalUsageProvider
    subscription?: UsageSubscription
  }
}
