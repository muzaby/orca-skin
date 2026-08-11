# Plan — 0183-usage-into-declarations

> **r2 재설계 (2026-08-11).** r1 은 사용자 요구를 **오독**했다 — "제거" 를 "선언으로 이동" 으로
> 읽어 `Provider.usage` 조인을 만들었다. 사용자 정정에 따라 **조인을 취소하고 원격 사용량 경로를
> 전면 제거**한다. r1 의 구현 기록은 이력으로 문서 하단에 보존한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0183-usage-into-declarations` |
| 작성자 | Claude Code |
| 일자 | 2026-08-10 (r1) → **2026-08-11 (r2 재설계)** |
| 매핑 | 0182 후속 (사용자 질의에서 파생) |
| 상태 | r1 `impl/IMPL_DONE` → **verify/FAIL (설계 전제 오독)** → **r2 plan/READY** |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 질의 ① | "usage 를 반환하는 SP 를 service 에 선언해 api 로 호출할 수 있다면 static 을 따로 구분할 필요가 있는가?" | 라이브 세션 (2026-08-10) |
| 질의 ② | "SP 에 대한 모든 구현을 providers/declarations 에 할 수 있는데 별도 폴더링이 필요한가?" | 같은 세션 |
| 명시 요구 (r1 이 오독) | **① `providers/declarations` 외 모두 제거 ② SP 의 API 호출·주기적 호출(cron) 가이드 문서 보완** | 같은 세션 |
| **사용자 정정 (r2 의 출처)** | "사용자는 **다른 feature 에서 sp 의 api 를 사용할 수 있다면** 파편화된 구현(providers/declarations 외 구현)을 **모두 제거**하라고 했는데, 에이전트가 해당 경로에 **모두 조인**했다. **조인을 취소하고 제거하라. usage 스펙 구현을 취소하라.**" | 라이브 세션 (2026-08-11) |
| 사용자 결정 ⓐ | **원격 사용량 경로 전면 제거** — 조인 취소 + 남는 조회 경로(서비스·포트·계약·cron·IPC·renderer 정합)까지. 사용량 = 로컬 집계만 | AskUserQuestion (2026-08-11) |
| 사용자 결정 ⓑ | **핸드오프는 0183 라운드 2** — 새 번호를 만들지 않고 이 문서를 재작성한다 | 같은 응답 |
| 사용자 결정 ⓒ | **구현 후 사용 가이드 보완 필수** — "sp api 의 주기적 호출 설정 방법 포함 (cron 설정, 위치 등)" | 계획 반려 메모 (2026-08-11) |
| 추론 의도 | 요구 ①의 목적은 *폴더를 줄이는 것*이 아니라 **SP 를 위한 플러그인 슬롯을 없애는 것**이다 — SP API 가 어느 feature 에서든 호출 가능하므로, 사용량은 필요해질 때 그 feature 안에 **평범한 코드**로 쓰면 된다 (추론. 근거 = 사용자 정정 문장의 조건절 "다른 feature 에서 sp 의 api 를 사용할 수 있다면") |

## Context (왜)

r1(`87c23b7`)은 `providers/static/`(7파일) · `http-usage-report.ts` · `usage-feed.ts` 를 지웠다.
거기까지는 요구와 같다. 그러나 같은 능력을 **선언 축으로 옮겨 붙였다** — `contracts/provider.ts` 에
`UsageSpec` 을 신설하고 `Provider.usage` 로 달았으며, `features/providers/usage-specs.ts` 가 그것을
뽑아 컴포지션 루트가 `ExternalUsageService` 에 주입한다. **제거가 아니라 이동(조인)** 이다.

사용자가 지목한 오독이 정확히 이 지점이다. 요구의 조건절("다른 feature 에서 SP 의 api 를 사용할
수 있다면")이 이미 *대안*을 지정하고 있었는데 — `ProviderApi` 를 주입받아 부르면 되므로 **전용
슬롯 자체가 불필요하다** — r1 은 그 조건절을 근거가 아니라 배경으로 읽었다.

의도한 결과: ⓐ SP 를 위한 **플러그인 슬롯성 배관이 코드 어디에도 남지 않는다** ⓑ 사용량은
로컬 집계(`UsageTracker`)만 남아 배선이 한 겹 준다 ⓒ **가이드가 "SP API 를 어떻게 부르고 어떻게
주기적으로 부르는가" 를 단계별로 답한다**(사용자 결정 ⓒ) — 사라지는 것은 *슬롯*이지 *능력*이 아니다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당하고, r1 보다 더 정확하다.** r1 은 증상("폴더가 셋")을 원인으로 삼아 *조인을 줄이는* 설계를 했다. 사용자가 지목한 원인은 **슬롯의 존재 자체**다 — 슬롯이 있으면 배포가 채울 자리를 찾고, 조인은 어디에 두든 다시 생긴다 | r1 이 만든 `Provider.usage` 를 **실제로 선언한 provider 는 0개**(`rg 'usage:' src/main/features/providers/declarations/*.ts` → **0건**). 슬롯만 있고 세입자가 없다 |
| 이미 있는 것 아닌가 | **대안이 이미 있다.** 다른 feature 가 SP 를 부르는 통로는 `ProviderApi.request` 로 이미 서 있고(0181), 컴포지션 루트가 좁힌 포트를 주입하는 관례도 서 있다 | `contracts/provider.ts` `ProviderApi` · `src/main/AGENTS.md` §해소책 1+3 · 가이드 §1.7 |
| 더 작은 해법이 있는가 | 있다 — *`UsageSpec` 만 지우고 `ExternalUsageService` 는 남기기*. **채택하지 않는다**: 소스가 0인 서비스·cron·IPC 채널이 남아 "부르지 않는 배관" 이 되고, 그것이 이번 요구가 없애려는 것이다. 사용자도 **전면 제거**를 선택했다 | 사용자 결정 ⓐ |
| 인용 자료가 요구를 부풀리지 않았나 | **r1 의 자기 진단이 결론을 부풀렸다.** "조인 2개 → 0개, 배포 파일 3곳 → 1곳" 은 *이동*의 성과지 *제거*의 성과가 아닌데, r1 은 이것을 요구 충족의 근거로 적었다(`[구현자 기입] r1` 구현 보고 "조인" 행). 이번 근거에서 제외한다 | r1 plan §설계 표 |
| 기존 채택 결정을 뒤집는가 | **뒤집는다 3건** — r1 이 세운 `UsageSpec` 축 · 0176 의 `UsageSourcePort` 계약 · 0111 의 외부 quota 권위 정합. 아래 §기존 결정 표 | |

- **사용자에게 올릴 것**: 없음(범위·핸드오프 처리·문서 처리 모두 이번 세션에서 결정받았다).

## 자료조사 (Research)

> 모든 수치는 이번 세션에서 직접 측정했다(승계 0건).

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **`Provider.usage` 를 선언한 provider 는 0개** — 슬롯만 있고 소비자가 없다. 제거 비용 0 | `rg -n 'usage:' app/src/main/features/providers/declarations/*.ts` → **0건** |
| `usageSpecs()` 호출부는 **1곳**(컴포지션 루트) | `rg -n 'usageSpecs' app/src/main` → `app/bootstrap.ts:90,492` (import+호출, **N=1 호출부**) |
| `ExternalUsageService` 소비자는 **3곳** — 생성(bootstrap) · 타입(context) · 사용(cost 핸들러 3회) | `rg -n 'externalUsage\|ExternalUsageService' app/src/main --glob '!**/*.test.*'` (**N=3 파일**) |
| `UsageSourcePort` 소비자는 **2곳** — 서비스의 `sources?` 와 컴포지션 루트 어댑터 | `external-usage-service.ts:27` · `app/usage-source.ts:28` (**N=2**) |
| `effectiveLimit` 프로덕션 소비자는 **4곳** — 생성 1(`external-usage.ts`)·계약 1(`shared/ipc`)·파생 1(`shared/usage/limits.ts`)·UI 1(`ProviderUsageTab.tsx` 2회) | `rg -n 'effectiveLimit' app/src --glob '!**/*.test.*'` (chat `contextWindow.ts` 의 동명 지역변수는 무관 — 별개 심볼) |
| `ExternalUsageReport` 의 하위 타입 4종(`UsageReportScope`·`UsageTotals`·`UsageQuota`·`UsageByModel`)은 **그 인터페이스 외 소비자가 없다** | `rg -n 'UsageReportScope\|UsageQuota\|UsageTotals\|UsageByModel' app/src` → `shared/ipc.ts` 자기 블록만 (DB 의 `sumUsageByModelSince` 는 이름만 유사한 별개 심볼) |
| 삭제 대상 줄 수(실측 `wc -l`): `usage-specs` 55+91 · `external-usage-service` 209+266 · `external-usage` 35 · `contracts/usage-report` 26 · `contracts/usage-source` 68 · `app/usage-source` 113 = **863줄** (+ `provider.ts` `UsageSpec` 블록 · `shared/ipc` 타입 블록 · `limits.ts` 외부 정합 2함수) | `wc -l` |
| IPC 채널은 현재 **77**, `cost` 도메인 **6**. `ipc-documentation.test.ts` 가 `CHANNELS` 길이 ↔ 문서 헤더/분포 합을 **셋 다 77 로** 하드코딩 대조 | `docs/IPC_CONTRACT.md:26,28` · `app/src/shared/ipc-documentation.test.ts:11-24` |
| `orca:cost:refreshProviderUsageReport` 행의 **문서 설명이 이미 stale** — r1 이 갱신하지 않아 삭제된 "정적 provider 모듈" 을 현재형으로 서술한다 | `docs/IPC_CONTRACT.md:275` |
| renderer 의 `refresh()` 는 **이미 폴백 분기를 갖고 있다** — provider key 가 없으면 `fetchEntries()`(=`providerSummaries`) 로 간다. 채널을 지워도 동기화 버튼은 그 분기로 성립한다 | `features/cost/hooks/useProviderUsage.ts:51-68` |
| 스케줄러는 **잡 2종을 설정으로 노출**한다(`usageRecompute` cron · `updateCheck` intervalMs) — `applySettings()` 가 설정 쓰기마다 반영. `provider-usage-report-refresh` 만 **컴포지션 루트 고정형**이었다 | `features/scheduler/scheduler.ts` `applySettings` · `src/shared/protocol.ts` `SchedulerSettingsSchema` · `app/bootstrap.ts:518` |
| 잘못된 cron 식은 **등록 시점에 throw** 한다(조용히 안 뜨는 잡 방지) | `features/scheduler/scheduler.ts` `schedule()` → `assertValidCron` · `scheduler.test.ts::"잘못된 cron 표현식은 등록 시점에 거부한다"` |
| DB 캐시 테이블은 마이그레이션 **0014**. 머지된 마이그레이션은 **수정 금지**이고 기계 강제된다 | `infra/db/migrations/0014_provider_usage_report_cache.sql` · `scripts/check-migrations-appendonly.mjs` |
| 가이드 §1.7 이 "다른 feature 슬라이스" 선례로 **삭제 대상 2파일**(`contracts/usage-source.ts` + `app/usage-source.ts`)을 인용 중 | `docs/guides/closed-network-extensions.md` §1.7 소비자 표 |
| 가이드 §5-b/§5-c 를 인용하는 외부 문서는 **2곳** | `rg -n '§5-b\|§5-c' docs --glob '!docs/handoff/**'` → `docs/AGENTS.md:23` · `docs/guides/AGENTS.md:12` (**N=2**) |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `Provider` 계약에 `usage` 필드와 `UsageSpec` 이 **없다** — 선언 스키마가 사용량을 모른다 | `rg -n 'UsageSpec\|usage\?:' app/src/main/contracts/provider.ts` → **0건** + `npm run typecheck` 3/3 | 배포가 `declarations/` 를 채울 때 보는 계약 |
| 2 | `features/providers/usage-specs.ts`(+test) · `features/usage/external-usage-service.ts`(+test) · `external-usage.ts` · `contracts/usage-report.ts` · `contracts/usage-source.ts` · `app/usage-source.ts` **8파일이 저장소에 없다** | `ls` 8경로 → 전부 부재 + `rg -n 'usage-specs\|external-usage\|usage-source\|usage-report' app/src` → **0건** | — |
| 3 | 부팅이 사용량 원격 잡을 **등록하지 않는다** — `provider-usage-report-refresh` 가 코드에 없고, 남는 잡은 `usage-recompute`·`update-check` 2종이다 | `rg -n 'provider-usage-report-refresh' app/src` → **0건** · `rg -n "scheduler.register\('" app/src/main/app/bootstrap.ts` → **2건** | `Bootstrap.start()` → `Scheduler` |
| 4 | `costProviderSummaries`·`costSetProviderLimit` 이 **로컬 값만으로** 엔트리를 만든다 — 응답이 `{providerKey, summary, limitUsd}` 3필드다 | `npm run typecheck` 3/3 (`ProviderUsageEntry` 축소가 호출부 전수를 강제) + `app/handlers/misc-split.test.ts` green | renderer 설정 사용량 탭 · 도넛 팝오버 → `app/handlers/cost.ts` |
| 5 | IPC 채널이 **76** 이고 `cost` 도메인이 **5** 이며, 코드·문서가 그 값으로 일치한다 | `app/src/shared/ipc-documentation.test.ts::"keeps the header, domain summary, and CHANNELS count at 76"` | `CHANNELS` ↔ `docs/IPC_CONTRACT.md` |
| 6 | `refreshProviderUsageReport` 가 preload·renderer api·핸들러·프로토콜 스키마 어디에도 없다 | `rg -n 'refreshProviderUsageReport\|RefreshProviderUsageReportSchema' app/src` → **0건** | — |
| 7 | 설정 사용량 탭의 **동기화 버튼이 계속 동작한다** — `refresh()` 가 `providerSummaries` 재조회 한 경로로 접힌다 | `rg -n 'costApi\.' app/src/renderer/src/features/cost/hooks/useProviderUsage.ts` → `providerSummaries`·`setProviderLimit` 만 | 설정 → 사용량 → provider 서브탭 → 동기화 |
| 8 | `computeProviderUsageLimits(entry)` 가 **로컬 파생 한 경로**로 동작하고 기존 한도 계산 결과가 유지된다 | `app/src/shared/usage/limits.test.ts` green (외부 정합 3케이스 제거, 로컬 케이스 유지) | 도넛 팝오버 `useProviderUsageLimits` · 설정 `ProviderUsageTab` |
| 9 | DB 캐시 접근자가 없다 — `getProviderUsageReport`/`upsertProviderUsageReport` 와 그 row 타입이 코드에 없고, **마이그레이션 0014 파일은 수정되지 않았다** | `rg -n 'ProviderUsageReport' app/src` → **0건** · `git diff --stat` 에 `migrations/` **0파일** · `node --test scripts/check-migrations-appendonly.test.mjs` green | — |
| 10 | **가이드에 "SP API 를 주기적으로 부르기(cron)" 절이 있고**, ⓐ action 등록 위치(컴포지션 루트) ⓑ `Scheduler.register`/`schedule` API ⓒ cron 을 적는 두 층(설정 노출형 `Settings.scheduler` / 코어 고정형) ⓓ 잘못된 식은 등록 시 throw ⓔ in-app 발화 한계 ⓕ `ProviderApi.request` 호출부 ⓖ 다른 슬라이스에서의 포트 주입 — **7항목을 모두 서술한다** | `rg -n 'Scheduler.register\|applySettings\|assertValidCron\|ProviderApi.request\|intervalMs' docs/guides/closed-network-extensions.md` → 7항목 히트 | 배포 담당자가 주기 호출을 붙일 때 읽는 절차 정본 |
| 11 | **가이드의 코드 예제가 실제로 컴파일된다** — 예제를 실제 파일에 붙여 typecheck 를 통과시킨 뒤 되돌린다 | `npm run typecheck` 3/3 (0181 5단계-e · 0182 AC11 과 같은 절차) | 예제를 복사해 쓰는 구현자 |
| 12 | 가이드에 `Provider.usage`·"사용량 소스" 레시피 서술이 **없고**, §1.7 이 **삭제된 2파일을 인용하지 않는다** | `rg -n 'Provider\.usage\|사용량 소스\|usage-source' docs/guides/closed-network-extensions.md` → **0건** | 같은 문서를 읽는 배포 담당자 |
| 13 | 가이드 §9 트러블슈팅에 **주기 실행 3행**(잡이 안 뜬다 / 겹쳐 돈다 / 앱을 끄면 안 돈다)이 있다 | `rg -n 'cron\|스케줄\|skipped' docs/guides/closed-network-extensions.md` → §9 히트 | 막힌 개발자 |
| 14 | 구조 문서·인벤토리가 바뀐 구성과 일치한다 — contracts **5모듈**, `usage-source.ts`·`usage-specs.ts` 서술 0건, 0181 "소비 표면 4종" → **3종** | `rg -n 'usage-source\|usage-specs\|소비 표면 4종' docs app/AGENTS.md app/src/main/AGENTS.md --glob '!docs/handoff/**'` → **0건** | 구조를 읽으러 오는 에이전트 |
| 15 | 실기: 설정 → 사용량 → provider 서브탭에서 한도 바가 그려지고 동기화 버튼이 값을 갱신한다 | **사람 실기** — `npm run dev` 기동 → 설정 모달 → 사용량 → provider 선택 → 동기화 클릭 | 설정 모달 → `useProviderUsage` |

