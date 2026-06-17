# Plan — 0029-main-simplify-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0029-main-simplify-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-06-17 |
| 매핑 | PHASES "main 정리/perf" 행 / PR #100 |
| 상태 | DRAFT → READY → IMPL_DONE |

## Context (왜)

`/simplify app/src/main` 을 4관점(재사용·단순화·효율·고도)으로 리뷰한 후속. main
프로세스 레이어(~10k LOC)에 **동작 변경 없는 정리**(중복 상수/헬퍼·장황한 구문)와,
1차에서 건너뛴 항목 중 사용자가 재요청한 **오탐 재평가 + 비-opencode 향후 설계 작업**을
적용한다. opencode 어댑터 도입용 일반화(`deploy('claude')`·`SUPPORTED_ENGINE`·
`claudeErrorClassifier` DI)는 사용자 지시로 **제외**.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능한 항목.

1. `adapters/claude-map.ts` 의 동일 `num` 타입가드 2개 정의를 모듈 스코프 1개로 통합.
2. `PROVIDER_NAME_RE`(`/^[A-Za-z0-9_-]+$/`) 정본을 `config/provider-key.ts` 로 단일화하고
   `deploy/deployer.ts`(+`MCP_KEY_RE`)·`settings/engine-write.ts`·`settings/provider-registry.ts`
   가 import 한다(로컬 중복 선언 제거).
3. `VAR_RE` 정본을 `mcp/expand.ts` 에서 export 하고 `mcp/store.ts` 가 import — 추가로
   `store.ts` 가 `authVarOf` 호출마다 `new RegExp(VAR_RE.source)` 를 재생성하던 것을
   모듈 레벨 비-global 상수 1회 생성으로 교체.
4. `DEFAULT_ORCA_CONFIG` 정본을 `config/orca-file.ts` 에서 export 하고 `config/orca-config.ts`
   가 import(로컬 중복 선언 제거).
5. `adapters/mock.ts` 의 수동 `AbortController` 병합 `combineSignals` 를 `AbortSignal.any` 로 축약.
6. `cost/tracker.ts` `recompute()` 가 `turn_usage` 를 3회 스캔(`sumUsageSince`×3)하던 것을
   **단일 조건부 집계 쿼리** `DbQueries.sumUsageByBoundaries` 1회 스캔으로 교체. 구
   `sumUsageSince` 제거. day/week/month 집계 결과는 기존과 동일(테스트로 보증).
7. `settings/provider-settings.ts` `ProviderSettingsService.list(adapter)` 가 어댑터별
   결과를 캐시하고, 무효화는 기존 `invalidateAll()`(engine add/update/delete·deploy)에 합류.
8. 재평가 무조치 명시: `ipc/chat/send.ts` 의 `requestApproval` 클로저는 `RouterContext` 가
   아니라 턴 수명 값 + 앱 수명 싱글턴만 캡처하고 `finally` 에서 해제됨 → 누수 아님(조치 없음).
   opencode 일반화·`env-merge` 의 `process.env` 복사는 범위 제외.
9. 게이트 4종(lint/typecheck/typecheck:test/test) 통과, 레이어 경계(boundaries+no-cycle) 위반 0,
   신규 의존성 0.

## 범위 / 비범위

- **범위**: `app/src/main` 내부 정리 + 위 7건 조치. 동작 의미 불변(perf·중복 제거).
- **비범위**: opencode 일반화(향후 어댑터 도입 시), `env-merge` `process.env` 복사(SDK
  `Options.env` 계약상 불가피), renderer/IPC/preload 변경(없음).

## 설계

- **재사용**: 중복 리터럴/헬퍼를 기존 L1 정본 모듈로 모은다 — `config/provider-key.ts`
  (provider key 어휘), `mcp/expand.ts`(`${VAR}` 패턴), `config/orca-file.ts`(orca.json I/O).
- **단일 스캔 집계**: `dayStart ≥ weekStart ≥ monthStart` 이므로 `WHERE created_at >= @monthStart`
  + 구간별 `COALESCE(SUM(CASE WHEN created_at >= @x THEN <col> END),0)` 로 3구간×5지표 동시 집계.
  반환 타입 `UsageByBoundaries`(`db/types.ts`). better-sqlite3 동기 — Promise.all 무관(오탐).
- **list 캐시**: `ProviderSettingsService` 에 `listCache: Map<adapter, ProviderEntry[]>`.
  `resolve()` 의 mtime 캐시와 동일 수명 정책(`invalidateAll()` 가 둘 다 비움). 트레이드오프:
  앱 밖 수동 편집 시 모델 *목록* 은 다음 engine 작업/재시작까지 stale(실제 턴 settings *blob* 은
  `resolve()` 가 mtime 으로 계속 재검증).
- **레이어 경계**: 모든 신규 import 는 동일 레이어(L1↔L1) 또는 하향. 새 상위참조·순환 0.

## 영향 받는 파일

- `app/src/main/adapters/claude-map.ts`, `adapters/mock.ts`
- `app/src/main/config/provider-key.ts`, `config/orca-file.ts`, `config/orca-config.ts`
- `app/src/main/deploy/deployer.ts`, `settings/engine-write.ts`, `settings/provider-registry.ts`
- `app/src/main/mcp/expand.ts`, `mcp/store.ts`
- `app/src/main/cost/tracker.ts`, `db/queries.ts`, `db/types.ts`
- `app/src/main/settings/provider-settings.ts`
- 테스트: `db/queries.test.ts`, `settings/provider-settings.test.ts`

## 참고 문서

- `app/src/main/AGENTS.md` (레이어 DAG — 정본 리터럴 허용 범위)
- IPC 변경 없음(채널 40 유지) → `IPC_CONTRACT.md` 갱신 불필요.

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `sumUsageByBoundaries`(day/week/month·null→0) day/week/month 등가성,
  provider `list` 캐시 히트(파일 미접근)·`invalidateAll()` 후 재열거.

---

## [Claude 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 16개(코드 14 + 테스트 2) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / typecheck:test ✅ / test ✅ **397/397**(better-sqlite3 Node ABI 재빌드 후 전체 green) |
| 신규 의존성 | 0 |
| 레이어 경계 | 위반 0(lint boundaries+no-cycle) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `4b50832`(1차 정리 5건) · `3c381b6`(2차 perf 2건) |
