# Verify — 0029-main-simplify-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0029-main-simplify-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-06-17 |
| 대상 커밋 | `4b50832`(1차) · `3c381b6`(2차) |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `num` 중복 → 모듈 스코프 1개 | ✅ | `adapters/claude-map.ts` 모듈 스코프 `num` 1개, 두 함수 내부 인라인 정의 제거 |
| 2 | `PROVIDER_NAME_RE` 정본화 + 3 importer | ✅ | `config/provider-key.ts` `export const PROVIDER_NAME_RE`; `deployer.ts`(`MCP_KEY_RE = PROVIDER_NAME_RE`·L30)·`engine-write.ts`·`provider-registry.ts` import, 로컬 선언 0 |
| 3 | `VAR_RE` 정본 + 재컴파일 제거 | ✅ | `mcp/expand.ts` `export const VAR_RE`; `mcp/store.ts` import + 모듈 레벨 `VAR_NAME_RE = new RegExp(VAR_RE.source)` 1회 생성, 루프 내 `.exec` |
| 4 | `DEFAULT_ORCA_CONFIG` 정본화 | ✅ | `config/orca-file.ts` `export const DEFAULT_ORCA_CONFIG`; `config/orca-config.ts` import, 로컬 선언 제거 |
| 5 | `combineSignals` → `AbortSignal.any` | ✅ | `adapters/mock.ts` `return a ? AbortSignal.any([a, b]) : b`(13줄→2줄) |
| 6 | 단일 스캔 집계, 결과 동등 | ✅ | `db/queries.ts` `sumUsageByBoundaries`(조건부 SUM, `WHERE created_at >= @monthStart`) + `cost/tracker.ts` 단일 호출; 구 `sumUsageSince` 제거; `db/queries.test.ts` day/week/month·null→0 등가 테스트 통과 |
| 7 | `list()` 캐시 + `invalidateAll` 합류 | ✅ | `settings/provider-settings.ts` `listCache: Map`, `list()` 히트 반환, `invalidateAll()` 가 `listCache.clear()` 호출; `provider-settings.test.ts` 캐시 히트·무효화 후 재열거 테스트 통과 |
| 8 | 무조치 항목 명시 | ✅ | `requestApproval`(`send.ts:199-238`) 자유변수 = `turn`·`controller`·`wc`(턴 수명) + `approvals`·`persistence`·`sendChatEvent`(앱 싱글턴); `ctx`/`turns` 미캡처 → 누수 아님. opencode 일반화·`process.env` 복사 미변경 |
| 9 | 게이트 통과·경계 0·의존성 0 | ✅ | 아래 게이트 출력. boundaries/no-cycle 위반 0, 신규 의존성 0 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 397/397 통과 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 충족 |
| 레이어 경계 위반 0 | ✅ | — | boundaries+no-cycle 0 |
| 문서 형식/링크/한국어 | ✅ | — | 본 문서 |
| AGENTS.md 위생 스캔 | ✅ | ✅ 최종 판단 | AGENTS.md 변경 없음 — N/A |
| 동작 동등성(perf 무회귀) | ✅ 보조(테스트) | ✅ 실기 결정 | day/week/month 집계 테스트로 동등 확인 |
| 외부 편집 staleness 트레이드오프 수용 | ✖ 옵션 제시 | ✅ 결정 | 사람 확인 대기(plan §설계) |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기(PR #100) |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
> eslint --cache --fix ./src                       # 위반 0
> tsc --noEmit -p tsconfig.node.json               # ✅
> tsc --noEmit -p tsconfig.web.json                # ✅
> tsc --noEmit -p tsconfig.test.json               # ✅
> vitest run
 Test Files  54 passed (54)
      Tests  397 passed (397)
```

> 비고: `db/queries.test.ts` 는 better-sqlite3 네이티브 모듈 필요 — 환경에서
> `npm rebuild better-sqlite3`(Node ABI) 선행 후 전체 green(0019 dual-ABI 클래스, 본 변경 무관).

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 변경 없음 → 키/토큰/이메일/IP 스캔 N/A.

## PHASES.md 정합성

- "페이즈 표" 에 정리/perf 행 1건 추가(PR #100·커밋 `4b50832`/`3c381b6`). 형식 기존 handoff 행과 동일.

## 결론 / 다음 단계

- 상태: **PASS** — PHASES 승격 완료. PR #100(draft) 머지 승인은 사람.
- 사람 확인 대기: 외부 수동 편집 시 모델 목록 staleness 정책 수용 여부, 실환경 cost 패널·모델 선택 회귀.
