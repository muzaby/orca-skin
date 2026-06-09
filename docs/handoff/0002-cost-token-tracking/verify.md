# Verify — 0002-cost-token-tracking

> plan 의 인수 기준(1~14)을 1:1 대조한 검증 보고. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0002-cost-token-tracking` |
| 검증자 | Claude Code |
| 일자 | 2026-06-09 |
| 대상 커밋 | `999c99b` (INDEX 기재 `4213cad` 는 rebase/amend 전 해시 — 본 브랜치 부재. 아래 위생 노트 ①) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `0006_turn_usage.sql` 리네임+분할+id보존 이관+drop, nullable, 인덱스 3종, `migrate.ts` 등록 | ✅ | `migrations/0006_turn_usage.sql:3-73`(turn_usage·turn_model_usage CREATE, `usage_events`→두 테이블 SELECT 이관, `idx_turn_usage_created/_session`·`idx_turn_model_usage_turn`, `DROP TABLE usage_events`). 토큰/비용 컬럼 nullable 유지. `migrate.ts:7,20`(import + MIGRATIONS 등록). 테스트 `queries.test.ts:42`(이관·drop 검증) |
| 2 | `db/types.ts` DTO 통일 — `TurnUsage/TurnModelUsage Insert·Row`(camelCase) + `UsageSumRow`, 구 `UsageEvent/UsageRow` 제거 | ✅ | `db/types.ts:41-91`(4 DTO + `UsageSumRow`). 구 타입 잔존 0 (`grep UsageEventInsert\|UsageRow` 무매치) |
| 3 | `db/queries.ts` 재배선 — `insertTurnUsage→id`·`insertTurnModelUsage`·`getLatestTurnUsage`(부모+자식 primary 재구성)·`sumUsageSince` | ✅ | `queries.ts:252-275`(메서드), `:115-149`(prepared: insert 2종 + `getLatestTurnUsageStmt` + `listTurnModelUsageStmt`(input_tokens DESC) + `sumUsageSinceStmt` COALESCE SUM). 테스트 `queries.test.ts:81/112/160` |
| 4 | `usage/usageMap.ts` — `(TurnUsageRow + 자식 rows)→ProviderReportedTelemetry`, primary model, modelUsage 재구성, `hasContextTokens` 불변 | ✅ | `usageMap.ts:13-54`(재구성 + `primaryModel`=max input_tokens), `:7-11`(hasContextTokens 불변). 테스트 `usageMap.test.ts:31/51/60` |
| 5 | `router.ts` telemetry case — 가드 유지, `insertTurnUsage`+모델별 `insertTurnModelUsage`+`recordAndBroadcast`, 세션 로드 `getLatestTurnUsage` | ✅ | `router.ts:520-561`(가드 `dbSessionId && u && hasContextTokens`, 부모 insert→모델별 insert + `u.model` 단일 폴백→`cost.recordAndBroadcast()`), `:654-655`(load 시 getLatestTurnUsage→usageRowToTelemetry) |
| 6 | `cost/boundaries.ts` — `boundaries(now)` day/week/month 로컬 epoch ms | ✅ | `cost/boundaries.ts:8-16`(week=월요일). 테스트 `boundaries.test.ts:5,14`(고정 ts + 일요일 경계) |
| 7 | `cost/tracker.ts` — `CostTracker`: summary 캐시·`recompute`(boundaries×sumUsageSince)·`recordAndBroadcast`(webContents push)·`getSummary` | ✅ | `cost/tracker.ts:7-34`(전 메서드 + `costSummaryEvent` 브로드캐스트 `runtime` 패턴 복제) |
| 8 | router 배선 — `cost` 인스턴스(db 주입)·부팅 `recompute()`·`costSummary` handle | ✅ | `router.ts:123-124`(start: `new CostTracker(db)` + recompute), `:192`(register handle), `:774-776`(handleCostSummary) |
| 9 | `shared/ipc.ts` — `CostSummary`/`CostPeriodSummary` + 2 채널 | ✅ | `shared/ipc.ts:40-41`(costSummary·costSummaryEvent), `:50-63`(타입). ※ plan 의 "35→37" 은 base 오기 — 실제 33→**35**(`IPC_CONTRACT.md:19` 총 35, 분포 합 35 정합). 채널 2개 추가는 정확 |
| 10 | preload + renderer ipc — `cost.summary()` + `cost.onSummary()` | ✅ | `preload/index.ts:106-112`(invoke+on/off unsub), `renderer/.../shared/api/ipc.ts:88-92`(costApi) |
| 11 | `features/cost/` — `CostProvider`+`useCost`, `App.tsx` 합성, UI 없음 | ✅ | `features/cost/providers/{CostProvider.tsx,costContext.ts}`(fetch+구독 미러), `App.tsx:7,17-21`(`<CostProvider>` 합성). 표시 UI 0 |
| 12 | 테스트 — boundaries 신규 + queries(이관·turn usage·sum) + usageMap 갱신 | ✅ | `boundaries.test.ts`(2) · `queries.test.ts`(0006 migration + turn usage 3) · `usageMap.test.ts`(재구성·primary·graceful·hasContextTokens) |
| 13 | 게이트 회귀 0 + `features/cost` 는 shared 만 의존 | ✅ | lint/typecheck/test 전부 통과(아래). `features/cost` import = shared/api·shared/ipc·react·동일 feature 만(타-feature 0) |
| 14 | `IPC_CONTRACT.md` +2 채널 + session:load 문구 + §6 | ✅ | `IPC_CONTRACT.md:19,21`(총 35·cost 2), `:206-207`(cost 2행), `:91`(session:load `turn_usage`/`turn_model_usage` 재구성 문구), `:296`(§6 절차) |

**결과: 14/14 충족.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 통과 (260/260) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 14/14 (증거 위) |
| 레이어 경계 위반 0 | ✅ | — | `features/cost`=shared 만 (lint boundaries 통과) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT·PHASES 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 비밀/IP 0 (아래) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인(누적비용 추적 방향) |
| Open Questions | ✖ | ✅ | 해당 없음 |
| UI/UX 시각 검증 | ✖ | ✅ | **표시 UI 없음(seam)** — 시각 검증 대상 아님 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 (DB SUM 파생, 라이브러리 미도입) |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 |

## 게이트 재실행 결과

> 컨테이너가 fresh-clone 이라 `npm install` 후, better-sqlite3 가 postinstall 에서 **Electron ABI** 로 빌드되어 vitest(Node)에서 `Module did not self-register` 발생 → `npm rebuild better-sqlite3`(Node ABI)로 해소. **코드 결함 아님**(환경 재현 노트 ⑤).

```
$ npm run lint        → exit 0 (eslint --cache --fix ./src)
$ npm run typecheck   → exit 0 (typecheck:node + typecheck:web)
$ npm test            → Test Files 38 passed (38) / Tests 260 passed (260)
```

## 위생 검토

- **비밀/토큰/IP 스캔**(변경 `.ts/.tsx/.sql`): API key·secret·password·bearer·`sk-`·IPv4 패턴 매치 0.
- **잔여 `usage_events` 참조**: 모두 정당 — `0006`(이관 소스 SELECT/DROP) · `0005_usage_events.sql`(불변 merge 마이그레이션, 미수정) · `queries.test.ts`(이관 시드/검증) · `migrate.ts`(0005 배열 등록). 코드 API 레벨(queries/types/router/usageMap)엔 구 어휘 잔존 0 — 완전 리네임.
- **AGENTS.md 변경 없음** — 위생 위반 가능성 해당 없음.

## PHASES.md 정합성

- 형식: 기존 "Track C" 행과 동일 톤으로 표 1행 승격(범위·테스트수·브랜치). 완료 이력 정본은 `git log`.
- 커밋: `999c99b`(구현). 브랜치 `claude/handoff-protocol-next-stage-jjmgso`. PR 은 사용자 요청 시.

## 위생 노트 (비차단 — 다음 작업 참고)

1. **커밋 해시 불일치**: INDEX/plan 의 대상 커밋 `4213cad` 는 본 브랜치에 부재(rebase/amend 추정). 실 구현 커밋 `999c99b` 의 trailer 는 정상(`Agent: codex`·`Criteria-Met: 14/14`·`Verified-By: pending`). 본 verify 는 실 커밋 기준.
2. **구현 커밋 제목 컨벤션**: 구현 코드가 `docs(handoff): 비용 추적 구현 보고 갱신` 제목 커밋에 동봉됨 — 규약상 구현 커밋은 `feat|fix|refactor(scope)` 제목 권장. trailer 는 정확. (다음 사이클 참고)
3. **plan §9 "35→37 채널" 오기**: 실제 base 33 → **35**. IPC_CONTRACT 내부 정합(분포 합 35). 코드/문서는 옳다.
4. **`handleCostSummary` 주석 오타**(`router.ts:773` "현재 런타임 상태 조회") — runtime 핸들러 복붙 흔적. 동작 무관 cosmetic.
5. **better-sqlite3 ABI 재현 노트**: 게이트 재현 시 vitest 는 Node ABI 빌드 필요 — fresh 컨테이너에서 `npm rebuild better-sqlite3` 선행.

## 결론 / 다음 단계

- **PASS** — 14/14 인수 기준 충족, 게이트 회귀 0, 레이어 경계·위생 통과.
- `INDEX.md` → `verify/PASS`, 다음=`—`. `PHASES.md` 표 승격.
- 표시 UI(누적/모델별 분해 화면)는 plan 비범위(seam) — Future Scope "세션 통계 화면" 으로 이월.