> AC15 의 실행 경로는 비범위에 막혀 있지 않다(설정 화면·훅·핸들러가 모두 범위 안). 다만 egress
> 차단 환경에서는 Electron ABI 재빌드가 막혀 `npm run dev` 가 불가하므로(0180 AC9 · 0181 AC13 ·
> 0182 AC15 선례) **사람/CI 몫으로 분리 보고**한다.

## 범위 / 비범위

- **범위**: `UsageSpec` 조인 취소 · 원격 사용량 경로 8파일 삭제 · bootstrap/context/cost 배선 정리 ·
  IPC 77→76 · shared 타입 축소 · renderer 정합 로직 제거 · **가이드 재작성(주기 호출 레시피)** ·
  구조 문서·인벤토리 동기화.
- **비범위**: `UsageTracker` 로컬 집계 · 사용량 통계(0112) · cron 주기값 자체 ·
  `features/providers/service/confluence/` (→ 아래) · 마이그레이션 0014 롤백.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| **`service/confluence/` 도 `declarations/` 밖의 SP 구체 구현이다** | **아니오** — 소비자가 있는 살아 있는 기능이고, 같은 잣대를 적용할지는 제품 결정이다. 사용자 정정은 **usage 를 지목**했으므로 이번엔 건드리지 않고 여기 기록만 남긴다 |
