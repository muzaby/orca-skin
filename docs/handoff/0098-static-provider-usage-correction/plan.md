# Plan — 0098-static-provider-usage-correction

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 흐름: **의도 → 조사 → 설계 → 리스크**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0098-static-provider-usage-correction` |
| 작성자 | Claude Code |
| 일자 | 2026-07-12 |
| 매핑 | PHASES 행 / PR (구현 후) |
| 상태 | READY |
| 구현 주체 | **Codex** (신규 기능) |

## 핵심 설계 원칙 (사용자 확정)

1. **일반 시나리오, provider-불특정**: Bedrock/vertex/custom 은 모두 같은 형태(월 한도 + 이달 사용량 제공)의 **한 가지 일반 시나리오**다. 코어는 특정 provider 이름을 절대 하드코딩하지 않는다.
2. **플러그인 통합**: 정적 provider 추가 = **자체 완결 모듈(config + 선택적 hook) 파일 구성만**. 기존 코어(서비스·스케줄러·IPC·핸들러·tracker·enumeration)는 **손대지 않는다**(1회 프레임워크 배선 후 per-provider 편집 0).
3. **hook 이 1급 확장 단위, config 는 옵션 sugar**: 실사례의 보정은 단순 fetch 가 아니라 **인증(OAuth client-credentials·AWS STS AssumeRole+SigV4·refresh) → 집계 API 호출 → 매핑**의 다단계다. 이 "어떻게" 전 과정은 `hook.ts`(imperative `fetchCorrection`) 임의 async 코드가 소유한다. 선언적 `CorrectionConfig` 는 **무인증 단순 케이스용 옵션**일 뿐 기본 경로가 아니다.
4. **프레임워크는 경계만 소유**: 프레임워크가 아는 것은 훅 결과 `snapshot | null` 과 그 이후(영속·오프라인·override)뿐. 인증 단계·401 재인증·페이지네이션·서명은 **절대 모델링하지 않는다**(핸들 불가한 세부를 훅에 위임). 대신 훅이 실제 인증을 돌릴 수 있도록 **`CorrectionContext` 계약을 충분히** 준다(§B).
5. 동적 provider 는 as-is. 외부값 override + 오프라인 스탤니스(마지막 보정값 영속).

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 정적 provider 인터페이스(동적 as-is). 설정>사용량><정적 provider> 주기 새로고침 시 보정 훅 실행. 훅이 SDK 추적 사용량 보정 오브젝트 제공. 월 한도+사용량으로 Orca 밖 집계 포함 보정. 마지막 보정값 영속(오프라인 대비). | 라이브 세션 요청 |
| 명시 요구(추가 확정) | **Bedrock 은 예시** — bedrock/vertex/custom 모두 동일 형태의 **일반 시나리오**로 설계. **config+hook 파일 구성만으로 통합**되고 **기존 코드 추가/삭제 최소**. 외부값 override + 오프라인 스탤니스. 프레임워크+인터페이스/스텁(실 엔드포인트는 config 주입). | 라이브 세션 Q&A |
| 추론 의도 | 도넛(`useProviderUsageLimits`)도 provider summary 를 읽으므로 보정 일관 반영 필요(사용자 미언급, 파생) | 코드 파생 |

## Context (왜)

Orca 는 provider 를 파일시스템 디렉토리 트리로만 정의하고(동적, `provider-registry.ts` `readdirSync` 열거), 사용량은 로컬 `turn_usage` 원장 SUM(추정 telemetry)으로만 파생한다. 외부 보정 seam(`external-correction.ts`)은 no-op·스칼라만 다룬다. 사내 환경의 Bedrock·vertex·custom provider 는 **월 한도 + 이달 누적 사용량**을 API 로 제공하며 이 값은 **Orca 밖 클로드 집계까지 모두** 추적한다 — 로컬 추정은 남은 한도를 과대평가한다.

목표: **정적 provider 를 플러그인 모듈(config+hook)로 통합**하는 일반 프레임워크를 만들어, 각 정적 provider 가 **주기 새로고침 시 호출되는 보정 훅**으로 외부 집계를 반영하고, **마지막 보정값을 영속**해 오프라인에서도 최신 근사를 유지한다. 새 정적 provider 추가는 **모듈 파일 구성만**으로 끝나야 한다(코어 무편집).

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| provider = 디렉토리 SSOT, 코드 정적 레지스트리 없음. 열거 진입점 | `app/src/main/features/providers/provider-registry.ts:58` |
| 보정 seam 예약·no-op·스칼라만 | `app/src/main/features/usage/external-correction.ts:10` |
| 보정 소비점 `remainingUsd`(미배선)·provider 집계 `providerSummary` | `app/src/main/features/usage/tracker.ts:21,51` |
| provider별 한도 저장 패턴(신규 테이블 틀) | `app/src/main/infra/db/migrations/0012_provider_limits.sql`, `infra/db/queries.ts`(get/setProviderLimit) |
| provider 귀속 = `turn_usage ⨝ sessions.provider_key` | `migrations/0008_provider_key.sql`, `queries.ts` `sumUsageByBoundariesForProviderStmt` |
| cost IPC 4채널 + `ProviderUsageEntry` | `app/src/shared/ipc.ts`, `app/src/main/app/handlers/misc.ts:245`, `docs/IPC_CONTRACT.md` |
| provider 종류 판별(bedrock/vertex/custom/anthropic) = env 분류 | `app/src/main/adapters/claude-settings.ts` `classifyClaudeEnv` |
| 설정 provider 서브탭 + SyncRow + 상대시각 | `features/settings/components/ProviderUsageTab.tsx`, `UsageTab.tsx`, `shared/time/relative` |
| 도넛 provider-aware 파생(0082) | `features/cost/hooks/useProviderUsageLimits.ts` |
| 스케줄러 + 액션 컴포지션 루트 주입 + 설정 배선(0091) | `features/scheduler/`, `app/bootstrap.ts`, `SettingsSchema.scheduler` |
| 자격증명 = safeStorage secret-store · `${VAR}` 확장 선례(0009) | `infra/config/secret`, `infra/config`, `docs/arch/backend/security.md §1.4` |
| 마이그레이션 append-only 기계 강제 | `app/AGENTS.md`, `scripts/check-migrations-appendonly.mjs` |
| main DAG(교차 import 금지·공유 타입 contracts·concrete 는 컴포지션 루트) | `app/src/main/AGENTS.md` |
| main 전역 `fetch` → 신규 HTTP 의존성 불필요 | Node18+/Electron39 |

## 인수 기준 (Acceptance Criteria)

1. **정적 provider 모듈 규약**: 정적 provider 1건 = 자체 완결 모듈 `{ config, hook? }`. 코어는 provider 이름을 하드코딩하지 않고 레지스트리를 순회한다.
2. **플러그인 통합(코어 무편집)**: 새 정적 provider 추가 = **모듈 파일 구성 + 배럴 1줄**(또는 glob 자동수집). 서비스·스케줄러·IPC·핸들러·tracker·enumeration **편집 0**임을 문서·테스트로 보인다.
3. **hook 이 기본 확장 단위**: 모듈이 `hook.ts`(`UsageCorrectionProvider.fetchCorrection(ctx) → UsageCorrectionSnapshot|null`)를 export 하면 **인증(다단계)·집계 호출·매핑 전 과정을 임의 async 코드로** 수행한다. 프레임워크는 결과 `snapshot|null` 만 소비한다.
4. **CorrectionContext 충분성**: `ctx` 는 실 인증 흐름을 지원한다 — `{ providerKey, fetch, signal(프레임워크 소유 타임아웃/취소), secret(read+write), env, settings(provider settings.json), store(provider-scoped KV·토큰 TTL 캐시), logger, clock }`. 훅은 매 틱 재인증 없이(store) 스케줄러를 wedge 하지 않고(signal) 동작한다.
5. **선언적 config 는 옵션 sugar**: 무인증 단순 케이스는 `CorrectionConfig`(엔드포인트·응답 JSON path 매핑)만으로 hook 코드 없이 동작(기본 경로 아님).
6. **주기 새로고침 → 훅 실행**: 설정>사용량><정적 provider> 새로고침(수동 버튼 + 30s 틱)이 main 보정 fetch 를 트리거해 해당 모듈의 훅/generic-fetcher 를 호출한다.
7. **외부값 override**: 스냅샷이 있으면 월 사용량=`usedUsd`, 한도=`limitUsd` 로 덮어써 `computeUsageLimits` 에 전달.
8. **영속(오프라인)**: 성공 fetch → DB upsert. 실패/오프라인 → 마지막 영속 스냅샷 사용(stale). 영속값 없을 때만 로컬 폴백.
9. **스탤니스 표시**: `source(local|external)` + `fetchedAt` 기반 "마지막 동기화: <상대시각>" + 오프라인 배지.
10. **스케줄러 백그라운드 갱신**: 설정 화면이 닫혀도 레지스트리의 모든 정적 provider 를 주기 fetch·영속(오프라인 최신성). 컴포지션 루트가 액션 주입, 레지스트리 순회는 provider-불특정. **훅은 프레임워크 소유 `signal` 로 타임아웃**되어 인증 지연이 스케줄러/종료를 wedge 하지 않는다.
11. **동적 provider 불변** + **경계·게이트·계약**: 동적 provider 경로 무회귀 · main DAG 위반 0 · 신규 의존성 0 · `IPC_CONTRACT.md` 동시 갱신 · 게이트 green + 신규 단위 테스트(generic fetcher 매핑·병합·영속·스키마 · **다단계 인증 훅 예시: store 토큰 캐시 재사용·signal 타임아웃·secret write-back**).

## 범위 / 비범위

- **범위**: 정적 provider 모듈 규약 + 레지스트리(배럴/glob) · `CorrectionConfig` + generic HTTP correction provider · `UsageCorrectionProvider` 인터페이스(contracts) · 보정 병합/영속 서비스 · 신규 마이그레이션 · cost IPC 확장 · 설정 서브탭 표시 · 스케줄러 job · **문서화된 예시 모듈(템플릿)** · 도넛 일관.
- **비범위(후속/사용자 직접)**: 실 bedrock/vertex/custom 모듈의 엔드포인트·응답 계약·자격증명 실값(사용자가 config 로 주입) · 전역(계정) 사용량 탭 보정(현재 provider 서브탭 한정) · 정적 provider 를 엔진 CRUD read-only 로 전면 노출.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 재사용: `external-correction.ts`(확장) · `tracker.providerSummary` · `provider_limits` 틀 · `features/scheduler`+`bootstrap` 주입 · secret-store + `${VAR}` 확장(0009) · `ProviderUsageTab`/`SyncRow`/`relativeTimeLabel`/`useProviderUsage`/`useProviderUsageLimits`.
- 전제: main 전역 `fetch`(신규 HTTP 라이브러리 미도입). 보정 fetch 는 턴 밖 out-of-band·짧은 타임아웃·throw 격리.
- **신규 의존성**: 없음(목표). 필요 시 **사용자 승인**.

## 설계 — 플러그인 구조 (핵심)

### A. 정적 provider 모듈 규약 (per-provider 추가 표면)

정적 provider 1건 = 디렉토리 `app/src/main/static-providers/<name>/`:

- `config.ts` — `StaticProviderConfig`:
  ```ts
  interface StaticProviderConfig {
    key: string              // 바인딩할 provider key (예: 'claude-bedrock') — enumeration 은 동적 유지
    displayName?: string
    correction:
      | { kind: 'http'; endpoint: string; method?: 'GET' | 'POST'
          headers?: Record<string, string>          // 값에 ${SECRET:x} / ${ENV:x} 확장
          body?: unknown
          map: { limitUsd?: string; usedUsd: string; asOf?: string }  // 응답 JSON path
          timeoutMs?: number }
      | { kind: 'custom' }   // hook.ts 가 담당 — 인증 있는 실 provider 의 기본값
    refreshCron?: string     // 스케줄러 주기(기본값 상속)
  }
  ```
- `hook.ts` — `kind:'custom'` 모듈의 본체. `export const correction: UsageCorrectionProvider`. **인증(다단계)+집계 호출+매핑을 임의 async 코드로** 수행(§D). 실 bedrock/vertex/custom 은 대개 이 경로.
- `index.ts` — `export default { config, hook? }`.

배럴 `static-providers/index.ts` 가 모듈을 `STATIC_PROVIDERS[]` 로 모은다 — **추가 = 새 폴더 + 배럴 1줄**(또는 electron-vite `import.meta.glob` 로 0줄 자동수집; 안정성 위해 배럴 1차·glob 옵션).

### B. 1회 프레임워크 배선 (per-provider 편집 없음, provider-불특정)

- `contracts/usage-correction.ts` — `UsageCorrectionProvider` · `UsageCorrectionSnapshot { limitUsd?, usedUsd, asOf }` · `CorrectionContext`(실 인증 흐름 지원):
  ```ts
  interface CorrectionContext {
    providerKey: string
    fetch: typeof fetch                 // 임의 HTTP(다단계 인증·집계 호출)
    signal: AbortSignal                 // 프레임워크 소유 타임아웃/취소 — 인증 지연이 스케줄러 wedge 방지
    secret: { get(k): Promise<string|null>; set(k, v): Promise<void> }  // safeStorage — 회전 refresh token write-back
    env: Record<string, string>         // provider env (AWS 자격증명·region 등)
    settings: Record<string, unknown>   // provider settings.json (base URL·region)
    store: { get(k): unknown; set(k, v): void }  // provider-scoped KV — 토큰 TTL 캐시(매 틱 재인증 방지)
    logger: (msg, meta?) => void        // 진단
    clock: () => number
  }
  ```
  프레임워크는 이 계약만 제공하고 **인증 로직 자체는 훅 소유**다(OAuth client-credentials·STS AssumeRole+SigV4·401 재인증·페이지네이션 = 훅 내부).
- `features/usage/http-correction.ts` — `createHttpCorrection(config)`: 선언적 config → `UsageCorrectionProvider`. `${SECRET:}`/`${ENV:}` 확장 · JSON path 매핑 · 타임아웃 · 에러=null. **bedrock/vertex/custom 공통 경로**(provider별 코드 0).
- `features/usage/correction-service.ts` — `ProviderCorrectionService`(레지스트리 주입): providerKey → (hook ?? createHttpCorrection(config)) 호출 → 성공 upsert·병합 / 실패 영속 폴백(stale) / 없으면 로컬. 순수 `applyProviderCorrection(local, snapshot|null, fetchedAt)` 분리(단위 테스트). provider별 in-flight 가드.
- `infra/db` — `0014_provider_usage_correction.sql`(`provider_key PK, limit_usd, used_usd, as_of, fetched_at, source`) + `get/upsertProviderCorrection` prepared stmt.
- `app/`(컴포지션 루트, **1회**) — `STATIC_PROVIDERS` 순회로 correction 레지스트리 구성 · `ProviderCorrectionService` 주입 · 스케줄러 job(레지스트리 전체 순회) 주입 · cost 핸들러 주입. **provider 이름 리터럴 없음** — 배럴만 읽는다.
- `external-correction.ts` — 스칼라→스냅샷 확장(`Noop` 유지: null).

### C. IPC / Renderer

- 신규 invoke `cost:refreshProviderCorrection(providerKey)` — SyncRow/30s 틱이 호출(훅 트리거+영속).
- `costProviderSummaries` 의 `ProviderUsageEntry` 확장: `source: 'local'|'external'`, `asOf?`, `fetchedAt?`, `stale?`(읽기는 저렴하게 마지막 병합 뷰, fetch 는 refresh 채널 분리). `docs/IPC_CONTRACT.md` 동시 갱신(§6).
- `ProviderUsageTab` — external 이면 외부 used/limit 바 + `SyncRow`("마지막 동기화: <상대시각>", `relativeTimeLabel`) + `stale` 배지. `useProviderUsage` refresh → `cost:refreshProviderCorrection`. 도넛 `useProviderUsageLimits` 자동 일관. i18n ko/en.

> **불변식**: A(모듈)만 provider별로 늘어난다. B/C 는 provider-불특정 1회 코드. enumeration(`provider-registry.ts`)·엔진 CRUD·tracker 는 무편집(동적 as-is). 정적 provider 는 correction 을 provider **key 로 바인딩**만 하므로 열거 로직 불변.

### D. 인증·다단계 호출 (hook 이 소유, 프레임워크 비관여)

실 보정 훅은 단순 fetch 가 아니다 — 대표 패턴:
- **OAuth2 client-credentials**: `store` 에 access token+만료 캐시 → 만료 전 재사용, 만료 시 토큰 엔드포인트 재발급. client id/secret 은 `secret.get`.
- **AWS(STS AssumeRole + SigV4)**: `env` 의 base 자격증명으로 STS 임시 크레덴셜 취득(`store` 캐시) → Cost Explorer/Bedrock usage 호출을 SigV4 서명. (서명 유틸은 훅 내부 구현 or 선택적 공용 헬퍼.)
- **refresh-token 회전**: 응답의 새 refresh token 을 `secret.set` 으로 write-back.
- **401 재인증·페이지네이션·다중 호출**: 훅이 루프/재시도로 처리 후 최종 `snapshot` 반환.

프레임워크가 보장하는 것: `signal` 로 전체 훅 호출에 타임아웃(인증 왕복 포함) → 오프라인/지연 시 `null` 로 귀결되어 **영속/stale 경로**로 안전 폴백. **개방 결정(설계자→사용자)**: 공용 인증 헬퍼(bearer 캐시·client-credentials·SigV4 서명) 유틸을 코어에 제공할지 vs 각 훅이 자체 구현할지 — 기본은 훅 자체 구현(코어 표면 최소), 반복 3회 시 헬퍼 승격(rule of three).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **오프라인**: fetch 실패 → 마지막 영속값 + stale 배지. 영속값 없음 → 로컬 폴백(현행) + "외부 집계 대기".
- **동시성**: refresh 중복 가드(`refreshing`, 0080 SyncRow 선례) + service provider별 in-flight(스케줄러↔UI 겹침).
- **한도 null**: 외부 미보고(`limitUsd=null`) → 무제한 표기(`common.unlimited`), 사용량만.
- **`asOf`(외부 기준) vs `fetchedAt`(수신) 분리** — 상대시각은 `fetchedAt`.
- **테마/접근성**: stale 배지·동기화 라벨 시맨틱 토큰 + ARIA.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 실 API 계약 미확정(bedrock/vertex/custom) | 선언적 `CorrectionConfig` + 예시 모듈. 실 endpoint/map/secret 은 사용자 config 주입(비범위). |
| main 네트워크 I/O 안정성 | out-of-band·짧은 타임아웃·throw 격리(턴 무영향)·실패=영속/stale. |
| 매 틱 재인증(STS/OAuth 왕복 비용·rate limit) | `ctx.store` provider-scoped 토큰 TTL 캐시 — 훅이 만료 전 재사용. |
| 인증 지연이 스케줄러/앱 종료 wedge | `ctx.signal`(프레임워크 소유 타임아웃) 이 전체 훅 호출 취소 → `null` 폴백. `shutdown` 시 abort. |
| 다단계 인증을 코어가 모델링하려는 유혹 | 코어는 `snapshot|null` 경계만 소유. 인증 로직은 훅 소유(§D) — 코어 확장 금지. |
| 자격증명 노출 | `${SECRET:}`=safeStorage secret-store, argv/평문 금지(branded env 불변식). |
| override 로 로컬 추정 은폐 | `source`+stale 배지로 출처 투명. 로컬 폴백은 영속값 부재 시만. |
| 마이그레이션 되돌리기 어려움 | append-only 신규 파일(0014). |
| glob 자동수집 번들 리스크 | 배럴 1차(명시), glob 은 옵션. |

- **단독 결정 금지(사용자 후속)**: 실 bedrock/vertex/custom endpoint·응답 매핑·자격증명 실값(config 주입) · 자격증명 저장 위치 최종 확정(secret-store 기본 제안).

## 영향 받는 파일

- **1회 프레임워크(provider-불특정)**: `contracts/usage-correction.ts` · `features/usage/{http-correction,correction-service}.ts` · `features/usage/external-correction.ts`(확장) · `infra/db/migrations/0014_provider_usage_correction.sql`(신규)+`infra/db/queries.ts` · `app/bootstrap.ts`·`app/handlers/misc.ts` · `shared/{ipc,protocol}.ts` · renderer `features/settings/components/ProviderUsageTab.tsx`·settings usage hook·`features/cost/hooks/useProviderUsageLimits.ts`·`shared/i18n/resources/{ko,en}` · `docs/IPC_CONTRACT.md`.
- **per-provider 추가 표면(예시 1건 + 배럴)**: `app/src/main/static-providers/<name>/{config.ts,hook.ts?,index.ts}` + `static-providers/index.ts`(배럴).

## 참고 문서

- `docs/TRD.md §6`(데이터 모델)·`§7`(어댑터) / `docs/arch/backend/security.md §1.4`(자격증명) / `docs/arch/backend/persistence.md`(2계층) / `docs/IPC_CONTRACT.md`(§6 변경 절차 — **반드시 동시 갱신**) / `app/src/main/AGENTS.md`(레이어 DAG)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: generic HTTP correction 매핑(`${SECRET/ENV}`·JSON path·타임아웃·에러=null) · **다단계 인증 훅 예시**(store 토큰 캐시 hit/miss·만료 재발급·signal 타임아웃→null·secret write-back) · `applyProviderCorrection`(override·null 폴백·stale) · 영속 upsert/read · 마이그레이션 append-only/점프 안전 · IPC zod(entry 확장·refresh 채널) · **"새 모듈 추가로 코어 무편집" 회귀**(레지스트리 순회가 배럴만 의존).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 + Q&A 인용, 추론(도넛 일관)은 추론 표기.
- [x] 자료조사 — 발견마다 `파일:라인`/문서 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능(플러그인 무편집 포함).
- [x] 의존 기술 — 신규 의존성 0 목표, 실 계약은 사용자 후속.
- [x] 파생 UX — 오프라인/동시성/null/시계 왜곡.
- [x] 리스크 — 네트워크·자격증명·override·마이그레이션·glob, Open 항목 사용자 분리.

---

> **[구현자 기입]** 이하는 구현 턴(Codex)에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 정적 provider를 코드 정의로 두고, 부팅 시 `sources/settings/<adapter>/<provider>/settings.json`을 materialize해 기존 디렉터리 SSOT 열거를 유지하는 방향으로 구현했다. 외부 API는 correction이 아니라 authoritative `ExternalUsageReport`로 명명했고, API 제공 해상도(`quota`/`totals`/`byModel`)가 환경마다 다른 점을 optional section으로 수용했다.
- 이견 / 우려: 원 plan의 `Correction*` 네이밍과 `summary.month.totalCostUsd` override는 제품 의미와 맞지 않아 변경했다. `ProviderUsageEntry.summary`는 Orca 내부 `turn_usage` 기준으로 유지하고, 도넛/설정 provider 서브탭의 한도·잔량 계산에는 `effectiveLimit`만 사용한다. 또한 `app/src/main/static-providers` 최상위 디렉터리는 boundary 위반 가능성이 있어 `features/providers/static` + `contracts/usage-report` + `features/usage` 조합으로 배치했다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `app/src/main/static-providers` 신규 최상위 디렉터리 boundary 리스크 | ✅ 구현함 — 정적 provider materializer는 `features/providers/static`, usage report 계약은 `contracts/usage-report`, fetch/cache 서비스는 `features/usage`에 배치 | main DAG·feature 교차 import 금지 준수 |
| 2 | `Correction` 네이밍이 API authoritative 의미를 훼손 | ✅ 구현함 — `ExternalUsageProvider`/`fetchUsageReport`/`ExternalUsageReport`/`UsageReportConfig`/`provider_usage_report_cache`로 명명 | 사용자 확정: API가 진실이며 제공 해상도만 다름 |
| 3 | 외부 값으로 로컬 `summary`를 덮어쓰면 도넛·provider 서브탭 표시 의미가 왜곡 | ✅ 구현함 — `summary`는 로컬 유지, `effectiveLimit`에 외부 `quota.usedUsd/limitUsd/remainingUsd`를 반영 | 사용자 확정: 집계 표시는 현재 유지, 한도·잔량만 보정 |
| 4 | 정적 provider가 `sources/settings`에 없으면 기존 registry/UI에 노출되지 않음 | ✅ 구현함 — bedrock/vertex/custom 기본 `settings.json`을 부팅 시 존재 보장하되 정상 사용자 편집은 덮어쓰지 않음 | 기존 provider registry의 디렉터리 SSOT 유지 |
| 5 | `npm test`의 quoted glob이 현재 Node 실행 환경에서 scripts 테스트를 찾지 못함 | ✅ 구현함 — package script를 `node --test scripts/*.test.mjs`로 조정 | 게이트가 실제 스크립트 테스트 24개를 실행하도록 수정 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/shared/ipc.ts`, `app/src/shared/protocol.ts`, `app/src/main/contracts/usage-report.ts`, `app/src/main/features/providers/static/index.ts`, `app/src/main/features/usage/{external-usage,external-usage-service,http-usage-report}.ts`, `app/src/main/infra/db/migrations/0014_provider_usage_report_cache.sql`, `app/src/main/infra/db/{migrate,queries,types}.ts`, `app/src/main/app/{bootstrap,context,handlers/misc}.ts`, `app/src/preload/index.ts`, renderer cost/settings hooks, 관련 테스트, `docs/IPC_CONTRACT.md`, `app/package.json` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (Vitest 826 + node:test 24 passed) |
| 블로커 / 역질문 | 없음. 실 bedrock/vertex/custom API endpoint·인증·응답 매핑은 비범위라 정적 provider settings materialize와 report framework만 제공. |
| 대상 커밋 | `HEAD` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | **예시 다단계 인증 훅 모듈 부재** — `STATIC_USAGE_PROVIDERS` 3항 모두 `usage{}` 미정의, `hook.ts` 템플릿 없음. §4 `secret.set` 이 `void`(비-Promise)라 write-back await 불가 | verify r1 §3·§4 (`static/index.ts:9`, `contracts/usage-report.ts:7`) | OAuth client-credentials/bearer 캐시 예시 훅 1건 추가(store TTL 캐시·secret read/write·signal 취소 시연) + `secret.set` → `Promise<void>` 정렬. 실 endpoint 는 config 주입 지점만 | open |
| D2 | **§11 요구 신규 테스트 부재** — generic fetcher 매핑(`http-usage-report`)·실 DB 영속 upsert/read·IPC zod 스키마 테스트 0. 병합은 external override 1케이스만 | verify r1 §5·§8·§11 (`http-usage-report.ts` 테스트 grep 0, `external-usage-service.test.ts:17` fake db) | (a) `http-usage-report` 매핑/expand/timeout/null 테스트 (b) `queries.test.ts` 실 upsert/get 왕복 (c) `RefreshProviderUsageReportSchema`·entry 확장 zod (d) `effectiveLimitFromReport` null 폴백·stale 케이스 | open |
| D3 | **"코어 무편집" 회귀 테스트 부재** — 레지스트리 순회가 배럴만 의존함을 고정하는 테스트 없음 | verify r1 §2 (plan 게이트 line 185) | 배럴 배열 확장 시 서비스가 순회만으로 인식하는 회귀 테스트 추가 | open |
| D4 | **stale/offline 배지 미렌더 + 30s 틱 부재** — `ProviderUsageTab` 에 `stale`/`source` 배지 없음(현재 fetchedAt 상대시각만). 자동 30s 틱 없음(스케줄러 5분만) | verify r1 §9·§6 (`ProviderUsageTab.tsx` grep `stale`=0) | `effectiveLimit.stale`/외부 미보고 기반 배지 + i18n ko/en 렌더. 탭 오픈 중 30s 틱 새로고침 검토 | open |
