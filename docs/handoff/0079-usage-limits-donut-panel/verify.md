# Verify — 0079-usage-limits-donut-panel (PASS r1)

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-07-07 |
| 결과 | **PASS (r1)** |
| 구현 주체 | Claude 직접 (plan→impl→verify) |

## 게이트

| 게이트 | 결과 |
|---|---|
| `npm run typecheck` (node·web·test 3종) | ✅ 0 error |
| `npm run lint` (boundaries 포함) | ✅ 0 problem |
| `npm test` | ✅ **745 passed** / 3 suite import-fail |

3 suite(`chat-turn.continuity`·`chat-turn.runtime-resilience`·`history/writer`)는 `import electron` 이 프록시 403 으로 electron 바이너리 미설치라 로드 실패 — 0050~0078 동일 계열의 **환경 제한**이며 본 변경과 무관(diff 가 해당 파일 미접촉). better-sqlite3 는 Node ABI 재빌드(`npm rebuild better-sqlite3`) 후 전체 DB 스위트 green.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 증거 | 판정 |
|---|---|---|---|
| 1 | `spendingLimitUsd`(nullable, 기본 90) 영속 | `shared/protocol.ts` SettingsSchema/Patch + `shared/ipc.ts` Settings 인터페이스 + `useTweaks.ts` DEFAULTS/로드 | ✅ |
| 2 | 공용 시간 유틸 + 재설정 라벨, main boundaries 재노출 | `shared/time/{clock,resetLabels}.ts`(+test 6) · `features/usage/boundaries.ts` re-export · `boundaries.test.ts` green | ✅ |
| 3 | 공용 `computeUsageLimits` 유일 계산 지점 + 테스트 | `shared/usage/limits.ts`(+test 6: 워크드 31%/33%·무제한·월초·초과·0분모) | ✅ |
| 4 | 도넛 팝오버 `UsagePanel` 재구성(컨텍스트 바+구분선+주/월 바), 캐시 행 제거 | `features/chat/components/UsagePanel.tsx` · `TelemetryPanel.tsx` 삭제 · `Composer.tsx` 교체 | ✅ |
| 5 | `>` 클릭 시 설정 '사용량' 탭 오픈 | `settingsModalStore.show('usage')` ← pages `onOpenUsageSettings` ← Composer `>` | ✅ |
| 6 | 설정 사용량 실데이터 바 + 1-depth 한도 조정 | `UsageTab.tsx`(주/월 `LimitBarRow` + `LimitEditor` $ 입력·무제한) | ✅ |
| 7 | 한도 변경 시 도넛·설정 동시 갱신(단일 파생) | 둘 다 `useUsageLimits`(`features/cost/hooks`)→`computeUsageLimits`, 한도=`useTweakContext` 공유 컨텍스트 | ✅ |
| 8 | 외부 보정 seam(no-op)만 | `features/usage/external-correction.ts`(`UsageCorrectionSource`+`NoopCorrectionSource`) · `UsageTracker.remainingUsd` 소비점, 폴링·SDK 0 | ✅ |
| 9 | 게이트 통과·경계 0·신규 IPC 0 | 위 게이트 · boundaries lint 0 · CHANNELS 무변 | ✅ |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트 | 사람 |
|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 | — |
| 인수 기준 ↔ 코드 1:1 | ✅ | 이견 시 중재 |
| 레이어 경계 | ✅ 위반 0 | — |
| **주간 공식 제품 타당성** | ✖ 완성안 제시(plan §주간 공식) | ✅ 승인(ExitPlanMode 완료) |
| UI/UX 시각(테마 3종·도넛/설정 렌더·`$` 입력·무제한 표기) | ✖ electron 미설치로 dev 실행 불가 | ✅ `npm run dev` 육안 |
| 한도 편집 → 도넛·설정 동시 갱신 실기 | ✖ | ✅ |
| PR 머지 | ✖ | ✅ |

## 검증 자기 리뷰 (메타)

- **설계**: 주간 공식은 사용자 제안(“남은한도÷남은일×주남은일”)이 예산만 정의해 프로그레스바 분모가 미정 → 분모=`이번주 실사용+남은예산`(envelope)으로 완성하고 워크드 예시를 테스트로 고정. 승인 완료.
- **구현**: 렌더러 교차-feature 회피를 위해 `useUsageLimits`(cost feature)를 pages/app 이 주입하는 `costToday` 대칭 패턴으로 배선. SSOT(main UsageTracker)는 불변, 파생만 단일화.
- **검증 한계**: electron 바이너리 미설치로 실 GUI 검증 불가 — 순수함수 테스트·typecheck·lint 로 로직/타입/경계는 확증, 시각·상호작용은 사람 확인 대기(위 표).

## 사람 확인 대기

1. `npm run dev` — 턴 1회 후 도넛 클릭 → 컨텍스트 바 + 구분선 + 주/월 한도 바 + `>` 시각.
2. `>` → 설정 사용량 탭 이동, "월간 사용 한도" `>` → $ 조정 뷰, 저장 시 도넛·설정 **동시** 갱신.
3. 무제한 설정 시 바 muted·"무제한" 표기.
4. PR 머지.