| DB 테이블 `provider_usage_report_cache` 물리 삭제 | **아니오** — 쓰는 코드가 없으면 고아 테이블은 무해하다. 지우려면 새 마이그레이션이 필요하고, append-only 규칙상 그것이 정상 경로다 |
| **삭제되는 타입 이름**(`UsageSpec`·`UsageSourcePort`·`ExternalUsageReport`) | **일방향이 아니다 — 지우는 방향이라 그렇다.** 소비자가 0이거나 이번에 함께 지워지므로 되돌릴 비용이 붙지 않는다(`Provider.usage` 선언 실측 0건) |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `UsageTracker`(로컬 집계) · `computeUsageLimits`(순수 파생, 유지) ·
  `Scheduler`(잡 2종 유지) · `ProviderApi`(가이드가 가리킬 대상) — **전부 이미 있다**.
- 전제: 현재 배포 중 `Provider.usage` 를 채운 선언이 없다(실측 0건) → 제거로 **깨지는 사용량 표시가
  없다**. 외부 리포트가 없는 지금도 UI 는 `effectiveLimit.source==='local'` 로만 렌더된다.
- **신규 의존성: 없음. 신규 모듈: 없음**(순삭제 + 배선 축소).

## 설계

**축**: r1 은 "조인을 줄이려면 어디에 모을까" 를 물었다. r2 는 **"이 배관이 있어야 하는가"** 를
묻고 아니라고 답한다. SP API 는 `ProviderApi` 로 어느 feature 에서든 부를 수 있으므로, 사용량은
*능력*이 아니라 *아직 필요하지 않은 기능*이다 — 필요해지면 그때 그 feature 안에 쓴다.

