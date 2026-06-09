# Plan — 0002-cost-token-tracking

> 비용·토큰 사용량 추적. opus-4-8 `/plan` 산출물을 핸드오프 규약으로 정형화. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0002-cost-token-tracking` |
| 작성자 | Claude Code (opus-4-8 /plan 산출물 정형화) |
| 일자 | 2026-06-09 |
| 매핑 | PHASES "현재 작업 중" → 완료 시 표 승격 |
| 상태 | READY |

## Context (왜)

Orca 는 매 채팅 턴 종료 시 `claude-agent-sdk` 의 `SDKResultMessage`(`type==="result"`) 를 받지만, 현재는 `input_tokens`/`output_tokens` 둘만 `telemetry` 이벤트로 매핑하고 **DB 에 저장하지 않는다**(`claude-map.ts:143-161`, `router.ts:513-517`). Composer 의 컨텍스트 사용량 도넛은 `inputTokens / 200_000`(하드코딩) 으로만 계산한다(`Composer.tsx:32,272`).

목표: ① 턴별·모델별 토큰/비용을 SDK result 에서 완전히 추출 → ② DB 표준 테이블에 저장 → ③ 프론트엔드가 `/context` 와 유사한 컨텍스트 % 계산 + 앱 시작 시 일/주/월 누적 비용을 backend 미러링으로 보유.

**중요 발견 — contextWindow 는 하드코딩 불필요.** SDK 의 `ModelUsage`(`sdk.d.ts:1119`) 가 모델별 `contextWindow` 를 실측으로 제공한다. `SDKResultMessage`(`sdk.d.ts:3334-3380`) 는 `usage`(snake_case: `input_tokens`/`output_tokens`/`cache_creation_input_tokens`/`cache_read_input_tokens`) · `total_cost_usd` · `modelUsage: Record<model, ModelUsage>`(camelCase + `costUSD` + `contextWindow`) 를 모두 노출한다. 요구사항의 모든 필드가 result 한 건에서 나온다.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 **검증 가능한** 항목.

1. **(1-1) 턴별 추출** — `claude-map.ts` 의 result 분기가 `msg.usage`(snake_case) · `msg.total_cost_usd` · `msg.modelUsage`(camelCase) 에서 `inputTokens`/`outputTokens`/`cacheCreationInputTokens`/`cacheReadInputTokens`/`totalCostUsd`/`contextWindow` 를 추출해 `telemetry.usage` 로 반환한다. `contextWindow` 는 `Object.values(modelUsage).map(m => m.contextWindow)` 의 최댓값(메인 모델 윈도우).
2. **(1-2) 모델별 추출** — 같은 분기가 `Object.entries(modelUsage)` 를 `usage.models[]`(model·4개 토큰·costUsd) 로 매핑한다. usage/modelUsage 부재 시 기존처럼 `{type:'telemetry'}` 만 반환(graceful).
3. **(1-3) DB 스키마** — 신규 마이그레이션 `0005_turn_usage.sql` 이 `turn_usage`(턴별 1행, FK `ON DELETE SET NULL`, `created_at` 비정규화) + `turn_model_usage`(모델당 1행, FK `ON DELETE CASCADE`) 2 테이블 + 인덱스 `idx_turn_usage_created`·`idx_turn_model_usage_turn` 를 생성한다. `contextWindow` 컬럼은 **제외**. `migrate.ts` 에 `0005` 등록.
4. **(2-1) 저장** — `router.ts` 의 `telemetry` case 가 reset **전에** `db.insertTurnUsage(...)` + 모델별 `db.insertTurnModelUsage(...)` 를 호출하고 `cost.recordAndBroadcast()` 로 누적 갱신·push 한다. `dbSessionId && ev.usage` 가드.
5. **(3-1) Composer % 보정** — 하드코딩 `CONTEXT_WINDOW = 200_000` 제거(부재 시 fallback 상수로만 유지). 도넛 ratio = `(inputTokens + cacheCreationInputTokens + cacheReadInputTokens) / contextWindow`. reducer 가 `pendingUsage` 스냅샷을 `telemetry` 에서 세팅, `SEND_USER_MESSAGE` 에서 리셋.
6. **(3-2) 누적 비용 backend 소유 + frontend 미러** — `src/main/cost/{boundaries.ts,tracker.ts}` 신규. `boundaries(now)` 가 로컬타임 day/week/month epoch ms 경계를 산출하는 순수 함수. `CostTracker` 싱글턴이 `recompute()`/`recordAndBroadcast()`/`getSummary()` 제공. 부팅 시 1회 `recompute()`, `cost:summary` invoke handler 등록, `cost:summaryEvent` broadcast.
7. **(3-2 미러) Renderer** — `cost.summary()` invoke + `cost.onSummary()` 구독 브리지(preload + renderer api). 신규 `features/cost/`(`CostProvider` + `useCost()`) 가 마운트 시 fetch + push 구독으로 미러. `App.tsx` Provider 합성에 추가. **UI 없음**(데이터/전역 변수 seam 까지만).
8. **테스트** — `claude-map.test.ts` 확장(full usage+modelUsage → telemetry 전체 필드, 기존 "usage 없음" 케이스 유지) + `cost/boundaries.test.ts` 신규(고정 timestamp 주입 → day/week/month 경계 검증).
9. **IPC 계약** — IPC 채널 +2(`orca:cost:summary`·`orca:cost:summaryEvent`) → `docs/IPC_CONTRACT.md`(현재 33채널 → 35) 갱신.
10. **게이트** — `cd app && npm run lint && npm run typecheck && npm test` 회귀 0. `features/cost` 는 `shared` 만 의존(boundaries 위반 0).

## 범위 / 비범위

- **범위**: SDK result 전체 추출 · DB 2 테이블 + 저장 · Composer % 실측 보정 · 누적 비용 main 싱글턴 + renderer Context 미러(데이터/seam).
- **비범위**: 누적 비용/모델별 분해를 **표시하는 UI**(요구상 seam 까지). autocompact buffer(~33k)·83.5% compaction 경고·`compact_boundary` 리셋(요구식 `used/contextWindow` 단순비 범위 밖, 후속 seam). per-session/per-message 비용 조회 인덱스(도입 시 추가). Zustand 도입(Phase 4 진입 PR 묶음 — 사전 마이그레이션 금지, `arch/frontend/state.md §1.4`).

## 설계

### 전역 상태(누적 비용)는 어떤 라이브러리로? — **새 라이브러리 도입 안 함**

누적 비용은 *backend 가 소유하고 frontend 가 미러링* 하는 게 맞는 설계이며 기존 idiom 으로 충분하다.

- **왜 backend 소유**: AGENTS.md 명시 결정 **"SSOT 는 DB"**. 누적 비용은 `turn_usage` SQL `SUM` 으로 *파생* — frontend 가 원본 보유 시 SSOT 분기. 이미 같은 패턴 존재: Python 런타임 상태를 main 이 계산해 `runtime:statusEvent` 로 broadcast(`router.ts:190-198`), renderer 미러. 누적 비용도 동일.
- **기존 idiom**: main = 모듈 싱글턴 클래스(`SettingsStore`·`PythonRuntime`·`db/index.ts` 동형, 라이브러리 0). renderer = React Context Provider(`TweakProvider`/`BackendProvider`/`SessionsProvider`, `App.tsx:11-23` 동형).
- **Zustand 금지**: 채택(`arch/frontend/state.md §1.4`)됐으나 **"Phase 4 진입 PR 묶음, Phase 3 사전 마이그레이션 금지"** 가 협의 결정. 지금 도입은 위반.

### 1-1 / 1-2. SDK result → 턴별 + 모델별 추출

**`src/shared/ipc.ts`** — `telemetry` NormalizedEvent 의 `usage` 확장(하위호환: 여전히 optional):

```ts
| {
    type: 'telemetry'
    sessionId: string
    provider: ProviderId
    usage?: {
      inputTokens: number
      outputTokens: number
      cacheCreationInputTokens: number
      cacheReadInputTokens: number
      totalCostUsd: number
      contextWindow: number          // 모델별 최대값(메인 에이전트 윈도우) — DB 미저장, % 계산용
      models: Array<{                // 1-2 모델별
        model: string
        inputTokens: number
        outputTokens: number
        cacheCreationInputTokens: number
        cacheReadInputTokens: number
        costUsd: number
      }>
    }
  }
