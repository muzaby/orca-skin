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
3. **config-우선, hook 은 escape hatch**: 대부분은 **선언적 `CorrectionConfig`(엔드포인트 + 응답 필드 매핑)** 만으로 동작. 비정형 API 만 `hook.ts`(imperative `fetchCorrection`)로 대체.
4. 동적 provider 는 as-is. 외부값 override + 오프라인 스탤니스(마지막 보정값 영속).

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
3. **선언적 config-우선**: `CorrectionConfig`(엔드포인트·인증 ref·응답 필드 매핑 `limitUsd/usedUsd/asOf`·타임아웃·주기)만으로 **hook 코드 없이** 보정이 동작한다(공통 HTTP 시나리오 = bedrock/vertex/custom 동형).
4. **hook escape hatch**: 비정형 API 는 모듈이 `hook.ts`(`UsageCorrectionProvider.fetchCorrection(ctx) → UsageCorrectionSnapshot|null`)를 export 해 config 자동 생성기를 대체한다.
5. **주기 새로고침 → 훅 실행**: 설정>사용량><정적 provider> 새로고침(수동 버튼 + 30s 틱)이 main 보정 fetch 를 트리거해 해당 모듈의 훅/generic-fetcher 를 호출한다.
6. **외부값 override**: 스냅샷이 있으면 월 사용량=`usedUsd`, 한도=`limitUsd` 로 덮어써 `computeUsageLimits` 에 전달.
7. **영속(오프라인)**: 성공 fetch → DB upsert. 실패/오프라인 → 마지막 영속 스냅샷 사용(stale). 영속값 없을 때만 로컬 폴백.
8. **스탤니스 표시**: `source(local|external)` + `fetchedAt` 기반 "마지막 동기화: <상대시각>" + 오프라인 배지.
9. **스케줄러 백그라운드 갱신**: 설정 화면이 닫혀도 레지스트리의 모든 정적 provider 를 주기 fetch·영속(오프라인 최신성). 컴포지션 루트가 액션 주입, 레지스트리 순회는 provider-불특정.
10. **동적 provider 불변** + **경계·게이트·계약**: 동적 provider 경로 무회귀 · main DAG 위반 0 · 신규 의존성 0 · `IPC_CONTRACT.md` 동시 갱신 · 게이트 green + 신규 단위 테스트(generic fetcher 매핑·병합·영속·스키마).

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
      | { kind: 'custom' }   // hook.ts 가 담당
    refreshCron?: string     // 스케줄러 주기(기본값 상속)
  }
  ```
- `hook.ts`(선택) — `kind:'custom'` 일 때만. `export const correction: UsageCorrectionProvider`.
- `index.ts` — `export default { config, hook? }`.

배럴 `static-providers/index.ts` 가 모듈을 `STATIC_PROVIDERS[]` 로 모은다 — **추가 = 새 폴더 + 배럴 1줄**(또는 electron-vite `import.meta.glob` 로 0줄 자동수집; 안정성 위해 배럴 1차·glob 옵션).

### B. 1회 프레임워크 배선 (per-provider 편집 없음, provider-불특정)

- `contracts/usage-correction.ts` — `UsageCorrectionProvider` · `UsageCorrectionSnapshot { limitUsd?, usedUsd, asOf }` · `CorrectionContext { providerKey, fetch, secret, env, clock }`.
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
- 신규 테스트: generic HTTP correction 매핑(`${SECRET/ENV}`·JSON path·타임아웃·에러=null) · `applyProviderCorrection`(override·null 폴백·stale) · 영속 upsert/read · 마이그레이션 append-only/점프 안전 · IPC zod(entry 확장·refresh 채널) · **"새 모듈 추가로 코어 무편집" 회귀**(레지스트리 순회가 배럴만 의존).

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

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (N passed) |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | … | … | open |