**제거 (8파일 + 계약 블록)**

| 대상 | 왜 |
|---|---|
| `contracts/provider.ts` 의 `UsageSpec`·`Provider.usage` | r1 이 만든 조인 자체 |
| `features/providers/usage-specs.ts`(+test) | 그 조인을 뽑는 순수부 |
| `features/usage/external-usage-service.ts`(+test) · `external-usage.ts` | 소스가 0이 되는 원격 조회·정합 엔진 |
| `contracts/usage-report.ts` · `contracts/usage-source.ts` | 그 엔진 전용 계약 (contracts **7모듈 → 5**) |
| `app/usage-source.ts` | `ProviderApi` → `UsageSourcePort` 어댑터 (포트가 사라지면 어댑터도 사라진다) |
| DB 접근자 2종 + row 타입 2종 | 쓰는 코드가 없다. **마이그레이션 파일은 건드리지 않는다**(append-only) |

**축소 (배선·계약)**

- `app/bootstrap.ts` — `usageSpecs` 블록 · `ExternalUsageService` 생성 · `createUsageSourcePort` ·
  `provider-usage-report-refresh` 등록/스케줄 · `RouterContext.externalUsage` 제거.
  `usage-recompute`(로컬 재계산, 0091)는 **유지**.
- `app/handlers/cost.ts` — 채널 1종 삭제. 나머지 둘은 로컬 3필드로 엔트리를 만든다:
  `{ providerKey, summary: ctx.cost.providerSummary(k), limitUsd: ctx.db.getProviderLimit(k) }`.