```

**`src/main/adapters/claude-map.ts:143-161`** — result 분기 확장. `msg.usage`(snake_case)·`msg.total_cost_usd`·`msg.modelUsage`(camelCase) 3곳에서 읽는다. `contextWindow` = `Object.values(modelUsage).map(m => m.contextWindow)` 최댓값(서브에이전트 Haiku 의 작은 윈도우가 아니라 메인 모델 윈도우). `models` = `Object.entries(modelUsage)` 매핑. usage/modelUsage 부재 시 `{type:'telemetry'}` 만(graceful).

### 1-3 + 2-1. DB 표준 테이블 + 저장

**새 마이그레이션 `src/main/db/migrations/0005_turn_usage.sql`** (4자리 zero-pad, 기존 `0004` 다음). `contextWindow` 는 **제외**.

**삭제 정책 — 비용은 원본보다 오래 산다.** session/message 삭제돼도 비용 기록 보존 → 두 FK 는 **`ON DELETE SET NULL`**(CASCADE 아님). `created_at` 을 `turn_usage` 에 비정규화 → 부모 행이 사라져도 일/주/월 집계 자립. `message_id` 는 살아있는 동안 `messages.created_at` 과 조인 가능, 죽으면 NULL.

```sql
-- 1-1: 턴별 1행. 비용은 세션/메시지 삭제 후에도 보존(SET NULL). created_at 비정규화로 집계 자립.
CREATE TABLE turn_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,      -- nullable: 세션 삭제 후에도 행 보존
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,   -- 턴의 assistant 메시지(살아있으면 join 가능)
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_creation_input_tokens INTEGER NOT NULL,
  cache_read_input_tokens INTEGER NOT NULL,
  total_cost_usd REAL NOT NULL,                                    -- SDK 의 턴 전체 총비용(모든 모델 합산본 — 권위값)
  created_at INTEGER NOT NULL
);
-- 유일하게 입증된 hot path: 3-2 의 일/주/월 SUM 이 `WHERE created_at >= ?` 범위 스캔(부팅 1회 + 매 턴 broadcast 시 3회).
CREATE INDEX idx_turn_usage_created ON turn_usage(created_at);

