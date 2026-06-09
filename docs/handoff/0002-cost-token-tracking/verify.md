# Verify — 0002-cost-token-tracking

> plan.md 의 인수 기준 1~14 를 1:1 대조한 검증 결과. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0002-cost-token-tracking` |
| 검증자 | Claude Code |
| 일자 | 2026-06-09 |
| 대상 커밋 | `86f1859` (Codex 구현이 본 브랜치에 rebase 적재됨 — 원 환경 hash `4213cad` 와 동일 트리) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `0006_turn_usage.sql` — `turn_usage`(model 컬럼 없음) + `turn_model_usage` 분할, id 보존 이관, 인덱스 3종, `DROP usage_events`, 토큰/비용 nullable, `migrate.ts` 등록 | ✅ | `0006_turn_usage.sql:3-73`(2 테이블·이관 2 INSERT·인덱스 3·DROP). `migrate.ts:7,20`(import + `MIGRATIONS` 등록). 이관 검증 테스트 `queries.test.ts:42`(id 보존 + 기존 테이블 제거) |
| 2 | `db/types.ts` — `UsageEvent*` 제거, `TurnUsageInsert/Row`·`TurnModelUsageInsert/Row`·`UsageSumRow`(camelCase) 추가 | ✅ | `types.ts:40-91`. `UsageEvent`/`UsageRow` 잔존 0 (grep) |
| 3 | `db/queries.ts` — `insertTurnUsage(): number`(lastInsertRowid)·`insertTurnModelUsage(): void`·`getLatestTurnUsage`(최신 1행 + 자식 조인 primary model 재구성)·`sumUsageSince`(COALESCE SUM) | ✅ | `queries.ts:252-275`(메서드)·`115-149`(prepared stmts). `getLatestTurnUsage` 자식 input_tokens 내림차순(`133,138`) |
| 4 | `usage/usageMap.ts` — `usageRowToTelemetry(TurnUsageRow,자식)→ProviderReportedTelemetry`, primary 자식 model, modelUsage 재구성, `hasContextTokens` 불변 | ✅ | `usageMap.ts:13-54`(재구성 + `primaryModel` = max input_tokens)·`7-11`(`hasContextTokens` 입력은 `ProviderReportedTelemetry` 유지) |
| 5 | `router.ts` telemetry case — 가드 `turn.dbSessionId && u && hasContextTokens(u)`, `insertTurnUsage` → 자식 `insertTurnModelUsage`, 직후 `recordAndBroadcast()`, 로드부 `getLatestTurnUsage` | ✅ | `router.ts:525`(가드)·`526-559`(부모+자식 적재; `modelUsage` 비면 `u.model` 폴백)·`560`(broadcast)·`654`(`getLatestTurnUsage` 로드 복원) |
| 6 | `cost/boundaries.ts` — `boundaries(now)` 로컬타임 day/week/month epoch ms | ✅ | `boundaries.ts:8-16`(weekStart=월요일). 단위테스트 `boundaries.test.ts`(고정 timestamp + 일요일 경계) |
| 7 | `cost/tracker.ts` — `CostTracker` 캐시·`recompute()`(boundaries→sumUsageSince ×3)·`recordAndBroadcast()`(전 webContents push)·`getSummary()` | ✅ | `tracker.ts:7-34`(broadcast 가 `runtime:statusEvent` 패턴 동형 — destroyed 가드 포함) |
| 8 | router 배선 — `cost` 인스턴스, `start()` 부팅 1회 `recompute()`, `register()` 에 `costSummary` handle | ✅ | `router.ts:117`(필드)·`123-124`(생성+recompute)·`192`(handle)·`774-775`(`handleCostSummary`) |
| 9 | `shared/ipc.ts` — `CostSummary` 타입 + 2 채널(`costSummary`·`costSummaryEvent`) | ✅ | `ipc.ts:40-41`(채널)·`50-63`(`CostPeriodSummary`/`CostSummary`). CHANNELS 총 35개(33+2) |
| 10 | 브리지 — preload `cost.summary()`+`cost.onSummary()`, renderer `costApi` | ✅ | `preload/index.ts:106-113`(unsubscribe 반환)·`shared/api/ipc.ts:88-92` |
| 11 | `features/cost/` — `CostProvider`+`useCost()`(마운트 fetch + onSummary 구독), `App.tsx` 합성, UI 없음 | ✅ | `CostProvider.tsx:9-19`(fetch+구독+cleanup)·`costContext.ts`·`index.ts`·`App.tsx:7,17-21` |
| 12 | 테스트 — `boundaries.test.ts` 신규 + 이관/`getLatestTurnUsage`/`sumUsageSince` + usageMap 갱신 | ✅ | `boundaries.test.ts`(2)·`queries.test.ts:42,81,112,160`(이관·insert·getLatest·sum)·`usageMap.test.ts:31,51,60,81,87`(재구성·primary·graceful·hasContextTokens) |
| 13 | 게이트 회귀 0 + `features/cost` 는 shared 만 의존(경계 위반 0) | ✅ | lint/typecheck/test 전부 통과(아래). `CostProvider`/`costContext` import 는 `shared/**` 만 — boundaries v6 lint error 0 |
| 14 | `IPC_CONTRACT.md` — +2 채널 + `session:load` `lastTelemetry`(turn_usage) 문구 + §6 | ✅ | `IPC_CONTRACT.md:19`(총 35 채널)·`202-207`(cost 도메인 §2.x)·`251`(telemetry 행)·`296`(§6 절차) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 통과 (38 files / 260 tests) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 14/14 ✅ |
| 레이어 경계 위반 0 | ✅ | — | boundaries v6 lint error 0 |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 미변경 — 코드/문서 비밀·이메일·IP 스캔 CLEAN |
| 제품 의도 부합(PRD/트랜스크립트) | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| Open Questions | ✖ | ✅ | 해당 없음(미정 항목 미저촉) |
| UI/UX 시각 검증 | ✖ | ✅ | 본 작업 UI 없음(seam 까지) — 시각 회귀 없음 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0(SSOT=DB SUM 파생) |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        # eslint --cache --fix ./src — 클린(error/warn 0)
$ npm run typecheck             # typecheck:node + typecheck:web — 통과
$ npm test                      # vitest run
  Test Files  38 passed (38)
       Tests  260 passed (260)
```

> 주의: 최초 `npm test` 는 `better-sqlite3` 네이티브 모듈 ABI 미스매치("did not self-register")로 db 테스트 4건 실패했다. 이는 **환경 이슈**(prebuilt `.node` 가 본 컨테이너 Node ABI 와 불일치)이지 코드 결함이 아니다. `npm rebuild better-sqlite3` 후 260건 전부 통과. Codex 보고(260 통과)와 일치.

## 위생 검토

- AGENTS.md 류 변경 없음(코드·docs/IPC_CONTRACT 만 변경).
- 비밀(키/토큰/PW)·이메일·IP 패턴 스캔: cost/usage/migration/features-cost 전 파일 **CLEAN**.
- 미계획 변경 3건 점검: `TelemetryPanel.tsx`·`chatReducer.ts` 는 **주석 한정**(`usage_events`→`turn_usage` 리네임, 로직·Composer 컨텍스트% 무변경 — plan "건드리지 않음" 준수), `protocol.ts` 는 신규 타입 re-export(plan 파일목록 `shared/{ipc,protocol}.ts` 포함). 결함 없음.

## PHASES.md 정합성

- "현재 작업 중" 은 보드 링크만 유지(규약 준수). 본 검증 PASS 로 페이즈 표에 완료 행 승격.

## 결론 / 다음 단계

- **상태: PASS** — 인수 기준 14/14 충족, 게이트 3종 전부 통과, 레이어 경계 위반 0, 위생 CLEAN.
- `INDEX.md` → `verify/PASS`, 다음 주체 `—`. `PHASES.md` 페이즈 표에 완료 행 승격.
- 잔여(비범위): 누적/모델별 분해를 **표시하는 UI** 는 후속(현재 seam 까지 — backend SUM + renderer Context 미러 완비). draft PR 생성.
