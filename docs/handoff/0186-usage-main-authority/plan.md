# Plan — 0186-usage-main-authority

## 메타

| 항목 | 값 |
|---|---|
| slug | `0186-usage-main-authority` |
| 작성자 | Claude Code |
| 일자 | 2026-08-12 |
| 매핑 | 0183 후속 (사용자 제시 경량화 명세 + 리뷰 2회전) |
| 상태 | DRAFT → **READY** |
| 구현 주체 | **Claude** (환경에 Codex 부재 · 사용자 지시 — 0160·0162·0163·0176·0179·0180 선례) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "사용량 추적 기능을 만들려고 한다. 이전 구현이 파편화돼 상당부분 제거된 상태다. 새로운 구조를 제안하고 타당성 검토를 하라 (도입은 확정)" | 라이브 세션 (2026-08-12) + 첨부 `orca_llm_usage_tracking_lightweight.md` |
| 명시 요구 ② | "fetcher 는 폐쇄망에서 직접 구현할 예정 (주기적 호출 형태)" | 같은 세션 |
| 명시 요구 ③ | 경량화 보완 명세 v4 — "기존 DB와 검증된 기능은 유지하면서, 중복 orchestration·Renderer 계산·불필요 IPC·중복 상태만 제거한다" | 첨부 `orca_usage_tracking_lightweight_final_v4.md` |
| 명시 요구 ④ | 설계 리뷰 — P0 5건 + R1·R2. "기존 코드 재사용 자체를 선으로 보지 않는다. 계약이 맞을 때만 재사용한다" | 첨부 `orca_usage_tracking_0186_review_revised1.md` |
| 사용자 결정 U1 | **DB 무변경** — "데이터는 기존의 정책을 그대로 따르고, sw 구조만 첨부가이드대로 달라지는건데?" → 마이그레이션 0건 확정 | AskUserQuestion (2026-08-12) |
| 사용자 결정 U2 | "로컬 db를 사용하기때문에 pc마다 사용량이 다른것은 어쩔수가 없다. 그래서 로컬 db 한정이라는 안내를 하고있다(orca 한정)" | 같은 세션 |
| 사용자 결정 U5 | "월간한도는 사용자가 임의수정 가능하다. 마지막 업데이트일을 기준하여 sdk 반환값을 그 위에 얹는다. 단 fetcher가 다시 정상동작하면 그것을 정본으로 리라이트 한다" | 같은 세션 |
| 사용자 결정 U6 | "월간한도를 사용자가 변경할 수 있으나 fetcher를 통한 외부 사용량 추적시, fetch값이 정본이 된다" | 같은 세션 |
| 사용자 결정 U10 | "composer가 보여주는 기준은 항상 텔레메트리가 업데이트 되는 시점이다" | 같은 세션 |
| 사용자 결정 (D1·D3·D4) | 리뷰 항목별 "동의". D2(토큰 기준 안내)는 "추후 고려, 현행유지" | 같은 세션 |
| 추론 의도 | 요구 ①의 목적은 *기능을 새로 만드는 것*이 아니라 **중복 경로를 걷어내고 optional fetcher 자리를 여는 것**이다 (추론. 근거 = 조사 결과 명세 요소 10개 중 6개가 이미 구현돼 있었고, 사용자가 v4 에서 "기능 축소는 비목표"를 명시했다) |

## Context (왜)

사용량 추적은 **이미 동작 중**이다. 0183 r2 가 제거한 것은 원격 조회 경로 하나였다. 조사 결과
남은 실제 문제는 기능 부재가 아니라 **중복 경로** 셋이다:

1. 턴이 끝날 때마다 Renderer 가 Main 에 provider 집계를 **다시 요청**한다
   (`useProviderUsageLimits.ts:21,34` 가 `costStore.lastUpdatedAt` 을 deps 로 재조회).
2. 주/월 한도 파생이 **Renderer 에서** 일어난다 — 정본이 Main 에 없다.
3. `features/cost` 에 같은 일을 하는 hook 이 3개다.

의도한 결과: ⓐ 정본(`UsageLimitsView`)을 Main 이 만들고 Renderer 는 mirror 만 한다 ⓑ 턴당 IPC
왕복이 3회 → 1회(delta push)로 준다 ⓒ optional fetcher 가 붙을 자리가 열린다 — **선언 슬롯이
아니라 평범한 코드로**(0183 결정 유지) ⓓ 고아 테이블 `provider_usage_report_cache` 가 세입자를
되찾는다. **DB 는 손대지 않는다.**

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **전제 정정 → 요구 재조준.** 최초 명세는 "기능이 제거됐으니 새로 만들자" 였으나, 실제로는 명세 요소 10개 중 **6개가 이미 구현돼 동작 중**이었다. 사용자가 v4 로 요구를 *중복 제거*로 재조준했고 그것이 실제 문제와 맞는다 | 대조 실측 — `features/usage/{subscriber,tracker,usage-map}.ts` · `shared/usage/limits.ts` · `UsagePanel.tsx` · `UsageTab.tsx` · cron `usage-recompute` 전부 생존 |
| 이미 있는 것 아닌가 | **상당 부분 있다 — 그래서 신규 파일을 3개로 묶었다.** 최초 명세대로 `UsageService`+`usage_events` 를 만들었다면 `UsageTracker`+`turn_usage` 와 이중 원장이 됐다 | `rg` 실측 (§자료조사 1~6행) |
| 더 작은 해법이 있는가 | **있고, 채택했다.** 최초 안(신규 테이블 + 신규 서비스 클래스)을 버리고 기존 tracker 확장 + 순수 모듈 1개로 접었다. 리뷰 R2 에 따라 `usage-snapshot.ts` mapper 도 코어에서 뺐다 | 리뷰 §7 "만들지 않는 파일" |
| 인용 자료가 요구를 부풀리지 않았나 | **최초 명세가 부풀렸다.** §10 이 경계한 과잉 계층(Writer/Reader/Repository/Reconciler)은 이 저장소가 겪은 적 없는 문제다 — 실제로 겪은 것은 *선언 슬롯 + 문자열 조인*(0183)이고 이미 해소됐다. 근거에서 제외한다 | 0183 plan §설계 |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다.** 0183 이 금지한 것은 *선언 슬롯*(`Provider.usage`)이지 *원격 조회 능력*이 아니다. 이번 설계는 가이드 §5-b 가 지시하는 경로 그대로다 | `contracts/provider.ts:214-217` 주석 · `closed-network-extensions.md §5-b` |

- **사용자에게 올릴 것**: 없음. U1·U2·U5·U6·U7·U8·U9·U10 및 리뷰 D1/D3/D4/F 를 모두 세션에서
  결정받았다. 남은 미결은 OQ1(사내 endpoint 실값·watermark 의미) 하나이며 **착수를 막지 않는다**
  — `baselineUsable` fail-closed 로 파라미터화한다.

## 자료조사 (Research)

