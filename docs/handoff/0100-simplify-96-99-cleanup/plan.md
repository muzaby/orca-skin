# Plan — 0100-simplify-96-99-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0100-simplify-96-99-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-13 |
| 매핑 | PHASES Phase 4 행 (0092/0093 계열 /simplify 정리) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify 범위: 핸드오프 96~99` — 0096~0099 가 도입한 코드 변경을 4관점(재사용·단순화·효율·altitude)으로 리뷰하고 발견을 적용 | 라이브 세션 요청 (2026-07-13) |
| 명시 요구 | altitude 최대 발견 A1(shared/time 로케일 문자열 → i18n 카탈로그 이관, 0096 "locale 파라미터" 설계 번복)을 **이번 0100 에 포함** | 라이브 세션 AskUserQuestion 확답 ("이번 0100 에 포함") |
| 추론 의도 | /simplify 는 동작 보존 품질 정리 — 표시 문자열·IPC 계약·기능 동작은 불변이어야 한다 (추론: /simplify 스킬 정의 + 0092/0093 선례) | `docs/handoff/{0092,0093}-*/plan.md` |

## Context (왜)

0096~0099 범위(`9e3f932..HEAD`, `app/` 168 파일)를 4개 병렬 리뷰 에이전트로 스캔한 결과, 효율 관점은 발견 0(clean)이나 재사용·단순화·altitude 관점에서 dedup 후 4건의 적용 대상이 나왔다. 핵심은 (a) `effectiveLimit→CostSummary` 투영이 3곳(렌더러 사본 2 + main 데드 export)에 중복, (b) UI 시간 문자열이 i18next 카탈로그를 우회해 의존성-0 순수 레이어(`app/src/shared/time/`)에 인라인 ko/en 사전으로 하드코딩 — 제3 로케일 추가·문구 수정 시 4곳을 편집해야 한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `summaryForLimit` 바이트 동일 사본 2 (settings↔cost 교차 feature 라 boundaries 상 직접 공유 불가 — shared 만이 합법 공유 지점) | `app/src/renderer/src/features/settings/components/ProviderUsageTab.tsx:15` · `app/src/renderer/src/features/cost/hooks/useProviderUsageLimits.ts:14` · `app/eslint.config.mjs` boundaries |
| main `summaryForEffectiveLimit` 는 export 만 있고 호출 0 (데드) | `app/src/main/features/usage/external-usage.ts:39` (grep 호출처 0) |
| `entry.limitUsd` 와 `entry.effectiveLimit.limitUsd` 는 동일 체인(`quota?.limitUsd ?? localLimitUsd`)에서 계산 — `?? entry.limitUsd` 폴백은 도달 불가 | `app/src/main/features/usage/external-usage-service.ts` `entry()` · `ProviderUsageTab.tsx:42` |
| `relative.ts`·`resetLabels.ts` 가 인라인 ko/en 사전(`WEEKDAY_KO/EN`·`MONTH_EN`·복수형 삼항) 보유, 소비처는 전부 렌더러 (main 호출 0) | `app/src/shared/time/relative.ts:14-27` · `resetLabels.ts:9-46` (grep) |
| 0096/0097 카탈로그는 복수형 `_one/_other`+`{{count}}` 와 `Trans` 패턴을 이미 사용 — 시간 문자열이 필요로 하는 메커니즘 완비 | `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` · `chat.toolMeta` 키군 |
| `Intl.DateTimeFormat` `weekday:'short'` = ko "월"/en "Mon", `month:'short'` = ko "8월"/en "Aug" — 인라인 요일/월 테이블 대체 가능 | `app/src/renderer/src/shared/i18n/datetime.ts` fmtCache 패턴 |
| `UsageLimitBar.resetLabel`(사전 포맷 문장)이 데이터 뷰모델에 혼입 — 소비처 2 (UsagePanel·UsageLimitViews) | `app/src/shared/usage/limits.ts:15` · `UsagePanel.tsx:84` · `UsageLimitViews.tsx:18` |
| `stale` 배관은 0098 r2 에서 "stale 배지 = 후속 핸드오프 연기" 사용자 결정 존재 — 의도된 pre-wire | `docs/handoff/0098-static-provider-usage-correction/verify.md` |
| 0092/0093 선례: /simplify 정리 = Claude 직접 plan→impl→verify, 설계 변경 수반 항목은 스킵+기록 | `docs/handoff/INDEX.md` 0092/0093 행 |

## 인수 기준 (Acceptance Criteria)

1. `effectiveLimit→CostSummary` 투영 + limit 선택이 `app/src/shared/usage/limits.ts` 의 단일 헬퍼(`computeProviderUsageLimits(entry, now?)`)로 일원화되고, 렌더러 사본 2(`ProviderUsageTab.summaryForLimit`·`useProviderUsageLimits.summaryForLimit`)와 main 데드 `summaryForEffectiveLimit` 이 삭제된다 (`summaryForLimit|summaryForEffectiveLimit` 잔존 grep 0).
2. `ProviderUsageTab` 의 도달 불가 `?? entry.limitUsd` 폴백이 제거된다. IPC `ProviderUsageEntry.limitUsd` 필드 자체는 유지 (계약 무변경).
3. `app/src/shared/time/` 이 로케일-프리가 된다 — `relative.ts` 는 `relativeTime(then, now): { unit, value }` 데이터 반환, `resetLabels.ts` 는 `nextWeekReset`/`nextMonthReset` 시각 계산만, `TimeLocale` 타입·인라인 ko/en 사전(`WEEKDAY_*`·`MONTH_EN`) 소멸 (grep 0).
4. `UsageLimitBar.resetLabel: string` → `resetAt: number`, `computeUsageLimits` 의 `locale` 파라미터 제거 — 사람이 읽는 문장은 shared 계층에서 소멸.
5. 시간 문자열 포맷은 renderer `shared/i18n` 으로 이동 — `formatRelativeTime`·`formatWeekResetLabel`·`formatMonthResetLabel` 신설, `formatRelativeDay` 의 인라인 `'어제'/'yesterday'`·`${day}일 전` 분기가 카탈로그 키로 치환. `time.*` 키군이 ko/en 동시 추가(패리티 테스트 green).
6. **표시 문자열 바이트 동일 보존** — `방금`·`N분 전`·`어제`·`(월) 오전 0:00에 재설정`·`Resets (Sat) Aug 1` 등 기존 기대 문자열이 테스트 기대값으로 그대로 이동해 고정된다.
7. `formatMonthDay` 의 barrel(`shared/i18n/index.ts`) 재export 제거 (외부 소비처 0 확인, `datetime.ts` export 는 테스트용 유지).
8. 게이트 green — `npm run lint`(boundaries 포함) 0 · `npm run typecheck` 3종 0 · vitest (better-sqlite3 네이티브 ABI 환경 제한 red 베이스라인 외 green, 본 변경 관련 스위트 `relative`·`resetLabels`·`limits`·`datetime`·`resources` 개별 실행 green) · `node --test scripts/*.test.mjs` 24/24. 신규 의존성 0 · IPC 무변경.

## 범위 / 비범위

- **범위**: 위 인수 1~8 (F1~F4). 리뷰 스킵 판정의 기록.
- **비범위**:
  - `stale` 상수 배관 제거 — 0098 r2 사용자 결정(stale 배지 후속 연기)의 pre-wire 계약이라 유지.
  - `ProviderUsageEntry.limitUsd` 필드 제거 — IPC 계약 변경 수반(IPC_CONTRACT §2.4), /simplify 범위 밖.
  - 효율 관점 발견 0 — 변경 없음.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `computeUsageLimits`(shared/usage) · i18next 카탈로그/`_one/_other` 복수형 · `datetime.ts` `fmtCache` 프리셋 패턴 · `useI18n().locale`.
- 전제: `relativeTimeLabel`/`resetLabels`/`computeUsageLimits` 소비처가 렌더러 전용 (grep 확인 — main 호출 0).
- **신규 의존성**: 없음.

## 설계

- **F1**: `shared/usage/limits.ts` 에 `computeProviderUsageLimits(entry: ProviderUsageEntry, now?): UsageLimitsView` — 내부에서 external 투영(summary 치환) + `effectiveLimit.limitUsd` 선택 후 기존 `computeUsageLimits` 위임. `ProviderUsageEntry` 타입은 같은 shared 의 `../ipc` 에서 import (shared→shared 합법). 두 훅/컴포넌트는 이 헬퍼만 호출.
- **F2**: shared = 데이터, renderer i18n = 문장. 카탈로그 키 설계: `time.justNow`·`time.minutesAgo_one/_other`·`time.hoursAgo_one/_other`·`time.daysAgo_one/_other`·`time.yesterday`·`time.resetsWeek`(`{{weekday}}`)·`time.resetsMonth`(`{{weekday}}`·`{{date}}`). 요일/월·일은 Intl 프리셋(`weekday:'short'`·`month:'short'+day:'numeric'`)으로 생성해 보간.
- 레이어 경계: shared/time·shared/usage 는 런타임 의존 0 유지(오히려 강화 — 로케일 개념 소멸). renderer 포맷터는 `shared/i18n`(범용 atom) 에 위치, features 는 그것만 호출.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 표시 문자열 회귀 = 이 작업의 유일한 UX 리스크 — 기존 테스트 기대 문자열을 renderer 테스트로 그대로 이동해 고정 (인수 6).
- 언어 전환 리렌더: 포맷터는 컴포넌트가 `useI18n().locale` 로 호출하는 기존 패턴 유지 — 전환 시 리렌더 편승 불변.
- 복수형: ko 는 단복수 무구분(`N분 전`), en 은 `_one/_other` — i18next 표준 메커니즘 사용으로 기존 삼항과 동일 출력.
- 테마·접근성·로딩/빈 상태: N/A (문자열 생성 위치 이동만).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 0096 채택 결정("shared locale 파라미터") 번복 | 사용자 AskUserQuestion 확답으로 승인 완료 (2026-07-13). 0096 plan 의 결정을 본 문서가 supersede |
| `UsageLimitBar` 뷰모델 shape 변경(resetLabel→resetAt)의 소비처 누락 | 소비처 grep 전수(UsagePanel·UsageLimitViews 2곳) + typecheck 가 기계 검출 |
| Intl `month:'short'` 출력이 인라인 테이블과 다를 가능성 | 테스트 기대값을 기존 문자열로 고정해 기계 검증 (ko "8월 1일"/en "Aug 1" 확인) |

- 되돌리기 어려운 결정: 없음 (내부 구조 이동, IPC·DB·설정 무변경).
- **단독 결정 금지 항목**: A1 포함 여부 → 사용자 확답 완료. 그 외 없음.

## 영향 받는 파일

- `app/src/shared/time/relative.ts`·`relative.test.ts`·`resetLabels.ts`·`resetLabels.test.ts`
- `app/src/shared/usage/limits.ts`·`limits.test.ts`
- `app/src/renderer/src/shared/i18n/datetime.ts`·`datetime.test.ts`·`index.ts`·`resources/{ko,en}.ts`
- `app/src/renderer/src/features/settings/components/ProviderUsageTab.tsx`·`UsageLimitViews.tsx`
- `app/src/renderer/src/features/cost/hooks/{useUsageLimits,useProviderUsageLimits,useProviderUsage}.ts`
- `app/src/renderer/src/features/chat/components/UsagePanel.tsx`
- `app/src/main/features/usage/external-usage.ts`

## 참고 문서

- `docs/handoff/{0092,0093}-*/plan.md` — /simplify 정리 선례 (스킵 판정 관례 포함)
- `docs/handoff/0096-i18n-ui-locale/plan.md` — 번복 대상 "locale 파라미터" 결정의 출처
- `docs/handoff/0098-static-provider-usage-correction/verify.md` — stale 배지 연기 사용자 결정
- `docs/arch/frontend/` — 4-layer 경계 (shared 는 범용 atom)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규/이동 테스트: `relativeTime` 데이터 단언 · `nextWeekReset/nextMonthReset` 시각 단언 · renderer 포맷터 문자열 단언(기존 기대값 승계) · `computeProviderUsageLimits` 투영 단언 · ko/en 패리티(기존 스위트가 자동 커버).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 출처(라이브 세션 + AskUserQuestion 확답)로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·핸드오프 문서)를 붙였다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다.
- [x] 의존 기술 — 의존·전제를 식별했고, 신규 의존성 0 을 확인했다.
- [x] 파생 UX — 문자열 회귀·언어 전환·복수형 엣지를 펼쳤다 (해당 없는 항목은 N/A 표기).
- [x] 리스크 — 0096 결정 번복·뷰모델 변경 리스크와 완화책을 적었고, 사용자 결정 항목은 확답 완료로 종결했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (본 건은 비기능 = Claude 직접 구현).

## [구현자 기입] 설계 리뷰 (비판적)

(구현 턴에서 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

(구현 턴에서 기입)

## [구현자 기입] 구현 체크리스트

- [ ] C1 — F1(`computeProviderUsageLimits` 통합 + 사본/데드 삭제) + F4(barrel export 정리)
- [ ] C2 — F2(shared/time 데이터화 + 카탈로그 이관) + F3(SyncRow 삼항 축약)
- [ ] 게이트 + 관련 스위트 개별 green

## [구현자 기입] 구현 보고

(구현 턴에서 기입)
