# Plan — 0079-usage-limits-donut-panel

## 메타

| 항목 | 값 |
|---|---|
| slug | `0079-usage-limits-donut-panel` |
| 작성자 | Claude Code |
| 일자 | 2026-07-07 |
| 매핑 | PHASES (완료 시 승격) / PR (draft) |
| 상태 | DRAFT → READY → IMPL |
| 구현 주체 | Claude 직접 (라이브 Codex 부재, 사용자 지시) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① 설정→사용량에 "월간 사용 한도" 항목 추가, 클릭 시 1-depth 조정(초기 $90). ② Composer 도넛 팝오버 재구성: 컨텍스트(유지·프로그레스바) + 구분선 + 주간/월간 한도 프로그레스바 + `>` 로 설정 사용량 이동. ③ 실사용량 SSOT 는 하나(설정·도넛은 참조만). | 라이브 세션 요청(첨부 이미지 3종 + ASCII 목업) |
| 명시 요구(Q&A) | 주간 산출="남은 한도÷남은 일×그 주의 남은 일"(검토 요청) · 외부 API 보정=seam만(구현 후속) · 시간함수=공용 clock/경계 유틸 신설·OS 로컬 타임존 | AskUserQuestion 응답(2026-07-07) |
| 추론 의도 | 한도 통화=$ 지출 한도이므로 사용량 비교는 `totalCostUsd`(추정값 폴백). 도넛 트리거 게이팅(`lastTelemetry`)은 현행 유지. | 해석 — 이미지 3(월간 지출 한도 $) + cost SSOT 구조 |

## Context (왜)

첨부(Claude Code 데스크톱 사용량 UI)를 참고해 두 지점을 손본다. 현재 `UsageTab.tsx` 는 하드코딩 목업이고, 도넛 팝오버(`TelemetryPanel`)는 컨텍스트 토큰 분해만 보여준다. 한도 개념·실사용량 대비 표시가 없다. SSOT 는 이미 main `UsageTracker`(일/주/월 `CostSummary`)에 있으므로 **새 SSOT 를 만들지 않고 참조**하도록 두 화면을 재구성한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 사용량 SSOT = main `UsageTracker` (일/주/월 `CostSummary`, `sumUsageByBoundaries(boundaries(now))`), `CHANNELS.costSummary`/`costSummaryEvent` | `app/src/main/features/usage/tracker.ts` · `handlers/misc.ts:231` · `app/bootstrap.ts` |
| renderer 미러 = `useCostSummary()`(읽기전용 Zustand). 페이지가 `costToday` 파생해 `ChatView→ChatTile→Composer` 주입 | `features/cost/store/costStore.ts` · `pages/ChatPage.tsx:10-14` |
| 경계 유틸 `boundaries(now)` = 로컬타임 일/월요일주/월 시작 (타임존 파라미터 없음) | `app/src/main/features/usage/boundaries.ts` |
| 도넛 트리거+팝오버: `Composer.tsx:608-648`(`UsageCircle` + `TelemetryPanel`), `lastTelemetry` 게이팅 | `features/chat/components/{Composer,TelemetryPanel}.tsx` |
| 설정 영속 = `SettingsSchema`(zod)+`SettingsStore`(electron-store). 소형 반응형 값은 `useTweaks`/`settingsApi` | `shared/protocol.ts:343` · `infra/settings-store.ts` · `shared/hooks/useTweaks.ts` |
| 설정 모달 = 로컬 `useState<TabId>` 탭(depth 없음). `SidebarUserButton`(app)이 로컬 state 로 open | `features/settings/components/SettingsModal.tsx` · `app/SidebarUserButton.tsx:28,124` |
| i18n 없음 — 한국어 인라인 리터럴 | 코드 전반 |
| 렌더러 4-layer: feature→feature 직접 import 금지, pages/app 이 주입 | `app/AGENTS.md` |

## 인수 기준 (Acceptance Criteria)

1. `SettingsSchema`/`SettingsPatchSchema` 에 `spendingLimitUsd`(nullable, 기본 90) 추가 — 영속·복원된다.
2. 공용 순수 유틸 `shared/time/clock.ts`(경계·남은일수) + `shared/time/resetLabels.ts`(주/월 재설정 라벨) 신설, 단위 테스트 통과. main `boundaries.ts` 는 이를 재노출(동작 불변).
3. 공용 순수 `computeUsageLimits(summary, limitUsd, now)` (§주간 공식) 신설 — **유일 계산 지점**. 워크드 예시·엣지(무제한/월초/한도초과/0분모) 단위 테스트 통과.
4. 도넛 팝오버가 `UsagePanel` 로 교체: 컨텍스트 프로그레스바 + 구분선 + 주간/월간 한도 프로그레스바(재설정 라벨·%) + `>`(설정 사용량 이동). 기존 신규입력/캐시 행 제거.
5. `>` 클릭 시 설정 모달이 '사용량' 탭으로 열린다(전역 opener).
6. 설정 사용량 탭이 실데이터 주간/월간 바(도넛과 **동일 파생** 참조) + "월간 사용 한도" 1-depth 조정 뷰($ 입력·저장·무제한)로 재작성된다. 하드코딩 목업 제거.
7. 한도 변경 시 도넛·설정 바가 동일 값으로 갱신된다(SSOT/파생 단일).
8. 외부 보정은 seam(`UsageCorrectionSource` + `NoopCorrectionSource`)만 — 폴링·SDK 호출 없음, 동작 변화 0.
9. 게이트 `lint`/`typecheck`/`test` 통과, 레이어 경계 위반 0, 신규 IPC 채널 0.