> 모든 수치는 이번 세션에서 직접 측정했다 (승계 0건).

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `features/cost` 프로덕션 파일 **6개** — `index.ts`·`CostProvider.tsx`·`store/costStore.ts`·`hooks/{useUsageLimits,useProviderUsage,useProviderUsageLimits}.ts` | `find src/renderer/src/features/cost -name '*.ts*' ! -name '*.test.*'` → **6** |
| **턴마다 Renderer→Main 재조회 왕복이 실재한다** — 전역 summary push 가 `lastUpdatedAt` 을 올리고, 그것이 provider 재조회 effect 를 깨운다 | `features/cost/hooks/useProviderUsageLimits.ts:21,34` |
| `spendingLimitUsd` 의 **persistence 는 Main SettingsStore** 다. renderer Tweak 은 그 미러 | `src/shared/protocol.ts:525` (`SettingsSchema`) · `renderer/src/shared/hooks/useTweaks.ts:56` |
| `shared/usage/limits.ts` 는 **순수 TS** (타입 + `shared/time/*` 만 import) → main DAG 가 `shared` 를 허용하므로 Main 에서 실행 가능 | `src/shared/usage/limits.ts:1-8` · `app/src/main/AGENTS.md` §레이어 DAG |
| 턴에 **`providerKey` 가 이미 있다** | `src/main/contracts/turn.ts:13` |
| **R1 — `sumUsageByBoundariesForProvider` 의 WHERE 하한을 `as_of` 로 올리면 `week` 가 깨진다.** 이 쿼리는 `WHERE tu.created_at >= @monthStart` 로 스캔 범위를 정하고 그 안에서 day/week/month 를 조건부 SUM 한다 | `src/main/infra/db/queries.ts:287-310` |
| **P0-5 — `register()` 는 타이머를 만들지 않는다.** bootstrap 에 `schedule()` **직접 호출 0건**이고 `applySettings()` 가 `usage-recompute`·`update-check` 2개만 schedule 한다 → **코어 고정형 잡의 선례가 코드에 없다** | `rg 'scheduler\.(register\|schedule\|applySettings)' src/main/app/bootstrap.ts` → register 2 · applySettings 1 · **schedule 0** · `features/scheduler/scheduler.ts:61-72` |
| `usageRecompute.enabled` **기본값이 `false`** — 경계 갱신을 이 잡에 의존할 수 없다 | `src/shared/protocol.ts:460-463` |
| **좌표 조인 함수가 이미 있다** — `llmProviderKey(provider)` = `providerKeyOf(llm.adapter, llm.provider)`, `findLlmProvider(declarations, providerKey)` | `src/main/features/providers/llm/index.ts:19,23` |
| **telemetry 이벤트에 providerKey 가 없다** (`{type,sessionId,usage?}`). 그러나 renderer 는 **이미 `turnProviderKey`(0119)** 를 갖는다 — `BEGIN_TURN` 에서 `state.providerKey` 를 고정하고 턴 종료에 초기화 | `src/shared/ipc.ts:548-552` · `renderer/src/features/chat/reducer/chatReducer.ts:314-316` |
| renderer boundaries 는 `features → shared` 와 `features → 같은 feature` **만** 허용 → `features/settings` 가 `features/cost` 를 읽으면 lint error. `shared/stores/agentStore.ts` 가 공유 미러 스토어의 선례다 | `app/eslint.config.mjs:88-95` · `renderer/src/shared/stores/agentStore.ts` |
| 현재 settings→cost 교차는 **구조적 인터페이스 + app 주입**으로 우회 중 | `features/settings/components/SettingsModal.tsx:25,37` · `app/SidebarUserButton.tsx:42,138` |
| `provider_usage_report_cache`(0014) 프로덕션 접근자 **0개** — `migrate.ts:41` 등록 + 테스트 fixture import 4곳 + 문서뿐 | `rg 'provider_usage_report_cache\|getProviderUsageReport\|upsertProviderUsageReport' src/` |
| 마이그레이션 append-only 는 **기계 강제** — 파일 집합 ↔ `migrate.ts` import 일치 + 0001 부터 번호 연속 + 태그 이후 수정/삭제 금지 | `app/scripts/check-migrations-appendonly.mjs:13-16` |
| 채널 수는 **하드코딩되어 있지 않다** — 테스트가 `CHANNELS` 실측을 `docs/generated/inventory.md` 와 대조한다 | `src/shared/ipc-documentation.test.ts:23-30` |
| 조회류 IPC 의 실패 정책 규약 = `{ fallback }`, 쓰기류 = `'reject'` | `src/main/infra/ipc/handle.ts:23-25` |
| 문서 드리프트 2건 (0183 r2 가 놓침) — 삭제된 `effectiveLimit`·고아 테이블을 현재형으로 서술 | `docs/IPC_CONTRACT.md:269` · `docs/arch/backend/persistence.md:70` |
| 다음 핸드오프 번호는 **0186** — INDEX 최대는 0183 이나 `docs/handoff/` 디스크와 `archive/handoffs/INDEX-history.md` 에 0184·0185(둘 다 PASS)가 있다 | `ls docs/handoff/` · `docs/archive/handoffs/INDEX-history.md` |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 턴 종료 시 **global 집계 1회 + 해당 provider 집계 1회**만 수행된다 (provider 목록 스캔 0회) | `features/usage/subscriber.test.ts::"영향받은 provider 만 재집계한다"` — fake db 호출 횟수 단언 | `bootstrap.ts` 버스 구독 → `recordTurnUsage` → `tracker.recordAndBroadcast(providerKey)` |
| 2 | renderer 의 사용량 상태 모듈이 **`usage`·`setProviderLimit` 두 채널만** 부르고, 삭제된 hook 3개가 저장소에 없다 | `rg "costApi\." src/renderer/src/shared/stores/usageStore.ts` → 2종 + `ls` 3경로 부재 | Composer 도넛 · 설정 사용량 탭 |
| 3 | `as_of` 가 이번 주 안이어도 **`week.used` 가 온전하다**, 그리고 같은 행에서 `monthDelta` 를 얻는다 (R1) | `infra/db/queries.test.ts::"as_of 가 이번 주 안이어도 week 가 온전하다"` | `getProviderUsage` → `sumUsageByBoundariesForProvider` |
| 4 | `baselineUsable:true` + `as_of ∈ 이번 달` 이면 `month.used = 기준선 + as_of 이후 로컬 증분` 이고 `month.source === 'remote-baseline'` | `features/usage/usage-compose.test.ts::"기준선에 증분을 얹는다"` | `cost:usage` → `getProviderUsage` → `composeProviderUsage` |
| 5 | **`baselineUsable` 미지정이면 기준선을 쓰지 않는다** (fail-closed) | `usage-compose.test.ts::"baselineUsable 미지정은 local 로 접힌다"` | 동상 |
| 6 | `as_of` 가 지난달이면 기준선을 버리고 `month.source === 'local'` 이 된다 (U9) | `usage-compose.test.ts::"월 경계 밖 기준선은 폐기한다"` | 동상 |
| 7 | 기준선을 못 써도 **`month.budget` 은 원격 한도**를 쓴다 (U6) | `usage-compose.test.ts::"기준선 없이 한도만 원격을 쓴다"` | 설정 → 사용량 → provider 서브탭 |
| 8 | `week.source` 가 **항상 `'local'`** 이다 (U7) | `usage-compose.test.ts::"주간은 언제나 로컬이다"` | 도넛 팝오버 |
| 9 | 전역(providerKey 없음) 조회는 원격을 보지 않고 `spendingLimitUsd` 로 파생한다 | `usage-compose.test.ts::"전역은 원격을 보지 않는다"` | `cost:usage` (payload `{}`) |
| 10 | `refresh` 전후로 `turn_usage`·`turn_model_usage` **행 수가 같다** (원본 보존) | `features/usage/tracker.test.ts::"원격 갱신이 로컬 원장을 건드리지 않는다"` | cron `usage-fetch` → `tracker.refreshProvider` |
| 11 | fetcher **미주입**이면 `usage-fetch` 가 register·schedule **어느 쪽도 호출되지 않고**, 사용량 조회가 로컬로 성립한다 | `app/usage-wiring.test.ts::"fetcher 미주입이면 usage-fetch 잡이 없다"` — fake Scheduler 의 `register`·`schedule` 인자 양쪽 단언 | `Bootstrap.start()` |
| 12 | `usage-boundary` 가 **`schedule('usage-boundary', {cron:'0 0 * * *'})` 까지 호출**된다 — `register` 만으로는 통과하지 않는다 (P0-5) | `app/usage-wiring.test.ts::"경계 잡은 schedule 까지 된다"` | `Bootstrap.start()` → `Scheduler` |
| 13 | 좌표 조인이 **기존 `findLlmProvider` 를 쓴다** (신규 파생 구현 0) | `rg "findLlmProvider" src/main/app/` → 1건 이상 · `rg "providerKeyOf" src/main/app/` → **0건** | fetcher 주입 |
| 14 | 0014 왕복(upsert → read)이 실제 DB 에서 성립한다 → 고아 해소 | `infra/db/queries.test.ts::"provider usage report 왕복"` | `tracker.refreshProvider` |
| 15 | 마이그레이션 파일이 **16개로 불변**이고 append-only 가드가 통과한다 | `node scripts/check-migrations-appendonly.mjs` exit 0 + `infra/db/migrate.test.ts` | CI 게이트 |
| 16 | `CHANNELS` 실측과 `docs/generated/inventory.md` 의 채널 수가 일치한다 (5→4 반영) | `src/shared/ipc-documentation.test.ts` | `CHANNELS` ↔ 생성물 |
| 17 | telemetry 가 도착하면 그 시점의 provider 가 `lastTelemetryProviderKey` 로 굳고, **provider 선택만 바꿔서는 바뀌지 않는다** (U10) | `renderer/.../chatReducer.usage.test.ts::"telemetry 시점 provider 를 굳힌다"` + `::"SET_MODEL 은 굳은 값을 바꾸지 않는다"` | `ChatPage` → `usageStore.providers[lastTelemetryProviderKey]` |
| 18 | ko/en i18n 리프 키 집합이 일치하고 빈 값이 없다 (§4-e 신규 키 포함) | `renderer/src/shared/i18n/resources.test.ts` | 설정 provider 서브탭 |
| 19 | 자정을 넘겨도 주/월 바가 새 기간을 반영한다 | **사람 실기** — `npm run dev` 로 기동 → OS 시각을 자정 너머로 변경 → 도넛 팝오버 확인 | GUI |
| 20 | 모델을 전환하고 새 턴 없이 도넛을 열면 주/월 값이 유지된다 | **사람 실기** — `npm run dev` → Composer 모델 전환 → 도넛 열기 | GUI |