- `shared/ipc.ts` — `ProviderUsageEntry` 3필드로 축소 + `ExternalUsageReport`·
  `EffectiveUsageLimitView`·하위 타입 4종 제거 + 채널 상수 1개 제거.
- `shared/usage/limits.ts` — `computeProviderUsageLimits` 를
  `computeUsageLimits(entry.summary, entry.limitUsd)` 로 접고 0111 외부 정합 2함수 제거.
  **시그니처는 유지**해 호출부(도넛·설정) 2곳이 무변경으로 남는다.

**레이어 준수**: 순삭제라 새 의존이 생기지 않는다. `features/usage` 가 `contracts/usage-*` 를
잃지만 남는 모듈(`tracker`·`subscriber`·`usage-map`)은 `infra/db`·`shared` 만 본다 —
DAG 하향 유지. 신규 모듈이 없으므로 순수부 seam 을 새로 만들 것도 없다.

**문서 (사용자 결정 ⓒ — 산출물이지 부록이 아니다)**

가이드 `docs/guides/closed-network-extensions.md`:

| 절 | 조치 |
|---|---|
| §5-b (레시피 E — 사용량 소스 `Provider.usage`) | **삭제**하고 그 자리에 아래를 놓는다 |
| **새 §5-b — "SP API 를 주기적으로 부르기 (cron)"** | 다른 레시피와 같은 형식(단계 표 → 예제 → 필드/실수 표). 담을 것 7가지: ⓐ **위치** = action 은 컴포지션 루트(`app/bootstrap.ts`)가 등록(`features/scheduler` 는 무엇을 부를지 모른다 — 0091 교차 feature 회피) ⓑ **API** `register(key, action)` → `schedule(key, spec)`, `spec = {cron}\|{intervalMs}` + `enabled?` ⓒ **cron 을 적는 두 층** — 설정 노출형(`Settings.scheduler.<job>` → `applySettings`, 선례 `usage-recompute`·`update-check`) / 코어 고정형 ⓓ 잘못된 식은 **등록 시 throw** ⓔ **in-app 스케줄러** — 앱이 떠 있을 때만 발화, 겹침은 `skipped` 기록, 종료 시 `stopAll()` 이 `closeDb` 앞 ⓕ action 안에서 **`ProviderApi.request`**(origin 상대 경로 · 미인증은 정상 상태로 접기 · `AbortController` 는 호출자 몫) ⓖ **다른 슬라이스에서 부를 때** `contracts/` 좁힌 포트 + 컴포지션 루트 주입 |
| §1.7 소비자 표 | "다른 feature 슬라이스" 행이 **삭제될 2파일을 선례로 인용** 중 → 죽은 좌표를 지우고 *패턴만* 서술, **현재 살아 있는 선례가 없음을 명시**하고 새 §5-b 로 링크 |
| §9 트러블슈팅 | 주기 실행 3행 추가 |

## 기존 결정·규칙과의 관계