## 범위 / 비범위

- **범위**: AC 1~9.
- **비범위(후속)**: 외부 API 실폴링(5분)·SDK 외부 사용량 추적 실구현 / 별도 주·일 한도 설정 UI / 타임존 선택 / i18n.

## 주간 한도 공식 (사용자 제안 완성본 — 검토 결과)

로컬타임, `L`=월 한도(USD, 기본 90, null=무제한):
```
Mused=month.totalCostUsd ; Wused=week.totalCostUsd
monthDaysLeft=daysInMonth-dayOfMonth+1 ; weekDaysLeft=7-mondayIndex  // 오늘 포함
Rlimit=max(0,L-Mused) ; perDay = monthDaysLeft>0 ? Rlimit/monthDaysLeft : 0
weekRemainingBudget = perDay*weekDaysLeft            // 사용자 공식
weekBudget = Wused + weekRemainingBudget
weekPct  = weekBudget>0 ? clamp01(Wused/weekBudget) : 0
monthPct = (L!=null&&L>0) ? clamp01(Mused/L) : 0
```
검토: 사용자 문구는 `weekRemainingBudget` 를 만든다. 프로그레스바 분자/분모 기간 정합을 위해 분모=`Wused+weekRemainingBudget`(이번 주 envelope)로 완성. "남은 일"은 오늘 포함. 워크드 예시(L90,7월15일 수,Mused30,Wused8)→ weekPct≈31%, monthPct≈33%.

## 설계

- **하향식**: shared 순수 유틸(clock/resetLabels/limits/Meter) → protocol/useTweaks → main seam → renderer UI.
- **SSOT 참조**: 원천=main `UsageTracker`→`useCostSummary()`. 파생=`computeUsageLimits` 단일 함수(shared). 설정·도넛 둘 다 이 함수만 호출.
- **레이어**: `shared/` 순수 유틸은 어디서나 import 가능. cost feature(`useCostSummary`)는 pages/app 이 읽어 도넛(Composer)·설정(SettingsModal)에 props 주입(교차 feature import 회피, `costToday` 대칭).
- **재사용**: `UsageCircle`(도넛 트리거), `contextTokens`/`contextWindowFor`(컨텍스트), `Meter`(→`shared/ui`), `boundaries` 로직(→`shared/time`).

## 파생 UX / 엣지케이스

- 무제한(null): 월간 바 비활성·"무제한" 표기. 주간은 `Rlimit=∞` 취급 불가 → 무제한이면 주간도 비활성/미표시(정의).
- 사용량 0·월초: pct 0(0분모 가드).
- 한도 초과: pct 100% 클램프, 텍스트는 실값.
- 도넛: `lastTelemetry` 없으면 트리거 미표시(현행) — 컨텍스트 행은 telemetry 있을 때만.
- 테마 3종·a11y: 기존 토큰/aria 패턴 유지. 프로그레스바 `role`·라벨.

## 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| 주간 공식이 사용자 기대와 다를 수 있음 | 공식·워크드 예시를 plan 명시 + ExitPlanMode 승인 완료. 단일 함수라 후속 조정 저비용 |
| 무제한 시 주간 정의 모호 | 무제한이면 주간·월간 모두 비활성으로 통일(정의 고정) |
| cost=추정값(청구 아님) | 폴백 성격 명시(주석), 외부 보정 seam 으로 후속 보정 여지 |

## 영향 받는 파일

- 신규: `shared/time/{clock,resetLabels}.ts`(+test), `shared/usage/limits.ts`(+test), `renderer/shared/ui/Meter.tsx`, `features/chat/components/UsagePanel.tsx`, `features/settings/store/settingsModalStore.ts`, `main/features/usage/external-correction.ts`.
- 수정: `shared/protocol.ts`, `renderer/shared/hooks/useTweaks.ts`, `main/features/usage/boundaries.ts`, `main/features/usage/tracker.ts`, `features/chat/components/{Composer,ChatView,ChatTile}.tsx`, `pages/{ChatPage,NewChatLandingPage,ProjectLandingPage}.tsx`, `features/settings/components/{SettingsModal,UsageTab}.tsx`, `app/SidebarUserButton.tsx`, `features/settings/index.ts`.
- 삭제/축소: `features/chat/components/TelemetryPanel.tsx`(→UsagePanel).

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `clock`·`resetLabels`·`limits` 순수 함수.