-- 1-2: 한 턴이 여러 모델을 쓰면(메인 Opus + 서브에이전트 Haiku 등) 모델당 1행. (turn_usage_id, model) = 턴×모델 조합.
-- 컬럼 대응: 4개 토큰 컬럼은 turn_usage 와 1:1 동일. 비용은 turn_usage.total_cost_usd(턴 총합) ↔ 여기 cost_usd(모델별 분해).
--   total_cost_usd = Σ cost_usd 관계. 일/주/월 합은 turn_usage 만 쓴다(중복합산 금지).
CREATE TABLE turn_model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turn_usage_id INTEGER NOT NULL REFERENCES turn_usage(id) ON DELETE CASCADE,  -- 부모 턴 삭제 시 분해 동반(턴 자체는 위 정책상 삭제 안 됨)
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,                  -- ↔ turn_usage.input_tokens
  output_tokens INTEGER NOT NULL,                 -- ↔ turn_usage.output_tokens
  cache_creation_input_tokens INTEGER NOT NULL,   -- ↔ turn_usage.cache_creation_input_tokens
  cache_read_input_tokens INTEGER NOT NULL,       -- ↔ turn_usage.cache_read_input_tokens
  cost_usd REAL NOT NULL                          -- ↔ turn_usage.total_cost_usd 의 모델별 분해
);
-- FK 조회용: 한 턴의 모델 분해를 turn_usage_id 로 되읽을 때. FK 컬럼 인덱싱 관례.
CREATE INDEX idx_turn_model_usage_turn ON turn_model_usage(turn_usage_id);
```

**인덱스 산정 근거** (투기적 인덱스 2개 제거):

| 인덱스 | 어떤 쿼리/상황 | 판단 |
|---|---|---|
| `idx_turn_usage_created` | 3-2 일/주/월 `SUM(...) WHERE created_at >= 경계`. 부팅 + 매 턴 broadcast 마다 3회 — **유일한 입증된 hot path** | **유지** |
| `idx_turn_model_usage_turn` | 부모 턴의 모델 분해 되읽기(FK 컬럼). 현재 insert 전용이나 모델별 표시 seam + FK 관례 | **유지(경량)** |
| ~~`idx_turn_usage_session`~~ | session 별 비용 조회 쿼리 *현재 없음* | **제거** — per-session 비용 UI 도입 시 추가 |
| ~~`idx_turn_usage_message`~~ | message_id 역조회. created_at 비정규화로 집계용 join 불요 | **제거** — per-message 비용 상관 도입 시 추가 |

**`src/main/db/migrate.ts`** — `migration0005` import + `MIGRATIONS` 배열에 `{ name: '0005_turn_usage', sql: migration0005 }` 추가.

**`src/main/db/types.ts`** — `TurnUsageInsert`(camelCase) + `TurnModelUsageInsert` + 집계 결과 row 타입.

**`src/main/db/queries.ts`** — 생성자 prepared statement + 공개 메서드:
- `insertTurnUsage(row): number`(lastInsertRowid 반환)
- `insertTurnModelUsage(row): void`
- `sumUsageSince(sinceMs): { totalCostUsd, inputTokens, outputTokens, cacheCreation, cacheRead }` — `WHERE created_at >= @since` SUM. `COALESCE(SUM(...),0)` 로 빈 결과 0 보장.

**`src/main/ipc/router.ts:513-517`** — `telemetry` case 에서 reset **전에** insert:

```ts
case 'telemetry': {
  if (turn.dbSessionId && ev.usage) {
    const u = ev.usage
    const usageId = this.db.insertTurnUsage({
      sessionId: turn.dbSessionId,
      messageId: turn.currentAssistantMessageId,   // null 가능(FK nullable)
      inputTokens: u.inputTokens, outputTokens: u.outputTokens,
      cacheCreationInputTokens: u.cacheCreationInputTokens,
      cacheReadInputTokens: u.cacheReadInputTokens,
      totalCostUsd: u.totalCostUsd, createdAt: now
    })
    for (const m of u.models) this.db.insertTurnModelUsage({ turnUsageId: usageId, ...m })
    this.cost.recordAndBroadcast()   // 누적 갱신 + push (3-2)
  }
  turn.currentAssistantMessageId = null
  turn.assistantText = ''
  break
}
```

### 3-1. Composer 컨텍스트 % 보정

**`src/renderer/.../reducer/chatReducer.ts`** — `pendingInputTokens?: number` 를 풍부한 스냅샷으로 교체(또는 병행):

```ts
pendingUsage?: { inputTokens; cacheCreationInputTokens; cacheReadInputTokens; contextWindow }
```

`telemetry` case(228-250) 에서 `ev.usage` 로 세팅, `SEND_USER_MESSAGE`(147-160) 에서 `undefined` 리셋(기존 동작 유지).

**`src/renderer/.../components/Composer.tsx:32,272-278`** — 하드코딩 `CONTEXT_WINDOW = 200_000` 제거(부재 시 fallback 상수로만 유지). 도넛 ratio:

```
used = inputTokens + cacheCreationInputTokens + cacheReadInputTokens
ratio = used / contextWindow          // 요구식: (… ) / contextWindow * 100
```

### 3-2. 앱 시작 시 일/주/월 누적 (backend 소유 + frontend 미러)

**달력 경계** — main 에서 로컬타임 기준 오늘 00:00 / 이번주 시작 / 이번달 1일 의 epoch ms 를 계산하는 **순수 함수**로 분리(단위 테스트 대상): `src/main/cost/boundaries.ts` → `{ dayStart, weekStart, monthStart }(now)`.

**`src/main/cost/tracker.ts`** (싱글턴 클래스, `SettingsStore` 동형) — 전역 변수 역할:
- `summary: CostSummary = { day, week, month }`(각: `{ costUsd, inputTokens, outputTokens, cacheCreation, cacheRead }`) 캐시.
- `recompute()`: `boundaries(Date.now())` → `db.sumUsageSince(dayStart/weekStart/monthStart)` 3회 → `summary` 갱신.
- `recordAndBroadcast()`: `recompute()` 후 모든 `webContents` 에 `cost:summaryEvent` push(`runtime:statusEvent` 패턴 복제).
- `getSummary()`: 현재 캐시 반환.

**`src/shared/ipc.ts`** — `CostSummary` 타입 + `CHANNELS.costSummary`('orca:cost:summary') + `CHANNELS.costSummaryEvent`('orca:cost:summaryEvent').

**`src/main/ipc/router.ts`** — `private readonly cost`(db 는 `start()` 에서 initDb 후 주입 — `extensions` 동형). `register()` 에 `ipcMain.handle(CHANNELS.costSummary, () => this.cost.getSummary())`. `start()` 에서 부팅 시 `this.cost.recompute()` 1회.

**`src/preload/index.ts`** + **`src/renderer/.../shared/api/ipc.ts`** — `cost.summary()` invoke + `cost.onSummary(handler)` 구독(`runtime` 블록 동형).

**`src/renderer/.../features/cost/`** (새 feature) — `CostProvider` + `useCost()`:
- 마운트 시 `costApi.summary()` 1회 fetch → 상태 초기화.
- `costApi.onSummary()` 구독 → push 마다 갱신.
- **`App.tsx`** Provider 합성에 `<CostProvider>` 추가.
- (**UI 없음** — 데이터/전역 변수까지만. `useCost()` 는 향후 표시용 seam.)

### 재사용할 기존 함수·유틸·파일 경로

- broadcast 패턴: `router.ts:190-198`(runtime status).
- 싱글턴 패턴: `settings/store.ts`, `db/index.ts`.
- Provider 패턴: `features/chat/providers/ChatProvider.tsx`, `App.tsx:11-23`.
- prepared-statement 패턴: `queries.ts` 생성자 + 공개 메서드.

### 레이어 경계 준수

- `features/cost` 는 `shared` 만 의존(ESLint boundaries). cross-feature 데이터 불필요.
- main 신규 `src/main/cost/` 는 `db` 싱글턴만 의존, 신규 npm 의존성 0.

## 영향 받는 파일

| 파일 | 변경 |
|---|---|
| `app/src/shared/ipc.ts` | `telemetry.usage` 확장 · `CostSummary` 타입 · 2 채널 |
| `app/src/main/adapters/claude-map.ts` | result → 전체 usage/modelUsage/cost 추출 |
| `app/src/main/db/migrations/0005_turn_usage.sql` | 신규 (2 테이블) |
| `app/src/main/db/migrate.ts` · `types.ts` · `queries.ts` | 0005 등록 · DTO · insert/sum 쿼리 |
| `app/src/main/cost/{boundaries.ts,tracker.ts}` | 신규 (경계 순수함수 · 싱글턴) |
| `app/src/main/ipc/router.ts` | telemetry persist · CostTracker 배선 · 채널 handle |
| `app/src/preload/index.ts` · `renderer/.../shared/api/ipc.ts` | `cost` 브리지/api |
| `app/src/renderer/.../features/chat/reducer/chatReducer.ts` · `components/Composer.tsx` | pendingUsage · % 보정 |
| `app/src/renderer/.../features/cost/*` · `App.tsx` | CostProvider 미러 |
| `app/src/main/adapters/claude-map.test.ts` · `src/main/cost/boundaries.test.ts` | 테스트 확장/신규 |
| `docs/IPC_CONTRACT.md` | +2 채널 (33 → 35), §6 변경 절차 동시 갱신 |

## 참고 문서

- `docs/IPC_CONTRACT.md` (§6 변경 절차 — **반드시 동시 갱신**, +2 채널)
- `docs/arch/frontend/state.md §1.4` (Zustand 사전 마이그레이션 금지)
- `docs/arch/backend/provider-runtime.md` (`NormalizedEvent`·Telemetry 정본)
- `app/AGENTS.md` (마이그레이션 규약·의존성 정책·레이어 경계)
- SDK 타입: `sdk.d.ts:1119`(`ModelUsage`), `sdk.d.ts:3334-3380`(`SDKResultMessage`)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구:
  - `claude-map.test.ts` 확장 — result(full usage + modelUsage) → telemetry 전체 필드 매핑. 기존 "usage 없음" 케이스 유지.
  - `cost/boundaries.test.ts` 신규 — 고정 timestamp(인자 주입) 로 day/week/month 경계 산출 검증.
- 레이어 경계: `features/cost` 는 `shared` 만 의존(boundaries 위반 0).

---

## [Codex 기입] 구현 체크리스트

- [x] 1-1/1-2: `shared/ipc.ts` telemetry.usage 확장 + `claude-map.ts` result 추출
- [x] 1-3: `0005_turn_usage.sql` (2 테이블 + 2 인덱스) + `migrate.ts` 등록
- [x] 2-1: `types.ts`/`queries.ts` DTO·insert·sum + `router.ts` telemetry persist
- [x] 3-1: `chatReducer.ts` pendingUsage + `Composer.tsx` % 보정
- [x] 3-2: `cost/{boundaries,tracker}.ts` + router 배선 + preload/renderer 브리지 + `features/cost` + `App.tsx`
- [x] 테스트: `claude-map.test.ts` 확장 + `boundaries.test.ts` 신규
- [x] `docs/IPC_CONTRACT.md` +2 채널 갱신
- [x] 게이트: `npm run lint && npm run typecheck && npm test`

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/shared/ipc.ts`, `app/src/main/adapters/claude-map.ts`, `app/src/main/db/**`, `app/src/main/cost/**`, `app/src/main/ipc/router.ts`, `app/src/preload/index.ts`, `app/src/renderer/src/**`, `docs/IPC_CONTRACT.md` |
| 실행 명령 | `cd app && npm run lint && npm run typecheck && npm test` |
| 게이트 결과 | PASS — lint/typecheck/vitest 224개 테스트 통과 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(이번 커밋)` |

- 변경 파일:
  - `app/src/shared/ipc.ts`, `app/src/main/adapters/claude-map.ts`: SDK result usage/modelUsage/cost/contextWindow 정규화.
  - `app/src/main/db/migrations/0005_turn_usage.sql`, `migrate.ts`, `types.ts`, `queries.ts`: 턴/모델별 usage 저장 및 합계 쿼리.
  - `app/src/main/cost/{boundaries.ts,tracker.ts}`, `app/src/main/ipc/router.ts`: 비용 합계 main 싱글턴, 부팅 recompute, telemetry 저장 후 broadcast.
  - `app/src/preload/index.ts`, `app/src/renderer/src/shared/api/ipc.ts`, `app/src/renderer/src/features/cost/*`, `app/src/renderer/src/App.tsx`: cost summary invoke/push 브리지와 renderer Provider 미러.
  - `app/src/renderer/src/features/chat/reducer/chatReducer.ts`, `app/src/renderer/src/features/chat/components/Composer.tsx`: pendingUsage 스냅샷과 contextWindow 기반 도넛 비율.
  - `app/src/main/adapters/claude-map.test.ts`, `app/src/main/cost/boundaries.test.ts`, `app/src/renderer/src/features/chat/reducer/chatReducer.parts.test.ts`: usage/boundary/reducer 회귀 테스트.
  - `docs/IPC_CONTRACT.md`: 채널 35개 및 cost 채널 계약 반영.
- 게이트 결과:
  - PASS: `cd app && npm run lint && npm run typecheck && npm test`
- 블로커: 없음.