> 본문(§설계·§파생 UX·§범위)을 다 쓴 뒤 훑으며 채웠다.

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **r1 의 `Provider.usage` 축** ("선언한 provider 가 곧 호출 대상") | r1 plan §설계 · `contracts/provider.ts:189-210` 주석 | §설계 "제거 — r1 이 만든 조인 자체" | **뒤집는다** — 사용자 정정. 슬롯을 옮기는 것이 아니라 없앤다 |
| **0176 `UsageSourcePort`** — "connector 를 usage provider 에 매달지 않는다" 는 계약 | `contracts/usage-source.ts:1-20` 헤더 주석 | §설계 "포트가 사라지면 어댑터도 사라진다" | **뒤집는다** — 계약이 보호하던 소비자(정적 모듈·`UsageSpec`)가 둘 다 사라져 보호 대상이 없다 |
| **0111 외부 quota 권위 정합**(external·fresh 스케일 / stale 바닥값) | `shared/usage/limits.ts:24-34` 주석 · 0111 plan | §설계 "0111 외부 정합 2함수 제거" | **뒤집는다** — 외부 리포트를 만드는 경로가 없어 `source==='external'` 이 도달 불가 분기가 된다. 되살리려면 그때 리포트 생산자와 함께 되살린다 |
| **배포가 고치는 파일은 `declarations/` 셋뿐** | `docs/arch/backend/providers.md` · 가이드 §1.1 | §Context "플러그인 슬롯성 배관이 남지 않는다" | **강화한다** — 사용량이 선언에도 들어가지 않으므로 선언 스키마가 더 작아진다 |
| `features/usage` 는 `features/providers` 를 import 하지 않는다 | `app/src/main/AGENTS.md` §feature 수직 슬라이스 | §설계 "레이어 준수 — 순삭제라 새 의존이 생기지 않는다" | **유지** |
| **머지된 마이그레이션 수정 금지**(기계 강제) | `scripts/check-migrations-appendonly.mjs` · `app/AGENTS.md` §DB | §설계 "마이그레이션 파일은 건드리지 않는다" · AC9 | **유지** — 테이블은 고아로 남긴다 |
| `npm test` 는 ABI 를 Node 로 뒤집으므로 게이트로 쓰지 않는다 | `app/AGENTS.md` §ABI 가이드 | §게이트 | **유지** — `./node_modules/.bin/vitest run` |
| 새 howto 문서 신설 금지, 기존 가이드 재구성 | 0181 5단계-e (사용자 결정) · 0182 §기존 결정 | §설계 문서 표 "가이드 §5-b 자리에 놓는다" | **유지** |
| IPC 채널 변경은 `IPC_CONTRACT.md` 동시 갱신 | `docs/AGENTS.md` §6 · `ipc-documentation.test.ts` | AC5 | **유지** — 76 으로 코드·문서·테스트 3곳 동시 |

## 파생 UX / 엣지케이스

- **동기화 버튼**: 외부 새로고침이 사라져도 버튼은 남는다 — `providerSummaries` 재조회로 로컬
  집계를 갱신한다. 라벨의 시각은 `entry.summary.updatedAt`(외부 `fetchedAt` 폴백이 사라짐).
- **한도 바**: 지금도 외부 리포트가 0건이라 `source==='local'` 경로만 그려진다 → **화면 변화 없음**.
- **재시작·오프라인**: 원격 호출이 없어져 `not_connected`·stale 상태 자체가 사라진다. 사용량은
  DB 로컬 집계라 네트워크와 무관하게 항상 표시된다.
- **부팅**: cron 잡이 3종 → 2종. `provider-usage-report-refresh` 의 `schedule_runs` 과거 행은
  남지만 새 행이 생기지 않는다(이력 조회 UI 없음 — 무해).
- **고아 테이블**: `provider_usage_report_cache` 는 남되 read/write 가 0이다. 기존 사용자 DB 의
  행도 그대로 남으며 읽히지 않는다.

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 삭제 규모가 크다(**863줄 + 계약/타입 블록**) | 소비자를 전수 `rg` 로 확인했고(§자료조사 N 수치), AC2·AC6·AC9 가 잔재 0을 기계 검사한다. typecheck 3분할이 호출부 누락을 강제로 드러낸다 |
| 폐쇄망 배포가 나중에 사용량을 원하면 **처음부터 써야 한다** | 그것이 요구다(전용 슬롯 폐지). 대신 **가이드 §5-b 가 어떻게 쓰는지 단계별로 답한다**(AC10~13) — 사라지는 것은 슬롯이지 능력이 아니다 |
| 0111 의 외부 정합 로직(설계 노동 50줄)이 사라진다 | 도달 불가 분기였다(리포트 생산자 0). 되살릴 때는 생산자와 **한 세트로** 되살린다 — plan 이력(0111·이 문서)이 좌표를 남긴다 |
| 문서를 나중으로 미루면 이번에도 정본이 구 동작을 서술하게 된다(0181 5단계-e 의 실패) | **문서를 인수 기준 안에 뒀다**(AC10~14) + 예제를 컴파일해 검증(AC11) |

- 되돌리기 어려운 결정: **없다.** 지우는 방향이고 소비자가 0이라 개명·마이그레이션 비용이 없다.
  유일한 비가역은 마이그레이션 0014 인데 **건드리지 않는다**.
- **단독 결정 금지(Open Question)**: 없음(전부 이번 세션에서 결정받았다).

## 영향 받는 파일

- `app/src/main/contracts/provider.ts` · `contracts/usage-report.ts`(삭제) · `contracts/usage-source.ts`(삭제)
- `app/src/main/features/providers/usage-specs.ts`(+test, 삭제)
- `app/src/main/features/usage/external-usage-service.ts`(+test, 삭제) · `external-usage.ts`(삭제)
- `app/src/main/app/usage-source.ts`(삭제) · `app/bootstrap.ts` · `app/context.ts` ·
  `app/handlers/cost.ts` · `app/handlers/misc-split.test.ts`