> AC19·AC20 의 실행 경로(`npm run dev` + GUI)는 이 작업의 비범위에 막혀 있지 않다 — renderer·
> Composer 모두 범위 안이다. 다만 egress 차단 환경에서는 Electron ABI 재빌드가 막혀 에이전트가
> 직접 수행할 수 없다 (0019·0102·0180 AC9 선례).

## 범위 / 비범위

- **범위**: Main 정본화(`UsageLimitsView` 조립) · affected-provider 재집계 · IPC 5→4 ·
  renderer mirror 이설 + hook 3 삭제 · `chatReducer` provider 고정 · optional fetcher 포트 +
  cron 2잡 · 0014 접근자 복원 · 문서 5건.
- **비범위**: 실 사내 endpoint 구현(배포 소유) · `usage-recompute` 설정 키 제거 ·
  0014 물리 삭제 · 토큰 지표의 기준 안내 문구(U8, 추후) · 주간 원격 기준선(U7).

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 실 endpoint·응답 매핑 | 아니오 — `baselineUsable` fail-closed 로 파라미터화했고, 배포가 `fetcher.ts` 포트를 구현하면 코어 수정 없이 붙는다 |
| `usage-recompute` 설정 키 제거 | 아니오 — 되돌릴 수 있음. **지금 하면 오히려 비싸다**: 설정 키 삭제는 `infra/settings-migration.ts` 를 부르고 이번 작업의 스키마 무변경 기조를 깬다 |
| 0014 물리 삭제 | 아니오 — 이번에 세입자를 되찾으므로 삭제 자체가 불필요해진다 |
| 주간 원격 기준선 | 아니오 — `report_json` 이 원본을 보존하므로 원격이 주간을 주는 배포가 생기면 그때 스칼라를 늘린다 |
| **`source` 필드 어휘 (`'local' \| 'remote-baseline'`)** | **예 — 일방향에 가깝다.** IPC 로 나가는 공개 계약이라 나중 개명이 renderer 와 함께 움직여야 한다. → **지금 확정한다**(리뷰 §4 권고 채택. `'remote'` 는 "used 전체가 원격" 을 함의해 부정확하므로 쓰지 않는다) |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `shared/usage/limits.ts`(순수 파생) · `shared/time/clock.ts`(경계) ·
  `features/providers/llm/index.ts`(`llmProviderKey`·`findLlmProvider`) ·
  `features/scheduler`(croner) · `infra/ipc/{handle,send}` · `contracts/provider.ts`(`ProviderApi`) ·
  `renderer/src/shared/stores/agentStore.ts`(공유 미러 스토어 선례).
- 전제: `spendingLimitUsd` 는 Main SettingsStore 가 소유하고 메모리 캐시라 hot path 에서 disk
  read 가 없다(§자료조사 3행).
- **신규 의존성 0** — TRD §2 Stack 표 밖 패키지를 추가하지 않는다.
- IPC 채널 **수가 바뀐다**(5→4) → `docs/IPC_CONTRACT.md` + `docs/generated/inventory.md` 동시 갱신.

## 설계

### 의미 계약 (P0-1 해소 — U2 와 U5 를 화해시킨다)

```
Local Ledger   : 항상 이 PC 의 Orca 사용량만 기록. 어떤 경우에도 수정·삭제하지 않는다.

Global Usage   : week = local · month = local · budget = spendingLimitUsd

Provider Usage : week   = 항상 local                                   (U7)
                 month  = 기준선 사용 가능 ? 계정 기준선 + as_of 이후 이 PC 증분 : local
                 budget = quota_limit_usd ?? provider_limits.limit_usd  (U6 — fetch 우선)
```

`month.used` 는 기준선이 붙으면 "로컬 PC 사용량"이 아니라 **계정 기준선 + 기준시각 이후 이 PC
증분**이다. 그래서 `source: 'local' | 'remote-baseline'` 로 어휘를 정확히 쓴다.

### 기준선 사용 게이트 (P0-2 해소)

`as_of` 가 billing aggregation watermark 가 아니면 **이중 계상**이 난다(원격이 이미 센 턴의 로컬
행이 `created_at > as_of` 가 되면 두 번 더해진다). endpoint 를 모르는 채로 두 경로를 다 만들지
않는다 — `UsageSnapshot` 에 필드 하나를 둔다:

```ts
baselineUsable: boolean   // 배포 fetcher 가 watermark 를 보장할 때만 true
```

**미지정 = `false`** 로 접는다(fail-closed — 이 저장소 관례). `false` 면 자동으로
`month.used = local` · `month.budget = remote` 가 된다.

> **"값이 뒤로 가지 않는다" 요구는 철회한다** — remote correction 으로 감소할 수 있고 API 가
> monotonic 을 보장하지 않는다(리뷰 §5).

### 신규 모듈

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `main/features/usage/usage-compose.ts` | `(로컬 집계, 스냅샷\|null, 한도, now) → UsageLimitsView`. 위 의미 계약 · 게이트 · 월 경계 검사가 전부 여기 | features (**순수**) | 순수 단위 — DB·electron 의존 0 |
| `main/features/usage/fetcher.ts` | `UsageFetcher` **구조적 포트** + `UsageSnapshot` 타입. `features/usage` 가 `features/providers` 를 import 하지 않기 위한 seam | features (**타입만**) | 타입 전용 — 소비처 테스트가 fake 로 검증 |
| `renderer/src/shared/stores/usageStore.ts` | Main read model 의 in-memory mirror. `{global, providers, lastUpdatedAt}` | renderer **shared** | 순수 셀렉터/리듀서부만 단위 테스트 (`.tsx` 아님 → vitest 대상) |

> **JSON → `UsageSnapshot` 매핑은 코어에 두지 않는다**(리뷰 R2) — 배포 fetcher 가 소유한다.
> 코어가 쓰지 않을 adapter 를 미리 만드는 것은 0183 이 지운 "슬롯" 과 같은 냄새다.

### 재사용 판정 (리뷰 §3 의 네 질문)

| 대상 | 계약 일치 | 판정 |
|---|---|---|
| `shared/usage/limits.ts` `computeUsageLimits` | 입력이 `CostSummary`+한도+now 로 그대로 맞는다 | **재사용** — `source` 필드만 additive 추가 |
| `llmProviderKey`/`findLlmProvider` | `Provider.llm` → providerKey 파생이 정확히 필요한 것 | **재사용** |
| `features/usage/{subscriber,tracker,usage-map}.ts` | 책임 경계가 그대로 | **재사용** (최소 수정) |
| `CostProvider.tsx` | 구독 라이프사이클 책임이 명확 | **재사용** |
| `sumUsageByBoundariesForProvider` 에 `since` **하한** 주입 | ❌ `week` 가 as_of 이전 사용분을 잃는다 (U7 위반) | **재사용 금지** → WHERE 하한은 `monthStart` 유지하고 **`month_delta_cost_usd` 조건부 SUM 컬럼만 추가** |

