# Plan — 0111-weekly-usage-fixed-budget-external-reconcile

## 메타

| 항목 | 값 |
|---|---|
| slug | `0111-weekly-usage-fixed-budget-external-reconcile` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 |
| 매핑 | (PR 미생성) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | 주간 버짓의 동적 런웨이 방식이 계속 변해 추적이 어렵다 → 고정값으로 | 라이브 세션 요청 |
| 명시 요구 2 | 월간 총 사용량(외부 권위)을 주/일 사용량에 보정하라(외부 사용분 추적) | 라이브 세션 요청 |
| 명시 요구 3 | 외부 fetch 실패 시 이전 기준치 기준으로 로컬 추정치 사용, 재성공 시 복구 | 라이브 세션 요청 |
| 확정 결정 1 | 주간 버짓 = 월 한도 일할 고정(`limitUsd × 7/이달일수`), 경계 주는 이달 몫만 | 라이브 세션 AskUserQuestion 응답 |
| 확정 결정 2 | 외부=총액 진실, 로컬=분포 추정 → fresh 시 비례 스케일 | 라이브 세션 응답 |

## Context (왜)

주간 사용률(weekPct)의 분모가 남은 예산·경과일에 의존해 계속 움직여 추적이 어려웠다.
또한 외부 권위 월간 총액은 Orca+외부 사용을 모두 포함하는데 주/일은 Orca 로컬 추정치라 과소
표시됐고, 오프라인(외부 fetch 실패) 시 동작이 정의되지 않았다. 이를 세 축으로 정리한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 주간 버짓 계산 SSOT(구 런웨이 공식) | `app/src/shared/usage/limits.ts` `computeUsageLimits` |
| 주/월/경계 시간 유틸(월요일 시작, 오늘 포함) | `app/src/shared/time/clock.ts` |
| 외부 리포트는 단일 quota 스칼라만 제공(주/일 분해 없음) | `app/src/shared/ipc.ts:206-228` |
| 외부 권위 월간은 usedUsd 로 월간만 치환 | `app/src/shared/usage/limits.ts` `computeProviderUsageLimits`, `external-usage.ts:23` |
| 마지막 리포트 DB 영속 + 캐시 폴백, throw 는 폴백 미도달 | `app/src/main/features/usage/external-usage-service.ts` |
| 구 런웨이 공식 정의처(대체 대상) | `docs/handoff/0079-usage-limits-donut-panel/plan.md:60-66` |

## 인수 기준 (Acceptance Criteria)

1. 주간 버짓 = `limitUsd × weekDaysInMonth / daysInMonth` (경계 주는 이달 몫만); weekPct 는
   사용량/경과일과 무관하게 이번 주 실지출에만 반응.
2. external·fresh 이고 외부월 > 로컬월이면 주/일 used 를 `외부월/로컬월` 배 스케일(week≤month·day≤week 보존); 로컬월≈0 이면 경과일 균등 분배 폴백.
3. external·stale 이면 월=`max(baseline, 로컬월)`, 주/일=로컬 원값(스케일 없음).
4. 외부 fetch throw/null 시 refresh 가 reject 없이 마지막 baseline 반환, `stale=true` 표기.
5. fetch 재성공 시 `stale=false` 로 풀려 다음 계산에서 권위값(+스케일)으로 자동 복구.
6. `source==='local'` 및 전역(`useUsageLimits`) 경로는 값 불변. 게이트 통과.

## 범위 / 비범위

- **범위**: `shared/usage/limits.ts`, `shared/time/clock.ts` 순수 파생 + `external-usage-service.ts`
  stale 판정·throw 폴백. 소비자 UI/훅 무변경.
- **비범위**: 외부 리포트에 주/일 시계열 추가(불가능 — 소스 미제공), DB 스키마 변경.

## 의존 기술 / 전제

- 기존 순수 유틸 재사용: `daysInMonth`·`toDate`·`mondayIndex`(clock). 신규 의존성 0.
- 전제: `EffectiveUsageLimitView.stale?` 필드가 뷰까지 흐른다(기존).

## 설계

- **Part 1**: `computeUsageLimits` 의 런웨이 3줄을 고정 일할 2줄로 교체 + `weekDaysInMonth` 헬퍼.
- **Part 2/3**: `computeProviderUsageLimits` 에서 external 을 fresh/stale 로 분기 —
  `reconcileExternalSummary`(비례 스케일 + 폴백)·`staleExternalSummary`(floor). 표시 시점 순수 파생.
- **서비스**: in-memory `lastFetchOk` 로 stale 의미화, `fetchAndPersist` throw catch→캐시 폴백.
- 레이어: 전부 `shared`(순수) + `features/usage`(main slice) 내부. 경계 위반 0.

## 파생 UX / 엣지케이스

- 경계 주(두 달 걸침): 월 세그먼트별 상수 → 경계에서만 점프(월 리셋과 동시라 자연).
- 로컬월=0·외부 사용 존재: 경과일 균등 분배 폴백.
- 앱 재시작 직후 첫 성공 전: 캐시 baseline 을 stale 로 사용.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| stale floor `max()` 가 오프라인 장기화 시 외부 분 일부 소실 | 추정/폴백 성격상 수용(사용자 결정). 재성공 시 즉시 복구 |
| 주/일 귀속은 추정(외부 분해 부재) | 로컬 분포 신뢰 + 정합(week≤month) 보존 |

## 영향 받는 파일

- `app/src/shared/usage/limits.ts` · `app/src/shared/usage/limits.test.ts`
- `app/src/shared/time/clock.ts` · `app/src/shared/time/clock.test.ts`
- `app/src/main/features/usage/external-usage-service.ts` · `…/external-usage-service.test.ts`

## 참고 문서

- `docs/handoff/0079-usage-limits-donut-panel/plan.md`(구 공식 — 본 핸드오프가 대체, 미수정)

## 게이트

- `cd app && npm run lint && npm run typecheck` + 순수 vitest(limits/clock/external-usage-service).
- 신규 테스트: 고정 일할·경계 주·비례 스케일·폴백·stale floor·throw 폴백·복구.

---

> **[구현자 기입]** (Claude 비기능 직접 구현)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | limits.ts(+test) · clock.ts(+test) · external-usage-service.ts(+test) |
| 실행 명령 | `npm run typecheck` / `npm run lint` / `vitest run <3 suites>` |
| 게이트 결과 | typecheck ✅ · lint ✅(기존 warning 1, 무관) · 대상 3 스위트 22/22 ✅ · 전체 순수 853 pass |
| 블로커 | 없음. DB 로드 스위트 5파일(32건)은 better-sqlite3 ABI egress 차단 베이스라인(변경 무관, app/AGENTS.md) |
| 대상 커밋 | (push 후) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

(없음 — verify PASS 대기)