- `app/src/main/infra/db/{queries.ts,types.ts}`
- `app/src/shared/{ipc.ts,protocol.ts,ipc-documentation.test.ts}` · `app/src/shared/usage/limits.ts`(+test)
- `app/src/preload/index.ts` · `app/src/renderer/src/shared/api/ipc.ts` ·
  `features/cost/hooks/useProviderUsage.ts` · `features/settings/components/ProviderUsageTab.tsx`
- `docs/guides/closed-network-extensions.md`(§1.7·§5-b·§9) · `docs/IPC_CONTRACT.md` ·
  `docs/AGENTS.md` · `docs/guides/AGENTS.md` · `docs/arch/backend/{overview,providers,standardization,security}.md` ·
  `app/AGENTS.md` · `app/src/main/AGENTS.md` · `docs/PHASES.md`

## 참고 문서

- `docs/arch/backend/providers.md` — provider 플랫폼 구조 정본
- `docs/guides/closed-network-extensions.md` — 절차 정본(이번 산출물의 절반)
- `docs/IPC_CONTRACT.md` §6 — 채널 변경 절차(**동시 갱신**)
- `app/AGENTS.md` §ABI 가이드 — 게이트 명령 선택

## 게이트

- `cd app && npm run lint && npm run typecheck` (ABI 중립)
- `./node_modules/.bin/vitest run` (`npm test` 금지 — ABI 를 Node 로 뒤집는다)
- 신규 테스트 요구: **없다**(순삭제). 기존 테스트 조정 3건 — `ipc-documentation`(77→76) ·
  `limits.test`(외부 정합 케이스 제거) · `misc-split.test`(컨텍스트 스텁).
- 잔재 검사: `rg -n 'UsageSpec|usage-specs|ExternalUsageService|UsageSourcePort|usage-source|external-usage|ExternalUsageReport|externalReport|effectiveLimit|refreshProviderUsageReport|provider-usage-report-refresh' app/src` → **0건**

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 정정 문장을 **원문 그대로** 인용하고 결정 3건(ⓐⓑⓒ)을 출처와 함께 적었다. 추론은 추론으로 표기
- [x] 자료조사 — 발견마다 명령 또는 `파일:라인`. 미종결 항목 없음
- [x] 의존 기술 — 신규 의존성 0 · 신규 모듈 0. 유지할 모듈을 이름으로 지목
- [x] 파생 UX — 동기화 버튼·한도 바·오프라인·부팅 잡 수·고아 테이블
- [x] 리스크 — 되돌리기 어려운 결정 **없음**을 근거와 함께 단언(소비자 실측 0건)
- [x] **요구 비판적 검토** 5질문 답변. r1 자기 진단의 부풀림을 근거에서 제외. 범위를 줄이지 않았다
- [x] `검증 수단` 칸 **15/15 채움**. AC15 만 "사람 실기" + 실행 경로 명시
- [x] 부정형/"불변" 기준 **0개** — AC1·AC2·AC6 는 "…없다" 지만 **`rg` 0건이라는 측정 가능한 양성 단언**이다(존재 검사의 결과값)
- [x] AC 간 모순 확인 — AC7(동기화 동작)과 AC6(채널 제거)은 §자료조사의 "이미 폴백 분기가 있다" 로 **양립**. AC9(테이블 유지)와 AC2(파일 삭제)는 대상이 다르다(마이그레이션 vs 소스)
- [x] 인용 수치를 이번 세션에서 직접 측정 — 선언 사용 0건 · 소비자 N=1/3/2/4 · 삭제 863줄 · 채널 77 · 문서 인용 2곳
- [x] 신규 모듈 0 → 테스트 방법 항목 해당 없음. **기존 테스트를 인용한 AC 는 존재를 확인**했다(P33) — `misc-split.test.ts:67`·`limits.test.ts:74~120`·`ipc-documentation.test.ts:9`
- [x] 전수 조사에 N 수치 있음
- [x] 각 AC 에 프로덕션 도달 경로 있음. **유일한 호출자가 테스트인 AC 0개** — 삭제 AC 는 도달 경로가 "—"(제거가 목적)이고, 남는 동작 AC(4·7·8·15)는 화면 경로를 명시
- [x] 선택적 필드 판정 없음(제거 작업) → 미지정 케이스 AC 해당 없음
- [x] 소비 계약의 제약 필드 — 이번에 *추가하는* 계약이 없다. 대신 **삭제하는 계약의 소비자를 전수 확인**했다
- [x] 참조 구현 입력 없음(r1 코드가 입력이지만 **취소 대상**이지 모방 대상이 아니다)
- [x] 미룬 항목마다 일방향 여부 답변 — confluence·DB 테이블·타입 이름 3행
- [x] **관문 4 를 본문 완성 후 실행** — 기존 결정 표 9행을 본문 문장 기준으로 채웠고, 인용 경로를 `rg`/`wc` 로 확인. `[구현자 기입]`·`[검증자 기입]` 블록 유지
- [x] "확정돼 있다" 류 서술의 앵커 확인 — `app/AGENTS.md` §ABI 가이드 · `src/main/AGENTS.md` §feature 수직 슬라이스 · 가이드 §1.1/§1.7 을 각각 열어 존재 확인