### 레이어 배치

- `usage-compose`·`fetcher` 는 `features/usage/` 안 → 같은 slice + `contracts`·`infra`·`shared` 만
  import. **`features/providers` 를 import 하지 않는다** — 컴포지션 루트가 concrete 를 주입한다.
- `usageStore` 는 `renderer/src/shared/stores/` → `features/settings`·`features/chat`·`pages` 가
  모두 읽을 수 있다(`features → shared` 허용). `features/cost` 에 두면 `features/settings` 에서
  lint error 다.

### scheduler 배선 (P0-5 해소)

```ts
scheduler.register('usage-boundary', () => tracker.recordAndBroadcast())
scheduler.schedule('usage-boundary', { enabled: true, cron: '0 0 * * *' })   // ← 반드시 함께
if (fetcher) {
  scheduler.register('usage-fetch', async () => { … })
  scheduler.schedule('usage-fetch', { enabled: true, cron: '* * * * *' })
}
```

`applySettings()` 는 `usage-recompute`·`update-check` 만 건드리므로 코어 고정형 잡을 덮어쓰지
않는다. **`usage-recompute` 를 남기는 근거**: 주기 의미가 다르고(사용자 임의 cron vs 자정 고정),
설정 키 제거는 `infra/settings-migration.ts` 를 부른다.

### IPC (5 → 4)

| 채널 | 요청 | 응답 | 실패 정책 |
|---|---|---|---|
| `orca:cost:usage` | `{ providerKey?: string }` | `UsageLimitsView \| null` | `{ fallback: null }` — 조회류 관례. renderer 는 null 이면 한도 섹션을 숨긴다(`UsagePanel` 현행 동작) |
| `orca:cost:usageEvent` | — (M→R send) | `{scope:'global',value}` \| `{scope:'provider',providerKey,value}` | — (send 는 zod 검증 없음) |
| `orca:cost:setProviderLimit` | 기존 유지 | `UsageLimitsView` | `'reject'` (쓰기류) |
| `orca:cost:usageStats` | 기존 유지 | 기존 유지 | 기존 유지 |

제거: `cost:summary` · `cost:summaryEvent` · `cost:providerSummaries` + 타입
`ProviderUsageEntry` · `ProviderSummariesRequest`. `CostSummary` 는 **main 내부 타입으로만** 남는다.

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **사용량 선언 슬롯을 두지 않는다 (0183 r2)** | `contracts/provider.ts:214-217` 주석 | §설계 "JSON→UsageSnapshot 매핑은 코어에 두지 않는다" · §범위 "`contracts/provider.ts` 무변경" | **유지** — 필드를 추가하지 않고 `ProviderApi.request` + 컴포지션 루트 cron 경로를 쓴다 |
| 원격 조회는 소비 feature 가 `ProviderApi` 로 직접 부른다 (가이드 §5-b) | `guides/closed-network-extensions.md:519-536` | §설계 scheduler 배선 | **유지** — 이번 fetcher 가 §5-b 의 **첫 살아 있는 선례**가 된다 (§1.7 "살아 있는 선례 없음" 을 갱신) |
| 0111 외부 quota 정합은 "리포트 생산자와 한 세트로 되살린다" | `shared/usage/limits.ts:25-29` 주석 | §설계 의미 계약 | **충족** — 생산자(`tracker.refreshProvider`)와 함께 되살린다. 단 0111 의 2단 정합(fresh 스케일/stale 바닥값)은 되살리지 않고 U5′ 의 기준선+증분으로 대체 |
| 머지된 마이그레이션 수정 금지 (기계 강제) | `app/AGENTS.md` · `scripts/check-migrations-appendonly.mjs` | §범위 "`infra/db/migrations/**` 손대지 않음" | **유지** — 0014 를 *재사용*할 뿐 수정하지 않는다 |
| main feature 교차 import 금지 | `app/src/main/AGENTS.md` · `eslint.config.mjs:161-168` | §설계 "`features/usage` 는 `features/providers` 를 import 하지 않는다" | **유지** — 구조적 포트 + 컴포지션 루트 주입 |
| renderer feature 교차 import 금지 | `eslint.config.mjs:88-95` | §설계 "`usageStore` 는 `shared/stores/`" | **유지** — 위치 선택으로 준수. 부수적으로 기존 우회(구조적 `ProviderUsageController` + app 주입)가 사라진다 |
| `shared/` 에 도메인 로직을 넣지 않는다 | `renderer/AGENTS.md:24` | §설계 "`usageStore` 는 mirror 만 한다" | **유지** — 계산 0, Main 값을 담기만 한다. `agentStore` 와 같은 성격 |
| IPC 변경 시 `IPC_CONTRACT.md` 동시 갱신 | `docs/AGENTS.md §6` | §설계 IPC 표 · §영향 파일 | **준수** — AC16 이 기계 검증 |
| `chatReducer` 의 `turnProviderKey` (0119) | `chatReducer.ts:314-316` 주석 | §4-d renderer 표 | **재사용** — 새 개념을 만들지 않고 telemetry 시점에 그 값을 굳힌다 |
| 위생 테스트 `resources.test.ts` (ko↔en 리프 키 일치·빈 값 금지) | `renderer/src/shared/i18n/resources.test.ts` | §4-e i18n 신규 키 | **준수** — AC18 |

## 파생 UX / 엣지케이스

- **한도 입력칸의 의미 (U6 귀결)**: fetcher 환경에서 원격 한도가 적용되면 사용자 입력이
  무시되는 것처럼 보인다. provider 서브탭에 **"계정 한도가 적용 중"** 을 표기하고, 입력값은
  저장하되(원격이 사라지면 fallback) 현재 적용값이 무엇인지 밝힌다.
- **provider 전환 직후 (U10)**: 새 telemetry 가 오기 전까지 마지막 telemetry 기준값을 유지한다.
  스켈레톤·pending 을 두지 않는다 — 값이 바뀌지 않는 것이 계약이다.
- **미인증·사내망 밖**: `ProviderApi.request` 가 grant 미보유 시 차단한다. 이는 **정상 상태**이므로
  오류로 올리지 않고 다음 틱을 기다린다(가이드 §5-b).
- **잡 겹침**: `Scheduler.invoke` 가 `running` Set 으로 막고 `skipped` 를 `schedule_runs` 에 남긴다.
- **앱 종료**: `Scheduler.stopAll()` 이 `closeDb` 앞에 도는 기존 순서 그대로 — 추가 정리 불필요.
- **한도 미설정(무제한)**: `budget: null` · `unlimited: true` 경로가 기존과 동일하게 유지된다.
- **원격 수치 감소**: correction 으로 `used` 가 내려갈 수 있다 — UI 는 이를 오류로 취급하지 않는다.

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `as_of` 가 watermark 가 아니면 이중 계상 | `baselineUsable` fail-closed 게이트(미지정=false). 확정 전까지 한도만 원격을 쓴다 |
| `ProviderUsageEntry` 삭제가 예상 밖 소비자를 건드린다 | 타입 삭제가 typecheck 를 강제 검출기로 만든다(0183 r2 선례 — `rg` 로 못 찾은 소비자를 컴파일이 잡았다) |
| Main 이 값을 굳혀 push 하면 기간 경계에서 stale | 코어 고정형 `usage-boundary`(`0 0 * * *`)가 자정마다 재계산·push. 일 경계가 주·월 경계를 포함한다 |
| 턴당 DB 스캔이 1 → 2회로 는다 | **순증가 0** — 두 번째 스캔은 지금도 renderer 왕복으로 일어나고 있다. IPC 왕복만 2회 준다 |
| 채널 3개 제거로 문서가 갈라진다 | `ipc-documentation.test.ts` + `check-doc-inventory.mjs` 가 CI 강제 |
| DB 로드 테스트가 egress 차단 환경에서 red | `app/AGENTS.md` 베이스라인 5파일과 대조해 **신규 red 0** 으로 분리 보고 |

