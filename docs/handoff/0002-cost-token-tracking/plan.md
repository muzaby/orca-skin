# Plan — 0002-cost-token-tracking (main 동기화 후 재작성)

> 비용·토큰 사용량 추적. **구버전 main 기준 초안을 main `9a9f270`(PR #54–57) 동기화 후 잔여 범위로 재작성**하고, DB 스키마를 원 제시안(`turn_usage`+`turn_model_usage`)으로 통일한다. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0002-cost-token-tracking` |
| 작성자 | Claude Code |
| 일자 | 2026-06-09 (rebase onto `9a9f270` 후 재작성) |
| 매핑 | PHASES "현재 작업 중" → 완료 시 표 승격 |
| 상태 | READY |

## Context (왜)

본 초안은 **구버전 main**(merge-base `39e6965`) 기준이었다. 그 사이 main 이 PR #54–57 로 전진해 **이 plan 의 ~80% 를 다른 네이밍**(`usage_events` 단일 테이블 등)으로 이미 구현했다. 따라서 범위를 **잔여분**으로 좁히고, **데이터 모델은 원 제시안(`turn_usage`+`turn_model_usage`)으로 통일**(사용자 결정: `usage_events` → `turn_usage` 리네임 + 필드 네이밍 통일 + 파생 코드 전수 수정)한다.

목표(불변): ① 턴별·모델별 토큰/비용을 SDK result 에서 추출 → ② DB 표준 테이블에 저장 → ③ 컨텍스트 % 계산 + 앱 시작 시 일/주/월 누적 비용을 backend 소유 + frontend 미러로 보유.

## main 이 이미 제공한 것 (재구현 금지)

| 원 기준 | main 상태 | 처리 |
|---|---|---|
| 턴별 추출(input/output/cache/cost·contextWindow) | ✅ `ProviderReportedTelemetry`(`shared/ipc.ts`)·`claude-map.ts`·`usage/usageMap.ts` | **재사용** |
| 턴 종료 저장 | ✅ `router.ts` telemetry → `insertUsageEvent`(+`hasContextTokens` 가드) | **새 스키마로 재배선** |
| Composer 컨텍스트 % 보정 | ✅ `contextWindow.ts`(`contextWindowFor` 200k/1M)·`telemetry.ts`(`contextTokens`)·`TelemetryPanel`·`nearCompaction`(autocompact 버퍼까지) | **건드리지 않음** |
| 모델별 분해 영속 | ⚠️ `modelUsage` 이벤트엔 있으나 **DB 미저장** | **잔여 — 자식 테이블** |
| 일/주/월 누적 + tracker + mirror | ❌ 전무(`sumUsageSince`/`CostTracker`/cost 채널 없음) | **잔여 — 신규** |

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조. **1·2·3 은 스키마 통일(리네임)**, **4~14 는 잔여 기능**.

1. **(스키마 통일) 신규 마이그레이션 `0006_turn_usage.sql`** — `0005_usage_events`(merge 됨=불변) 를 새 파일에서 리네임·분할:
   - `CREATE TABLE turn_usage(id INTEGER PK AUTOINCREMENT, session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL, message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL, input_tokens INTEGER, output_tokens INTEGER, cache_creation_input_tokens INTEGER, cache_read_input_tokens INTEGER, total_cost_usd REAL, created_at INTEGER NOT NULL)` — **`model` 컬럼 없음**(모델은 자식으로).
   - `CREATE TABLE turn_model_usage(id INTEGER PK AUTOINCREMENT, turn_usage_id INTEGER NOT NULL REFERENCES turn_usage(id) ON DELETE CASCADE, model TEXT NOT NULL, input_tokens INTEGER, output_tokens INTEGER, cache_creation_input_tokens INTEGER, cache_read_input_tokens INTEGER, cost_usd REAL)`.
   - **데이터 이관(id 보존)**: `INSERT INTO turn_usage(id, session_id, message_id, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, total_cost_usd, created_at) SELECT id, session_id, NULL, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, cost_usd, created_at FROM usage_events;` → `INSERT INTO turn_model_usage(turn_usage_id, model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cost_usd) SELECT id, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, cost_usd FROM usage_events WHERE model IS NOT NULL;`
   - 인덱스: `idx_turn_usage_created`(created_at), `idx_turn_usage_session`(session_id — `getLatestTurnUsage` 복원 쿼리용, **유지**), `idx_turn_model_usage_turn`(turn_usage_id).
   - `DROP TABLE usage_events;`
   - **nullability**: 토큰/비용 컬럼은 main graceful(부분 보고 허용) 유지 위해 **nullable**(제시안의 NOT NULL 미채택 — 이관 안전·부분보고).
   - `migrate.ts`: `migration0006` import + `MIGRATIONS` 배열 등록.
2. **(타입 통일) `db/types.ts`** — `UsageEventInsert`/`UsageRow` 제거, `TurnUsageInsert`/`TurnUsageRow`(camelCase: `messageId`·`cacheCreationInputTokens`·`cacheReadInputTokens`·`totalCostUsd`) + `TurnModelUsageInsert`/`TurnModelUsageRow` + `UsageSumRow`(sum 결과) 추가.
3. **(쿼리 재배선) `db/queries.ts`** — prepared statement·메서드 갱신: `insertUsageEvent`→`insertTurnUsage(row): number`(lastInsertRowid 반환), 신규 `insertTurnModelUsage(row): void`, `getLatestUsage`→`getLatestTurnUsage(sessionId)`(turn_usage 최신 1행 + `turn_model_usage` 조인으로 **primary model**(max input_tokens) 과 `modelUsage` 재구성), 신규 `sumUsageSince(sinceMs)`(`turn_usage WHERE created_at >= @since` 의 `COALESCE(SUM(total_cost_usd),0)` 등).
4. **(usageMap 재배선) `usage/usageMap.ts`** — `usageRowToTelemetry` 를 `TurnUsageRow`(+자식 rows)→`ProviderReportedTelemetry` 로. `model` 은 primary 자식, `modelUsage` 는 전 자식에서 재구성(`contextWindowFor(model)` 윈도우 판정 보존). `hasContextTokens`(입력이 `ProviderReportedTelemetry`)는 불변.
5. **(모델별 저장) `ipc/router.ts` telemetry case** — 가드 `turn.dbSessionId && u && hasContextTokens(u)` 유지. `insertTurnUsage({ sessionId, messageId: turn.currentAssistantMessageId, inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens, totalCostUsd: u.costUsd, createdAt: now })` → 반환 id 로 `Object.entries(u.modelUsage ?? {})` 각각 `insertTurnModelUsage`. 직후 `cost.recordAndBroadcast()`. 세션 로드부 `getLatestUsage`→`getLatestTurnUsage`.
6. **(경계 순수함수) `src/main/cost/boundaries.ts`** — `boundaries(now): { dayStart, weekStart, monthStart }` 로컬타임 epoch ms (단위 테스트 대상).
7. **(backend 싱글턴) `src/main/cost/tracker.ts`** — `CostTracker`(`SettingsStore` 동형): `summary: CostSummary` 캐시, `recompute()`(`boundaries(Date.now())` → `sumUsageSince` ×3), `recordAndBroadcast()`(recompute 후 전 `webContents` 에 `cost:summaryEvent` push — `router.ts` runtime status broadcast 패턴 복제), `getSummary()`.
8. **(router 배선)** — `cost` 인스턴스(db 주입, `extensions` 동형으로 `start()` 에서 생성), `start()` 부팅 시 `cost.recompute()` 1회, `register()` 에 `ipcMain.handle(CHANNELS.costSummary, () => this.cost.getSummary())`.
9. **(IPC 타입/채널) `shared/ipc.ts`** — `CostSummary` 타입 + `CHANNELS.costSummary`('orca:cost:summary') + `CHANNELS.costSummaryEvent`('orca:cost:summaryEvent'). (35 → 37 채널)
10. **(브리지) `preload/index.ts` + `renderer/.../shared/api/ipc.ts`** — `cost.summary()` invoke + `cost.onSummary(handler)` 구독(`runtime` 블록 동형, unsubscribe 반환).
11. **(frontend mirror) 신규 `renderer/.../features/cost/`** — `CostProvider` + `useCost()`: 마운트 시 `costApi.summary()` fetch → 초기화, `costApi.onSummary()` 구독 → push 갱신. `App.tsx` Provider 합성에 `<CostProvider>` 추가. **UI 없음**(seam 까지).
12. **(테스트)** — `cost/boundaries.test.ts` 신규(고정 timestamp 주입 → day/week/month 경계) + persist/queries 의 `modelUsage`→`turn_model_usage` 매핑 + `getLatestTurnUsage` 재구성 + `sumUsageSince` 단위. 기존 `usageMap`/`claude-map` 테스트는 새 스키마로 갱신.
13. **(게이트)** — `cd app && npm run lint && npm run typecheck && npm test` 회귀 0. `features/cost` 는 `shared` 만 의존(boundaries 위반 0).
14. **(계약 문서) `docs/IPC_CONTRACT.md`** — +2 채널(cost:summary·cost:summaryEvent) + `session:load` 행의 `lastTelemetry`(usage_events→turn_usage) 문구 갱신 + §6 변경 절차.

## 범위 / 비범위

- **범위**: 스키마 제시안 통일(리네임+분할+이관) · 모델별 영속 · 일/주/월 누적(main 싱글턴 + renderer Context 미러) · 그에 딸린 파생 코드 전수 수정.
- **비범위**: 턴별 추출·턴 저장 자체·Composer 컨텍스트 % 보정(**main 완료** — 재구현 금지). 누적/모델별 분해를 **표시하는 UI**(seam 까지). autocompact 경고는 main 이 이미 구현. 이벤트 DTO(`ProviderReportedTelemetry`) 네이밍 변경(통일은 **DB 계층 한정** — 이벤트 DTO 까지 넓히면 완료된 3-1 광범위 재수정이라 제외). Zustand(Phase 4 진입 묶음, `arch/frontend/state.md §1.4`).

## 설계 — 전역 상태(누적 비용) 라이브러리

**새 라이브러리 도입 안 함.** AGENTS.md "SSOT 는 DB" — 누적 비용은 `turn_usage` SQL `SUM` 으로 파생. main 계산 → push, renderer 읽기전용 미러(이미 `runtime:statusEvent` broadcast 동형). main = 모듈 싱글턴(`SettingsStore`·`db/index.ts` 동형), renderer = React Context(`App.tsx:11-23` 합성 동형). Zustand 는 현 페이즈 금지.

## 핵심 reconciliation (원 제시안 ↔ main 현실)

- `0005_usage_events.sql` merge 됨 → 파일 수정 금지(`app/AGENTS.md`). 리네임·분할은 **신규 `0006`** 에서(drop/recreate 는 새 파일에서 허용).
- 원 제시안 `turn_usage`(턴별 원장) ≡ main `usage_events` 의 역할. `total_cost_usd ↔ cost_usd`. **id 보존 이관**으로 부모-자식 상관 단순화.
- 원 제시안 `turn_model_usage`(모델별) = 신규 자식 테이블. main 이 못 한 모델별 영속을 채운다.
- `model` 이 turn_usage 에서 빠지므로 **복원 시 자식에서 primary model 재구성**(`getLatestTurnUsage`) — `TelemetryPanel`/도넛의 `contextWindowFor(model)` 윈도우 판정 보존.

## 영향 받는 파일

| 파일 | 변경 |
|---|---|
| `app/src/main/db/migrations/0006_turn_usage.sql` | 신규 (리네임+분할+이관+drop) |
| `app/src/main/db/migrate.ts` · `types.ts` · `queries.ts` | 0006 등록 · DTO 통일 · insert/get/sum 재배선 |
| `app/src/main/usage/usageMap.ts` (+`.test.ts`) | TurnUsageRow(+child)→telemetry 재구성 |
| `app/src/main/cost/{boundaries.ts,tracker.ts}` (+`boundaries.test.ts`) | 신규 (경계 순수함수 · 싱글턴) |
| `app/src/main/ipc/router.ts` | persist 모델별 + getLatestTurnUsage + CostTracker 배선 + 채널 handle |
| `app/src/shared/ipc.ts` | `CostSummary` 타입 · 2 채널 |
| `app/src/preload/index.ts` · `renderer/.../shared/api/ipc.ts` | `cost` 브리지/api |
| `app/src/renderer/.../features/cost/*` · `App.tsx` | CostProvider 미러 |
| `docs/IPC_CONTRACT.md` | +2 채널 · session:load 문구 · §6 |

## 참고 문서

- `docs/IPC_CONTRACT.md` (§6 — **반드시 동시 갱신**, +2 채널)
- `docs/arch/backend/provider-runtime.md §8` (`ProviderReportedTelemetry` 정본)
- `docs/arch/backend/persistence.md` · `app/AGENTS.md` (마이그레이션 불변 규약·레이어 경계)
- `docs/arch/frontend/state.md §1.4` (Zustand 금지)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규/갱신 테스트: `cost/boundaries.test.ts`(신규) · `usage/usageMap.test.ts`(스키마 갱신) · persist/queries 모델별·sum 단위.
- 레이어 경계: `features/cost` 는 `shared` 만 의존(boundaries 위반 0).

---

## [Codex 기입] 구현 체크리스트

- [x] 1: `0006_turn_usage.sql`(리네임+분할+이관+drop) + `migrate.ts` 등록
- [x] 2: `types.ts` DTO 통일(Turn*Insert/Row + UsageSumRow)
- [x] 3: `queries.ts` insertTurnUsage(id 반환)·insertTurnModelUsage·getLatestTurnUsage·sumUsageSince
- [x] 4: `usageMap.ts` 재구성(primary model + modelUsage) + 테스트 갱신
- [x] 5: `router.ts` persist 모델별 + getLatestTurnUsage + recordAndBroadcast
- [x] 6–8: `cost/{boundaries,tracker}.ts` + router 배선(부팅 recompute + handle)
- [x] 9–11: `shared/ipc.ts` 타입/채널 + preload/renderer 브리지 + `features/cost` + `App.tsx`
- [x] 12: 테스트(boundaries 신규 + 모델별/sum/usageMap 갱신)
- [x] 14: `docs/IPC_CONTRACT.md` +2 채널·session:load 갱신
- [x] 13: 게이트 `lint && typecheck && test`

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/db/migrations/0006_turn_usage.sql`, `app/src/main/db/{migrate,types,queries}.ts`, `app/src/main/usage/usageMap.ts`, `app/src/main/ipc/router.ts`, `app/src/main/cost/{boundaries,tracker}.ts`, `app/src/shared/{ipc,protocol}.ts`, `app/src/preload/index.ts`, `app/src/renderer/src/shared/api/ipc.ts`, `app/src/renderer/src/features/cost/**`, `app/src/renderer/src/App.tsx`, 관련 테스트, `docs/IPC_CONTRACT.md` |
| 실행 명령 | `cd app && npm run lint && npm run typecheck && npm test` |
| 게이트 결과 | lint 통과 / typecheck 통과 / test 통과(38 files, 260 tests) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `4213cad` |