---

> **[구현자 기입] r2** — 이번 라운드의 구현 기록. r1 기록은 그 아래 이력으로 보존한다.

## [구현자 기입] 설계 리뷰 (비판적) — r2

## [구현자 기입] 놓친 잠재 문제 + 대응 — r2

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|

## [구현자 기입] 구현 체크리스트 — r2

- [ ] `UsageSpec`·`Provider.usage` 제거 + `usage-specs` 삭제
- [ ] 원격 경로 6파일 삭제 + bootstrap·context·cost 배선 축소
- [ ] DB 접근자·row 타입 제거 (마이그레이션 무수정)
- [ ] IPC 76 + shared 타입 축소 + preload/renderer api
- [ ] renderer — `limits.ts` 축소 · `ProviderUsageTab` · `useProviderUsage`
- [ ] 가이드 §5-b 재작성(주기 호출) · §1.7 정정 · §9 3행 · 예제 컴파일 검증
- [ ] 구조 문서·인벤토리 동기화

## [구현자 기입] 구현 보고 — r2

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

---

> **[이력] r1 (2026-08-10) — 취소됨.** 아래는 요구를 오독한 라운드의 기록이다. 설계 상단은 r2 로
> 대체됐고, r1 이 만든 `Provider.usage`·`usage-specs.ts` 는 r2 가 제거한다. **r1 이 지운 것**
> (`providers/static/` 7파일 · `http-usage-report` · `usage-feed` · `UsageReportConfig` ·
> `createSecretFacade`)은 요구와 일치하므로 **되살리지 않는다**.

## [구현자 기입] 설계 리뷰 (비판적) — r1

구현 주체 = **Claude**(비기능 = 구조 정리). 설계대로 진행했고 이견 없음. 다만 아래 3건은 설계가
덜 적었다(전부 구현 세부라 선조치).

## [구현자 기입] 놓친 잠재 문제 + 대응 — r1

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **`UsageSpecEntry` 를 어디에 두는지 설계가 안 적었다.** `features/usage` 가 `features/providers` 를 import 할 수 없어 타입을 그쪽에서 가져올 수 없다 | ✅ `external-usage-service.ts` 에 **구조적으로** 선언하고 컴포지션 루트가 `usageSpecs()` 결과를 그 형상으로 넘긴다 | 슬라이스 교차 금지(`src/main/AGENTS.md`) |
| 2 | **`UsageFeed`·표본 dedupe 의 존재 이유가 사라졌다** — 두 provider 가 같은 `(source, operation)` 을 구독하던 상황이 없어졌다(호출 대상 = 선언 주체) | ✅ `usage-feed.ts`(+test) 삭제. providerKey 단위 in-flight 병합만 남긴다 | 회귀 테스트로 "틱이 겹쳐도 호출 1회" 고정 |
| 3 | **`standardization.md` 가 `static/modules` opt-in 절차를 서술**하고 있었다(설계의 문서 목록에 없었다) | ✅ 선언 기반으로 재작성 | `rg 'static/modules'` |

## [구현자 기입] 구현 보고 — r1

| 항목 | 내용 |
|---|---|
| 삭제 | `features/providers/static/`(7파일) · `http-usage-report.ts`(+test) · `usage-feed.ts`(+test) · `UsageReportConfig`(shared/ipc) · `createSecretFacade` · `StaticUsageProviderModule`·`ExternalUsageContext`·`ExternalUsageProvider` |
| 신설 | `features/providers/usage-specs.ts`(+test) · `contracts/provider.ts` `UsageSpec` **← r2 가 취소** |
| 변경 | `external-usage-service.ts`(3경로 → 1) · `contracts/usage-report.ts`(60 → 27줄) · `bootstrap.ts` · 문서 6 |
| 게이트 | lint **0 error/1 warn** · typecheck **3/3** · vitest **193 파일(188/5) · 1,697 테스트(1,658/39)** |
| 신규 red | **0** — 실패 5파일이 DB ABI 베이스라인과 동일(39건) |
| 조인 | **2개 → 0개**. 배포가 고치는 파일 **3곳 → 1곳** ← *이 성과 서술이 요구 오독의 산물이다(§요구 비판적 검토)* |
| 대상 커밋 | `87c23b7` |

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | **r1 이 "제거" 요구를 "선언으로 이동" 으로 오독**했다. 요구의 조건절("다른 feature 에서 SP 의 api 를 사용할 수 있다면")이 이미 대안을 지정하고 있었는데 배경으로 읽었다 | 사용자 정정 (2026-08-11) | r2 로 전면 재설계 — 조인 취소 + 원격 경로 제거 | **해결 중 (r2)** |
| D2 | 같은 잣대를 `service/confluence/`(= `declarations/` 밖의 SP 구체 구현)에도 적용할 것인가 | r2 설계 중 발견 | 제품 결정 사항 — 사용자에게 확인 후 별도 핸드오프 | open |