- 되돌리기 어려운 결정: `source: 'local' \| 'remote-baseline'` 어휘 (IPC 공개 계약) — §범위 유예
  표에서 지금 확정했다.
- **단독 결정 금지 항목(Open Question)** → 사용자에게:
  **OQ1** — 사내 사용량 API 의 endpoint 경로·응답 필드, 그리고 `as_of` 가 billing aggregation
  watermark 인지. 배포 시 확정한다. **착수를 막지 않는다** (`baselineUsable:false` 로 동작).

## 영향 받는 파일

**신규 3** — `app/src/main/features/usage/{usage-compose,fetcher}.ts` ·
`app/src/renderer/src/shared/stores/usageStore.ts` (+ 테스트 3)

**삭제 4** — `renderer/src/features/cost/hooks/{useUsageLimits,useProviderUsage,useProviderUsageLimits}.ts` ·
`renderer/src/features/cost/store/costStore.ts`

**수정** — main: `features/usage/{tracker,subscriber}.ts` · `features/scheduler/types.ts` ·
`infra/db/{queries,types}.ts` · `app/{bootstrap,context}.ts` · `app/handlers/{cost,settings}.ts` /
shared: `ipc.ts` · `protocol.ts` · `usage/limits.ts` / `preload/index.ts` /
renderer: `shared/api/ipc.ts` · `features/chat/reducer/chatReducer.ts` ·
`features/cost/index.ts` · `features/settings/components/{SettingsModal,ProviderUsageTab}.tsx` ·
`app/SidebarUserButton.tsx` · `pages/{ChatPage,NewChatLandingPage,ProjectLandingPage}.tsx` ·
`shared/i18n/resources/{ko,en}.ts`

**손대지 않음** — `infra/db/migrations/**` · `contracts/provider.ts` ·
`features/providers/declarations/**` · `features/chat/components/{Composer,UsagePanel}.tsx` ·
`features/settings/hooks/useUsageStats.ts` · `UsageTab` 차트

## 참고 문서

