# Verify — 0119-busy-steer-provider-gate

## 메타

| 항목 | 값 |
|---|---|
| slug | `0119-busy-steer-provider-gate` |
| 검증자 | Claude Code |
| 일자 | 2026-07-16 |
| 대상 커밋 | `6332ba1` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 #1 — 자동 연속 턴(0067 AC7)이 `BEGIN_TURN` 을 재사용해 별도 스냅샷 경로 불필요 확인 | 타당 — 코드 확인(chatStore ingest 의 활동 이벤트 → BEGIN_TURN dispatch), 스냅샷 지점 단일화로 오히려 단순 | 파생 UX 반영 확인, 매트릭스 AC#1 증거에 포함 |
| 판정 모듈을 `components/composer/` → `lib/` 로 이동(store 역방향 import 회피) | 타당 — lib 는 store·컴포넌트 공용 순수 로직의 기존 위치(planComments 등)와 일관 | 설계 § 반영 확인 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 턴 provider 스냅샷 (BEGIN_TURN 고정 / 종료 4경로 초기화 / SET_MODEL 불변) | ✅ | `chatReducer.ts` BEGIN_TURN·telemetry·turn.aborted·error·CANCEL_CHAT 케이스; `chatReducer.model.test.ts` 6케이스 PASS |
| 2 | 순수 판정 — 경계만 true, 유휴/null 은 보수적 false | ✅ | `lib/steerGate.ts`; `steerGate.test.ts` 5케이스 PASS |
| 3 | 차단 중 placeholder = `placeholderProviderBoundary` (ko: "다른 공급자 모델이 선택되어 있습니다 — 응답 완료 후 전송할 수 있습니다") | ✅ | `Composer.tsx` placeholder 3분기; i18n ko/en 키 추가(en=typeof ko 패리티 typecheck 통과) |
| 4 | 차단 중 전송 버튼 미출현·중단 버튼 유지 + Enter 가드 | ✅ | `Composer.tsx` — `feedbackMode = inflight && !steerBlocked && …` (feedbackMode false → showCancelButton 유지), `submit()` 서두 `if (steerBlocked) return` |
| 5 | store 이중 방어 — 차단 시 false + pendingSteer 미적재 + IPC 미호출, 원복 시 정상 | ✅ | `chatStore.ts` send 게이트; `chatStore.test.ts` "steer provider 경계 게이트(0119)" 2케이스 PASS |
| 6 | 본래 provider 재선택 시 복구 | ✅ | 판정이 파생값(스냅샷 vs 현재 선택) — `steerGate.test.ts` 동일 키 false 케이스 + 사람 실기 확인 대기 |
| 7 | 게이트 green | ✅ | 아래 게이트 재실행 결과 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 에러 0(경고 1 기존) · typecheck 3분할 · vitest 934/934 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 위 매트릭스 |
| 레이어 경계 위반 0 | ✅ | — | features/chat 내부 + shared/i18n — 교차 feature 0 (lint boundaries 포함) |
| 문서 형식/링크/한국어 | ✅ | — | 확인 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 요구 3건 직결 — 사람 확인 대기 |
| **UI/UX 시각 검증** | ✖ | ✅ | **사람 실기 대기(1순위)**: busy 중 경계 모델 선택 → placeholder 교체·타이핑해도 중단 버튼 유지, 본래 모델 재선택 → steer 복구 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 (PR #261) |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # 에러 0, 경고 1(기존 useTranscriptVirtualizer, 변경 무관)
$ npm run typecheck               # node/web/test 3분할 통과 (i18n en=typeof ko 패리티 포함)
$ ./node_modules/.bin/vitest run  # Test Files 122 passed | 1 failed(123) · Tests 934/934 passed
```

- 실패 1 스위트 = `chat-turn.continuity.test.ts` 로드 실패(electron 바이너리 egress 403) — 0117/0118 과 동일한 환경 베이스라인, 변경 무관.
- 신규 테스트 기여: +13 (steerGate 5 + reducer 스냅샷 6 + store 게이트 2) — 0118 시점 921 → 934.

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 변경 없음. 문서에 키/토큰/이메일/IP 없음.

## PHASES.md 정합성

- 0119 행 승격(구현 커밋 `6332ba1`) — 본 검증 커밋에 포함.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 자동 연속 턴의 BEGIN_TURN 재사용을 초기 조사에서 놓쳤다(구현 중 확인) — inflight 전이 지점 전수 조사를 설계 단계 체크리스트로.
- 구현 단계: Composer 렌더 경로(placeholder·버튼 분기)는 컴포넌트 테스트 하네스 부재로 파생 boolean 수준까지만 기계 검증 — 시각 확인은 사람 실기 몫(관례).
- 검증 단계: 실기(busy 상태 재현 + 모델 전환)는 이 환경에서 불가 — 사람 실기 대기로 분리.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 사람 확인 대기: busy 중 경계 선택 → 차단 UI / 원복 → 복구 실기 1회.