- `docs/TRD.md §2 F12`(사용량 한도)·`§2 F13`(주기 실행)·`§6.7`(설정 키)
- `docs/IPC_CONTRACT.md` — **§6 변경 절차, 반드시 동시 갱신**
- `docs/arch/backend/persistence.md`(0014 서술 정정) · `docs/arch/frontend/state.md`
- `docs/guides/closed-network-extensions.md §5-b`(주기 호출 레시피 — 살아 있는 선례 등록)
- `docs/handoff/0183-usage-into-declarations/plan.md`(제거 근거·재도입 제약)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && ./node_modules/.bin/vitest run`
  + `node scripts/check-migrations-appendonly.mjs` + `node scripts/check-doc-inventory.mjs`.
- 신규 테스트 요구: `usage-compose`(순수 합성 6케이스) · `queries`(monthDelta·0014 왕복) ·
  `subscriber`(affected-provider) · `usage-wiring`(register+schedule 양쪽) ·
  `chatReducer.usage`(provider 고정).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 4건과 사용자 결정 8건을 라이브 세션 인용으로 출처 표기, 추론은 추론으로 표기
- [x] 자료조사 — 모든 발견에 `파일:라인` 또는 실행한 `rg`/`find` 명령을 붙였다
- [x] 의존 기술 — 신규 의존성 0 을 명시, IPC 채널 수 변경을 전제로 표기
- [x] 파생 UX — 한도 입력칸 의미·전환 직후·미인증·잡 겹침·종료·무제한·수치 감소 7건
- [x] 리스크 — 되돌리기 어려운 결정(`source` 어휘)을 §범위 유예 표에서 확정, OQ1 을 사용자로 분리
- [x] **요구 비판적 검토** 다섯 질문에 답했고, 전제를 정정했으나 **요구 범위를 줄이지 않았다**
- [x] 인수 기준 `검증 수단` 칸이 비어 있지 않다 (AC19·AC20 은 "사람 실기 + 실행 경로" 로 명시)
- [x] 부정형/"불변" 기준 0개 — AC15 "16개로 불변" 은 `ls` 로 세는 **양성 수치 단언**이고,
      AC2 의 "부재" 는 `ls` 로 확인하는 삭제 완료 단언이다
- [x] AC 끼리 모순 없음 — AC4(기준선 사용) ↔ AC5·AC6(기준선 폐기)은 전제 조건이 배타적이다.
      AC7(한도만 원격) ↔ AC6(기준선 폐기)은 **함께 성립해야 하는 쌍**으로 설계했다
- [x] 인용 수치를 이번 세션에서 직접 측정 (파일 6개 · schedule 0건 · 접근자 0개 · 마이그레이션 16)
- [x] 신규 모듈 3개 모두 테스트 방법이 있고, DB·electron 의존부는 `usage-compose`(순수)로 떼었다
- [x] 전수 조사에 N 수치 — `features/cost` **6**, bootstrap `schedule()` **0**, 0014 접근자 **0**,
      마이그레이션 **16**, cost 채널 **5→4**
- [x] 각 AC 에 프로덕션 도달 경로가 있다 (유일한 호출자가 테스트인 AC 0개)
- [x] "사람 실기" AC(19·20)에 실행 경로가 있고 자기 비범위에 막혀 있지 않다
- [x] 선택적 필드 판정(`baselineUsable`)의 **미지정 케이스가 AC5 로 별도**에 있다
- [x] 소비 계약의 제약 필드마다 강제 지점 — `baselineUsable`(compose 진입부) ·
      `as_of` 월 경계(compose) · `ProviderApi.request` 의 origin/절대경로(기존 정책이 강제)
- [x] 참조 구현(v4 명세·리뷰)의 커버리지를 계약과 대조 — 리뷰 P0 5건 + R1·R2 전건에 판정을 달았고
      이견 2건(usage-recompute 유지 · turnProviderKey 재사용)은 근거와 함께 본문에 반영
- [x] 미룬 항목마다 일방향 여부에 답했다 (§범위 유예 표 5행)
- [x] **관문 4 를 본문 완성 후 돌렸다** — §기존 결정 표 9행을 본문을 훑으며 채웠고, 인용 경로
      (`contracts/provider.ts:214-217` · `eslint.config.mjs:88-95` · `chatReducer.ts:314-316` ·
      `limits.ts:25-29`)를 전부 열어 확인했다. `[구현자 기입]`·`[검증자 기입]` 블록이 아래 있다
- [x] "확정돼 있다" 로 서술한 것의 앵커 확인 — `closed-network-extensions.md §5-b` 존재(`:519`),
      `docs/AGENTS.md §6` 존재, `contracts/provider.ts` 의 슬롯 금지 주석 존재

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: §설계의 의미 계약(§2)·기준선 게이트(§3)·R1 수정(하한 유지 + 조건부 SUM)은
  구현하면서 한 번도 흔들리지 않았다. 특히 R1 은 **테스트가 실제로 지켜줬다** — `week` 전량 보존을
  단언하는 케이스가 없었다면 하한을 올리는 "더 간단해 보이는" 구현으로 샜을 것이다.
- **이견 / 우려 1 — AC11·AC12 의 검증 수단이 실행 불가였다.** 설계는 "bootstrap 배선 테스트 —
  fake Scheduler 로 `register`·`schedule` 양쪽 단언" 이라고 적었지만, `bootstrap.ts` 는 electron 을
  import 하므로 **vitest 가 로드조차 못 한다**(P29). 설계가 지정한 자리에서는 그 AC 를 검증할 수
  없었다. → 아래 D1 로 해소.
- **이견 / 우려 2 — §4-e(한도 입력칸)를 만족시킬 데이터가 계약에 없었다.** "계정 한도가 적용 중"
  을 표기하려면 *적용값*과 *사용자 설정값*을 갈라야 하는데, `UsageLimitsView` 에는 적용값
  (`budget`)뿐이었다. 설계 본문과 계약이 어긋난 지점. → D2.
- **우려 3 (해소됨)** — `chatReducer` 수정 규모가 "2~3줄" 로 적혀 있었으나 실제로는 fork 승계
  (`chatStore.ts`)까지 4곳이었다. 승계를 빠뜨리면 fork 직후 주/월 바가 사라졌다 돌아온다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| D1 | AC11·AC12 를 `bootstrap.ts` 에서 검증할 수 없다(electron import → vitest 로드 불가). 리뷰 §17 은 "NEW 최대 2개" 를 권고했다 | ✅ **구현함** — `features/usage/jobs.ts` 신설(신규 3개째). `registerUsageJobs(scheduler, tracker, opts)` 순수 함수로 떼어 fake 로 `register`·`schedule` 양쪽을 단언한다 | 리뷰 §2 가 금지한 "쓰지도 않을 adapter" 와 다르다 — 유일 소비자 `bootstrap.ts` 가 실재한다. `features/usage` 가 `features/scheduler` 를 import 하지 못하므로 구조적 포트로 받는다 |
| D2 | `UsageLimitsView` 로는 §4-e 를 구현할 수 없다 — 원격 한도가 적용 중일 때 편집기가 보여줄 *사용자 설정값*이 계약에 없다 | ✅ **구현함** — 뷰에 `budgetSource: 'configured' \| 'remote'` + `configuredLimitUsd` 2필드 추가. 바가 아니라 **뷰 레벨**에 뒀다(주간 예산은 월 한도에서 일할 파생이라 출처가 같다) | 리뷰 §10 이 "필요 시 필드를 둔다" 로 열어둔 범위. i18n `usage.accountLimitApplied` 동반 |
| D3 | `UsageDelta` 를 `shared/ipc.ts` 에 두면 `import/no-cycle` 위반 (`limits.ts` 가 `CostSummary` 를 가져간다) | ✅ **구현함** — `shared/usage/limits.ts` 가 소유. preload·renderer 는 타입 전용 import 라 런타임 코드가 딸려오지 않는다 | `eslint.config.mjs` `import/no-cycle` |
| D4 | 설계가 `features/chat/**` 를 "reducer 2~3줄" 로 봤으나 **fork 승계**(`chatStore.ts:908`)가 빠져 있었다 | ✅ **구현함** — `lastTelemetryProviderKey` 를 fork draft 에 승계 | 안 하면 fork 직후 한도 섹션이 사라졌다가 첫 턴 후 복귀 |
| D5 | 도넛 조립을 어느 레이어에 둘지 미지정. `features/chat`(세션) + `shared/stores/usageStore` 를 함께 읽어야 한다 | ✅ **구현함** — `pages/useUsageForTelemetryProvider.ts` (page 레이어 조립). feature 안에 두면 교차-feature | renderer 4-layer — `pages → features · shared` |
| D6 | **문서 드리프트가 설계가 잡은 2건보다 많았다** — `IPC_CONTRACT.md` 의 사용량 타입 블록 전체(`UsageQuota`·`ExternalUsageReport`·`EffectiveUsageLimitView`·`ProviderUsageEntry`)가 0183 r2 에서 이미 사라진 심볼을 서술 중이었고, `arch/backend/overview.md:191` 도 죽은 채널을 가리켰다 | ✅ **구현함** — 타입 블록을 현재 계약으로 교체, overview 채널명 정정 | 0183 r2 가 놓친 잔여 드리프트 |
| D7 | `usage-recompute` 의 기본값이 `false` 라 **경계 갱신을 그 잡에 맡길 수 없다** | ✅ **구현함**(설계대로) — 코어 고정형 `usage-boundary` 신설. 설계 §4-b 가 이미 지목한 문제이나, 구현 중 `protocol.ts:460-463` 로 재확인 | — |

## [구현자 기입] 구현 체크리스트

- [x] `usage-compose.ts` 순수 합성 + 13 케이스 (기준선/미지정/false/월경계/한도폴백/주간로컬/correction)
- [x] `fetcher.ts` 포트 — 타입만, 매핑은 배포 소유 (R2)
- [x] `jobs.ts` + 8 케이스 — register **와** schedule 양쪽 단언 (P0-5)
- [x] `queries.ts` — 0014 접근자 2종 복원 + `month_delta_cost_usd` (하한 무변경, R1) + 4 케이스
- [x] `tracker.ts` — `recordAndBroadcast(providerKey?)`·`getGlobalUsage`·`getProviderUsage`·`refreshProvider` + 12 케이스
- [x] `subscriber.ts` 최소 수정 + 3 케이스 (affected-provider 만)
- [x] IPC 5→4 · `ProviderUsageEntry`/`ProviderSummariesRequest` 제거 · 전체 채널 76→75
- [x] `bootstrap.ts` — fetcher 주입 자리 + `llmProviderKey` 조인 + 잡 2종
- [x] `shared/stores/usageStore.ts` + hook 3 & `costStore` 삭제 (features/cost 6→2 파일)
- [x] `chatReducer` `lastTelemetryProviderKey` 4지점 + 6 케이스
- [x] `SettingsModal`/`ProviderUsageTab`/`SidebarUserButton` — 주입 배선 소멸
- [x] i18n ko/en `usage.accountLimitApplied`
- [x] 문서 7건 + `inventory.md` 재생성
- [x] 마이그레이션 **0건** (`check-migrations-appendonly` — 16개 불변)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **51** — 신규 9 · 삭제 4 · 수정 38. `+2,187 / −447` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `check-migrations-appendonly.mjs` · `check-doc-inventory.mjs` |
| 게이트 결과 | lint **0 error / 1 warn**(0102 베이스라인) · typecheck **3/3** · vitest **197 파일(196/1) · 1,758 테스트 — 실패 0** · scripts **49/49** · 마이그레이션 sync ok(16) |
| 베이스라인 대비 | 착수 전 192 파일(187/5) · 1,708(1670/**38**) → **1,758 전량 green**. 착수 전 red 5 중 4 는 `npm rebuild better-sqlite3`(Node ABI)로 해소했고, 남은 1파일(`app/chat-turn.continuity.test.ts`)은 **테스트 실패가 아니라 로드 실패**다 — `Electron failed to install`(egress 차단, 변경 무관) |
| 신규 테스트 | **+50건** (usage 슬라이스 4파일 36 · queries 4 · chatReducer 6 · limits 4) |
| 블로커 / 역질문 | 없음. **OQ1**(사내 endpoint 실값 + `as_of` 가 billing watermark 인지)은 미결이나 착수를 막지 않았다 — `baselineUsable:false` 로 동작하며 한도만 원격을 쓴다 |
| 미충족 인수 기준 | **AC13·AC20 (사람 실기)** — 자정 경계 · 모델 전환 후 도넛. egress 차단으로 `npm run dev` 가 Electron ABI 재빌드에 막힌다(0019·0102·0180 AC9 선례). AC18 의 기계 검증부(reducer)는 통과 |
| 대상 커밋 | `c159e13` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

출처는 전부 **PR #329 외부 리뷰**(`orca_pr329_usage_architecture_evaluation.md`, REQUEST CHANGES).
6건 모두 코드에서 **실측 확인했다** — 리뷰의 판정이 옳았다. D9 는 리뷰 제안이 아니라
**본 plan §4-a 가 `handlers/settings.ts` 를 MODIFY 로 적어놓고 구현하지 않은 것**이다.

| # | 이슈 | 실측 근거 | 대응 방향 | 상태 |
|---|---|---|---|---|
| **D8** | **P0 — 자정에 provider mirror 가 stale.** 기간이 넘어가도 캐시된 provider 뷰가 어제 기준(week·month·`resetAt`)에 멈추고 되살아나지 못한다 | 세 원인이 맞물린다 — ⓐ `jobs.ts` 의 경계 액션이 `recordAndBroadcast()` 를 인자 없이 불러 **global 만** 나간다 ⓑ `usageStore` 에 provider 무효화 경로가 **0건** ⓒ `ensureProviderUsage` 가 키가 있으면 **조기 반환** ⓓ `useUsageForTelemetryProvider` 가 `provider ?? global` 이라 **stale provider 가 신선한 global 을 이긴다** | `UsageDelta` 에 `{scope:'boundary'}` 추가 → `tracker.refreshBoundary()` 신설 → `jobs.ts` 경계 액션이 그걸 부른다 → store 가 `providers`·`providerUpdatedAt` 을 **비운다**. 자정에 전 provider 재집계는 **하지 않는다**(affected-provider 성능 계약 유지). 소비 훅 2곳의 effect 의존을 `[providerKey, provider]` 로 바꿔 "키는 그대로, 값만 사라짐" 이 재조회를 트리거하게 한다 | **해소 (r2)** |
| **D9** | **P2-3 — `spendingLimitUsd` 변경이 화면에 즉시 안 붙는다.** 도넛이 다음 턴 종료까지 옛 한도의 퍼센트를 보여준다 | `rg 'cost|usage' handlers/settings.ts` → **0건**. 같은 파일에 `authBypass` 선례가 이미 있다(`:21-23`) | 그 선례를 그대로 따라 `keys.includes('spendingLimitUsd')` 면 `ctx.cost.recordAndBroadcast()` | **해소 (r2)** |
| **D10** | **P1-2 — 동기화 버튼이 원격을 부르지 않는다.** 1분 cron 이 이미 써 둔 캐시를 다시 읽을 뿐이라 "지금 갱신" 이 되지 않는다 | 구 `refreshProviderUsage` → `costApi.usage()` → 읽기 전용. 원격은 `usage-fetch` cron 에서만 | **사용자 결정**: 전용 command. `orca:cost:refreshUsage`(쓰기, `reject`) 신설 → `tracker.refreshProvider()`. 읽기 채널에 `refresh:true` 부수효과 옵션을 얹지 않는다 — 한 채널이 읽기·쓰기 두 실패 정책을 가질 수 없다. **전체 채널 75 → 76** | **해소 (r2)** |
| **D11** | **P1-1 — `lastUpdatedAt` 이 scope 별이 아니다.** provider B 를 갱신한 시각이 A 화면의 "마지막 업데이트" 로 뜬다 | `ProviderUsageTab` 이 전역 `useUsageUpdatedAt()` 를 provider 타임스탬프로 표시 | store 를 `globalUpdatedAt` + `providerUpdatedAt: Record<string, number>` 로 쪼개고 `useProviderUsageUpdatedAt(key)` 를 쓴다 | **해소 (r2)** |
| **D12** | **P1-3 — "턴당 delta 1회" 설명과 구현 불일치.** 실제로는 global 1 + provider 1 = **2회** | `tracker.recordAndBroadcast` 가 `providerKey` 가 있으면 broadcast 2회 | **`UsagePatch` 1회 배칭은 불채택** — D8 이 세 번째 variant(`boundary`)를 더하므로 discriminated union 이 optional-field patch 보다 읽기 쉽고, 창 1개짜리 데스크톱 앱에서 턴당 send 1회 차이는 무의미하다. **설명을 코드에 맞춘다**(PR 설명 정정) | **해소 (설명 정정)** |
| **D13** | **P2-1 — `UsageSnapshot.remainingUsd` 소비자 0.** DB 에 쓰고 읽어 오지만 compose·UI 어디도 쓰지 않는다 | `rg 'remainingUsd'` → 쓰기·읽기 경로만, 파생 0 | **부분 후속.** 0014 에 `quota_remaining_usd` 컬럼이 있어 배포 fetcher 가 채울 수 있다 — 지금 지우면 컬럼이 영구 NULL 이 된다. `providerKey` 중복 필드는 동의하나 단독으로 고칠 만큼 급하지 않다 | 후속 |
| **D14** | **P1-4 — `jobs.ts` 가 features 에 있어 구조적 포트 2개를 요구한다.** app 레이어면 `Scheduler`·`UsageTracker` 를 직접 받을 수 있다 | `features/scheduler/scheduler.ts` 가 electron-free 임을 확인 — 지적이 타당하다 | **후속.** 파일 이동 + 테스트 재작성이라 P0 수정과 섞으면 diff 의 초점이 흐려진다 | 후속 |

### 라운드 2 게이트

| 항목 | 결과 |
|---|---|
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `check-migrations-appendonly.mjs` · `check-doc-inventory.mjs` |
| 신규 테스트 | **+16건** — `usageStore.test.ts`(신규 9, 경계 무효화 계약) · `settings.test.ts`(+3, D9) · `tracker.test.ts`(+2, boundary scope · provider 재집계 없음) · `jobs.test.ts`(수정, `refreshBoundary` 단언) |
| 마이그레이션 | **여전히 0건** (16개 불변) |
| ⚠️ 기계 검증의 한계 | effect 의존 수정(`[providerKey, provider]`)은 hook 렌더가 필요한데 이 저장소에는 testing-library·jsdom 이 없고 vitest 가 `environment:'node'` + `*.test.ts` 만 수집한다. **store 계약까지만 기계 검증**되고 재조회 트리거는 코드 리뷰 + 사람 실기 몫이다 |
| 대상 커밋 (r2) | `3ed13af` |
| 사람 실기 | 자정 경계를 넘겨 도넛·설정 탭이 새 기간을 반영하는지 · 동기화 버튼이 원격을 부르는지(fetcher 있는 배포) |


### 라운드 3 파생 이슈 — remote authority / refresh 경로

출처는 사용자 제공 **PR #329 재평가**(2026-08-12, REQUEST CHANGES)다. 이전 P0가 닫힌 뒤
남은 merge 조건을 현재 코드와 다시 대조했으며, 경량화 목표와 직접 관련된 P0/P1만 이번 라운드에서
수정한다. generation race·Composer loading 의미·파일 이동·snapshot 필드 정리는 동작 계약을 더
넓히거나 diff 초점을 흐리는 P2이므로 후속 검증 대상으로 유지한다.

| # | 이슈 | 구현 | 검증 |
|---|---|---|---|
| **D15** | 과거 cache row가 현재 remote capability 없이도 authority가 됨 | `UsageFetcher.supports(providerKey)`를 단일 capability source로 추가하고 Tracker read/manual refresh와 cron 대상 모두 이를 사용한다. 미주입·미지원이면 cache가 있어도 local/configured view다 | `tracker.test.ts`의 미주입/미지원/지원 cache 3분기 + `jobs.test.ts`의 provider 필터 |
| **D16** | Tracker가 cron의 fail-soft 정책을 소유해 manual command 실패도 성공처럼 보임 | Tracker는 fetch 오류를 전파하고, cron만 provider별 catch하여 다음 provider를 계속한다. Renderer command 실패는 mirror/timestamp를 바꾸지 않고 event handler에서 rejection을 소비한다 | `tracker.test.ts` reject, `jobs.test.ts` 연속 실행, `usageStore.test.ts` 값/timestamp 유지 |
| **D17** | manual refresh 성공 시 provider 집계가 2회임 | `refreshProvider()`가 한 번 계산한 `UsageLimitsView`를 broadcast하고 반환한다. handler는 반환값을 그대로 응답하고 null fallback에서만 local view를 한 번 계산한다 | `tracker.test.ts` provider aggregate 1회 + broadcast/return 동일 값 |

#### 라운드 3 구현 보고

- 신규 의존성·DB migration·IPC 채널 변경: **없음**.
- 개념 축소: cache row를 capability로 승격하지 않고 `UsageFetcher.supports`가 현재 원격 권위의 단일
  게이트가 된다.
- 경로 축소: manual 성공 경로는 provider aggregate 1회이며 background/manual의 실패정책은 caller
  경계에서만 갈린다.
- P2 유예 비용: generation guard와 Composer loading은 renderer-only 후속으로 공개 계약/DB를
  바꾸지 않아 나중 비용이 커지지 않는다. `jobs.ts` 이동과 snapshot 다이어트도 내부 리팩터링이다.

### 라운드 4 파생 이슈 — supported provider의 빈 응답

PR #330 평가에서 D16의 남은 의미 충돌을 확인했다. `supports=false`와 `supports=true + fetch=null`이
모두 `null`로 합쳐져 manual handler의 local fallback 성공으로 바뀌고 있었다. 새 Result·error hierarchy
없이 Tracker 한 지점에서 **지원 provider의 빈 snapshot만 일반 Error로 승격**한다. unsupported는 기존
`null` local fallback, background는 기존 provider별 catch, manual은 기존 reject 경로를 그대로 쓴다.
테스트는 cache write·broadcast가 없고 reject하는 것을 단언한다. 신규 파일·의존성·DB·IPC 변경은 없다.

### 라운드 5 파생 이슈 — verify r1 (FAIL) 이관분

출처는 [`verify.md`](verify.md) (검증 r1, 2026-08-12). 인수 기준 18/20 은 기계 검증을 통과했고
게이트도 깨끗하다 — 아래는 **어느 인수 기준에도 걸리지 않아 역방향 탐색으로 잡은 것**이다.
D18~D21 이 이번 FAIL 의 조건이고, D22~D25 는 후속(비차단)이다.

| # | 이슈 | 실측 근거 | 대응 방향 | 상태 |
|---|---|---|---|---|
| **D18** | **배포 절차 SSOT 가 현재 포트와 어긋난다 — 따라 하면 컴파일되지 않는다.** r3 가 `UsageFetcher.supports` 를 필수 멤버로 만들고 r4 가 `null` 의 의미를 "정상 → 다음 틱" 에서 "실패" 로 뒤집었는데, 두 변경이 §5-b 에 반영되지 않았다 | `guides/closed-network-extensions.md:620-632` 의 예제에 `supports` **없음**(→ TS2739) · 같은 예제의 `if (!res.ok) return null // 정상 상태다` 는 `tracker.ts:119` 가 Error 로 승격하므로 **거짓**. 이 배포에 fetcher 구현체가 0개라(`bootstrap.ts:417`) **이 문서가 유일한 프로덕션 진입 경로**다 | ⓐ 예제에 `supports` 추가 ⓑ "지원 여부 = `supports`, 이번 틱 실패 = throw/null" 규약을 문장으로 명시 ⓒ **0181 5단계-e 절차로 검증** — 예제를 실제 `bootstrap.ts` 에 채워 typecheck 3/3 통과 후 되돌린다 ⓓ 본 plan §파생 UX 의 "미인증·사내망 밖은 오류로 올리지 않는다" 문장도 현행 의미로 개정 | **해소 (r5)** |
| **D19** | **`IPC_CONTRACT.md` 자기모순** — 타입 블록에 r2 의 `boundary` variant 가 없다 | `docs/IPC_CONTRACT.md:320-322` 는 2-variant, 같은 문서 `:277` 채널 행은 3-variant 를 서술. 코드는 `shared/usage/limits.ts:51-60` 3-variant | 타입 블록에 `{ scope: 'boundary'; value: UsageLimitsView }` 추가. **이 문서만 읽고 consumer 를 짜면 D8 이 고친 자정 stale 을 그대로 재현한다** | **해소 (r5)** |
| **D20** | **`GLOSSARY.md` 가 삭제된 심볼을 정본으로 서술** | `docs/GLOSSARY.md:44` — "실사용 SSOT(UsageTracker/**costStore**)에서 `computeUsageLimits` 로 파생만". `costStore` 는 이번에 삭제됐고 파생 위치도 renderer → main | 현재 구조(Main 정본 + renderer mirror)로 문장 교체 | **해소 (r5)** |
| **D21** | **죽은 심볼을 가리키는 코드 주석 3곳** — 폐기된 renderer 파생 모델을 현재형으로 설명 | `features/chat/components/Composer.tsx:49` · `features/chat/components/UsagePanel.tsx:12` · `src/shared/protocol.ts:530` (전부 `costStore` 인용). plan 이 두 컴포넌트를 "손대지 않음" 으로 둬서 남았다 | 주석만 현행화(동작 변경 0) | **해소 (r5)** |
| **D22** | **원격 상시 실패가 완전히 침묵한다.** 폐쇄망에서 "사용량이 왜 안 늘지" 를 확인할 경로가 0 | `jobs.ts:71-73` 의 `catch {}` 는 로그를 남기지 않고, 액션이 던지지 않으므로 `Scheduler.invoke` 가 `schedule_runs` 에 **`success`** 를 적는다 | `getLogger().child('usage').warn('usage.fetch.failed', …)` 한 줄. 잡 자체는 fail-soft 유지 | 후속 |
| **D23** | **동기화 실패가 UI 에 표시되지 않는다** | `ProviderUsageTab.tsx:48-50` 의 `catch {}` — 코드 주석도 "오류 UI 계약은 별도" 로 인정 | 오류 표시 계약을 정한 뒤 반영(설정 탭 공통) | 후속 |
| **D24** | **"마지막 업데이트" 가 원격 신선도가 아니다** — `providerUpdatedAt` 은 로컬 수신 시각이라 원격이 며칠 죽어도 "방금" 으로 보인다. 미지원 provider 의 동기화 버튼도 로컬 뷰를 성공으로 돌려준다(경미한 false success) | `usageStore.ts:93-97` (`Date.now()`) · `handlers/cost.ts:49-52` (미지원 → 로컬 폴백) | 뷰에 원격 `fetchedAt` 을 실어 "원격 기준 N시간 전" 을 구분 표시. 스칼라는 0014 에 이미 있다 | 후속 |
| **D25** | **plan AC2 문구가 낡았다** — "`usage`·`setProviderLimit` 두 채널만" 은 D10 의 `cost:refreshUsage` 신설로 성립하지 않는다(현재 4표면) | `usageStore.ts` 의 `costApi.*` 4종 | 다음 라운드에서 AC2 문구를 개정하거나, 개정 이력을 §파생 이슈로만 남긴다 | 후속 |

#### 라운드 5 구현 보고 — 문서·주석 동기화

사용자가 제시한 경량 수정 권고(PR #331 평가서)를 그대로 따랐다: **코드를 문서에 맞추지 않고
문서를 코드에 맞춘다.** D18~D21 만 닫고 D22~D25 는 후속으로 남긴다.

| 항목 | 내용 |
|---|---|
| 변경 파일 | **6** — 문서 3(`guides/closed-network-extensions.md` · `IPC_CONTRACT.md` · `GLOSSARY.md`) + 주석 3(`bootstrap.ts` · `Composer.tsx` · `UsagePanel.tsx` · `protocol.ts` 중 실행 코드 0줄) |
| **functional production logic 변경** | **0줄** — `git diff` 에서 주석·문서 외 라인 0건임을 확인했다(주석 제거 필터 grep) |
| DB · IPC 스키마 · 의존성 | **전부 0** — 마이그레이션 16 불변, 채널 76 불변 |
| 새 추상화 | **0** — `UsageFetcherV2`·`Result<T>`·에러 enum·선언 슬롯 어느 것도 만들지 않았다 |
| **compile-backed 문서 검증** | 고친 §5-b 예제를 `bootstrap.ts` 의 `usageFetcher` 자리에 **실제 코드로 삽입** → `npm run typecheck` **3/3 PASS** → 되돌림(0181 5단계-e 절차). 이 검증이 D18 의 재발을 막는 유일한 기계 장치다 |
| 게이트 | lint **0 error / 1 warn** · typecheck **3/3** · vitest **198 파일 · 1,779 테스트 전량 green**(로드 실패 1 = `chat-turn.continuity`, electron egress 베이스라인) · 마이그레이션 sync ok(16) · doc-inventory `--check` exit 0 — **전부 verify r1 과 동일**(문서 변경임을 수치로 확인) |

**D18 이 실제로 무엇을 고쳤나**: `supports`(능력)와 반환값(이번 호출의 결과)을 문서가 가르지
못하던 것. 예제에 `supports` 를 넣고 `if (!res.ok) return null // 정상 상태다` 를 throw 로 바꾼 뒤,
세 상태(`supports:false` / 스냅샷 / `null`·throw)와 호출자별 실패 정책(cron=fail-soft ·
manual=reject)을 표로 고정했다. **같은 예제가 `bootstrap.ts` 주석에도 있어 함께 고쳤다** —
배포가 실제로 편집하는 파일이라 문서만 고치면 오도가 남는다.
