# Plan — 0119-busy-steer-provider-gate

## 메타

| 항목 | 값 |
|---|---|
| slug | `0119-busy-steer-provider-gate` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 |
| 매핑 | Phase 4 (0118 후속 UX 가드 — Claude 직접 구현, PR #261 합류) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | busy 세션에서 provider 경계를 넘는 모델을 선택(UI)한 동안 steer 미제공: ① composer placeholder 에 steer 안내 미표시 ② 타이핑해도 보내기 버튼 트리거 안 됨 — 답변 완료 전까지 중단 버튼만 ③ 본래 provider 모델로 되돌리면 steer·안내·버튼 전환 복구 | 라이브 세션 요청 (2026-07-16, 0118 후속) |
| 명시 요구 | 차단 중 placeholder 는 새 안내 문구 — "다른 공급자 모델이 선택되어 있습니다" | 라이브 세션 질의응답 (AskUserQuestion 선택) |
| 추론 의도 | 타이핑 자체는 허용(초안 유지) — 요구가 "보내기 버튼 트리거 안 됨"이지 입력 비활성이 아니다 (추론) | 0022 r2 "입력 비활성화 되돌림" 선례와 일관 |

## Context (왜)

0118 이 provider 경계 모델 변경 시 **유휴 세션** send 의 채널 respawn 을 해결했다. 남은 구멍: **busy 세션**(턴 진행 중)의 send 는 held 예약(steer) 경로로 빠져 진행 턴의 낡은 provider 채널에 실린다 — 경계를 넘은 선택 상태에서 steer 를 허용하면 사용자 기대(새 provider)와 실제(구 provider)가 어긋난다. 본 작업은 그 동안 steer UI 를 차단하고, 되돌리면 복구한다. **렌더러 전용** (main/IPC/DB 무변경 — 0118 비범위의 UI 측 해소).

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 렌더러에 "진행 중 턴의 provider" 스냅샷이 없다 — `ChatState.providerKey` 가 선택값·세션값 겸용이고 `SET_MODEL` 이 inflight 중에도 덮어씀(가드는 cross-adapter 만) | 코드 `app/src/renderer/src/features/chat/reducer/chatReducer.ts` SET_MODEL 케이스 |
| steer 게이팅의 전부는 `feedbackMode = inflight && draft.trim() !== ''` / `showCancelButton = !feedbackMode && (inflight || toolApprovalPending)` — 타이핑 시 중단 버튼이 전송 버튼으로 전환 | 코드 `features/chat/components/Composer.tsx` (파생 booleans) |
| placeholder 는 `inflight ? placeholderFeedback : placeholderIdle` 이분기 | 코드 `Composer.tsx` HighlightedTextarea placeholder |
| store `send` busy 분기가 steer 예약(pendingSteer 적재 + `chatApi.send`) — Enter 경로의 최종 관문 | 코드 `features/chat/store/chatStore.ts` send busy 분기 |
| 자동 연속 턴(0067 AC7)도 활동 이벤트에서 `BEGIN_TURN` 을 dispatch — 스냅샷 지점이 단일 액션으로 수렴 | 코드 `chatStore.ts` ingest "자동 연속 턴(0067 AC7)" 블록 |
| ModelMenu 는 세션 adapter 로 필터 — busy 중 선택 가능한 것은 같은 adapter 내 타 provider(정확히 본 요구의 표적) | 코드 `components/composer/ModelMenu.tsx` |
| Composer 컴포넌트 테스트 하네스 없음(UI 시각 검증 관례) — 순수 헬퍼 분리 + 단위 테스트가 관례 | `app/AGENTS.md` 원칙 4, `composer/modes.test.ts` 선례 |
| i18n 은 ko SSOT + `en = typeof ko` 패리티 컴파일 강제 — 신규 키는 양쪽 동시 | 코드 `shared/i18n/resources/{ko,en}.ts` 헤더 주석 |

## 인수 기준 (Acceptance Criteria)

1. **턴 provider 스냅샷**: `BEGIN_TURN` 이 `providerKey` 를 `turnProviderKey` 로 고정하고, 턴 종료 4경로(telemetry/turn.aborted/error/CANCEL_CHAT)가 초기화하며, `SET_MODEL` 은 스냅샷을 건드리지 않는다 (reducer 단위 테스트).
2. **순수 판정**: `steerBlockedByProviderBoundary` 가 inflight + 스냅샷·선택 모두 non-null + 키 불일치일 때만 true — 유휴/스냅샷 null/선택 null 은 false (단위 테스트).
3. **placeholder**: 차단 중 composer placeholder 가 steer 안내(placeholderFeedback) 대신 신규 `placeholderProviderBoundary`(ko/en) 를 표시한다.
4. **버튼**: 차단 중 타이핑해도 전송(피드백) 버튼이 나타나지 않고 중단 버튼이 유지된다 — `feedbackMode` 가 차단 조건에서 false. Enter(`submit`)도 가드.
5. **이중 방어**: store `send()` 가 차단 조건에서 pendingSteer 미적재 + IPC 미호출로 false 반환; 본래 provider 로 되돌리면 steer 예약 정상 (store 단위 테스트).
6. **복구**: 본래 provider 모델 재선택 시 판정이 false 로 돌아가 placeholder·버튼·전송이 복구된다 (파생값이라 자동 — 판정 테스트 + 사람 실기).
7. **게이트**: lint 에러 0 + typecheck 3분할 + 영향 vitest green (DB/electron 로드 실패는 알려진 베이스라인 분리 보고).

## 범위 / 비범위

- **범위**: 렌더러 — reducer 스냅샷·순수 판정(lib)·Composer 배선·store send 게이트·i18n 키·단위 테스트.
- **비범위**:
  - main 측 held 경로의 provider 재검증(렌더러 게이트가 진입 자체를 막음 — main 방어는 0118 유휴 경로로 충분).
  - 경계 선택 *이전* 에 이미 예약된 pendingSteer 항목의 소급 취소(기존 steerCancel UI 로 취소 가능).
  - 차단 사유 tooltip/토스트 등 추가 안내(placeholder 로 충분 — 필요 시 후속).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `useChatSession` 셀렉터, `BEGIN_TURN` 단일 전이(사용자 send + 자동 연속 턴 공용), pendingSteer 파이프라인, i18n `tr`.
- 전제: 선택/스냅샷 null 은 보수적 허용 — 기존 동작 보존(오차단 방지 우선).
- **신규 의존성**: 없음.

## 설계

- **스냅샷** (`reducer/chatReducer.ts`): `ChatState.turnProviderKey: string | null` — `BEGIN_TURN` 에서 `state.providerKey` 고정, inflight:false 전이 4곳에서 null. 자동 연속 턴도 store 가 `BEGIN_TURN` 을 재사용하므로 스냅샷 지점이 하나다.
- **판정** (`lib/steerGate.ts` 신규): 순수 함수 `steerBlockedByProviderBoundary({ inflight, turnProviderKey, selectedProviderKey })`. `lib/` 에 둔 이유 — store 와 컴포넌트 양쪽이 쓰는 순수 로직의 기존 위치(planComments·eventCoalescer 등)와 일관, store→components 역방향 import 회피.
- **Composer 배선** (`components/Composer.tsx`): `turnProviderKey` 구독 → `steerBlocked` 파생(선택은 `selectedModel?.providerKey`) → ① placeholder 3분기(inflight+차단 = `placeholderProviderBoundary`) ② `feedbackMode = inflight && !steerBlocked && …`(중단 버튼 유지) ③ `submit()` 서두 `if (steerBlocked) return`(Enter 차단).
- **store 이중 방어** (`store/chatStore.ts`): `send()` 가 busy 분기 진입 전 같은 판정으로 false 반환 — pendingSteer·IPC 모두 생략(유령 버블 원천 차단).
- 레이어 경계: 전부 `features/chat` 내부 + `shared/i18n` — 교차 feature 0.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **타이핑 허용**: 입력창은 활성 유지 — 초안을 미리 쓰고, 응답 완료(또는 provider 원복) 후 전송.
- **복구 경로 2종**: ① 본래 provider 재선택(판정 false) ② 턴 종료(inflight false + 스냅샷 초기화) — 이후 send 는 0118 respawn 경로로 새 provider 적용.
- **자동 연속 턴**: `BEGIN_TURN` 재사용으로 그 시점 `providerKey` 를 스냅샷 — 자동 턴은 항상 세션의 현행 채널에서 돌므로 근사로 충분(오차단 없음).
- **기예약 steer 항목**: 경계 선택 이전 예약분은 유지(소급 취소 없음) — 사용자가 기존 취소 UI 로 제거 가능.
- **중단 버튼**: 차단 중에도 그대로 동작(취소는 provider 무관).
- **테마/a11y**: placeholder 문구 교체뿐 — 신규 시각 요소 없음. aria-label 불변.
- **동시 멀티세션**: 상태가 세션 엔트리 단위(`sessions[key].session`)라 세션별 독립.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 스냅샷 null(레거시 진행 턴·앱 재시작 직후 등)엔 차단이 걸리지 않음 | 보수적 허용은 기존 동작과 동일(회귀 없음) — 오차단(정상 steer 차단)이 더 나쁘다는 판단 |
| 선택 변경이 세션 providerKey 필드를 즉시 덮어써 "세션 마지막 provider" 표시가 선택을 따라감 | 기존 동작(0010 이후) 그대로 — 본 작업은 스냅샷만 추가, 필드 의미 재설계는 비범위 |
| store 게이트가 false 를 반환하면 Composer 가 draft 를 비우지 않음 | 의도된 동작 — `submit` 의 `if (!send(...)) return` 이 초안을 보존한다 |

- 되돌리기 어려운 결정: 없음.
- 단독 결정 금지 항목: 없음 (placeholder 문구는 사용자 선택 반영).

## 영향 받는 파일

- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` (+`chatReducer.model.test.ts` 신규)
- `app/src/renderer/src/features/chat/lib/steerGate.ts` (신규) + `steerGate.test.ts` (신규)
- `app/src/renderer/src/features/chat/components/Composer.tsx`
- `app/src/renderer/src/features/chat/store/chatStore.ts` (+`chatStore.test.ts` 케이스 추가)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` (`chat.composer.placeholderProviderBoundary`)
- `docs/handoff/INDEX.md` · 본 plan/verify

## 참고 문서

- `docs/handoff/0118-provider-boundary-respawn/` (유휴 send respawn — 본 작업의 짝)
- `docs/arch/backend/runtime-ipc.md` §1.4 (held/steer 큐 수명)
- `docs/arch/frontend/state.md` (chatStore sessions 외피)
- IPC 변경: 없음 (`IPC_CONTRACT.md` 무영향)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 순수 판정(steerGate) + reducer 스냅샷 + store send 게이트 — 모두 비-DB.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 3개 명시 요구 + placeholder 문구 선택을 출처로 인용, "타이핑 허용"은 추론 표기.
- [x] 자료조사 — 발견 전건에 `파일` / 선례 레퍼런스.
- [x] 인수 기준 — 번호 7건, 단위 테스트/게이트/사람 실기로 검증 가능.
- [x] 의존 기술 — 재사용 모듈 식별, 신규 의존성 없음.
- [x] 파생 UX — 복구 2경로·자동 연속 턴·기예약 항목·멀티세션·a11y 를 펼쳤다.
- [x] 리스크 — 보수적 허용·필드 겸용·draft 보존 트레이드오프 기록.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 스냅샷 위치(BEGIN_TURN 단일 전이)·순수 판정 분리·이중 방어 구조 모두 최소 변경으로 요구 3건을 커버.
- 이견 / 우려: 없음 — 초안에서 판정 모듈을 `components/composer/` 에 두려다 store 가 역방향 import 하게 되어 `lib/` 로 이동(설계 §에 반영 완료).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 자동 연속 턴(0067 AC7)이 BEGIN_TURN 을 재사용함을 설계 초안이 미인지 — 별도 스냅샷 경로가 필요할 뻔 | ✅ 확인 결과 같은 액션으로 수렴해 추가 코드 불필요(스냅샷 자동 동작) — 파생 UX 에 기록 | 코드 확인(chatStore ingest) |

## [구현자 기입] 구현 체크리스트

- [x] reducer `turnProviderKey` 스냅샷 + 4경로 초기화
- [x] `lib/steerGate.ts` 순수 판정 + 테스트 5건
- [x] Composer 배선 3곳 (placeholder/feedbackMode/submit)
- [x] store send 이중 방어 + 테스트 2건
- [x] i18n ko/en `placeholderProviderBoundary`
- [x] reducer 테스트 (`chatReducer.model.test.ts`)
- [x] 게이트 (lint/typecheck/vitest)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `chatReducer.ts`·`lib/steerGate.ts`(신규)·`Composer.tsx`·`chatStore.ts`·i18n ko/en + 테스트 3파일 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run` |
| 게이트 결과 | (verify.md 에 기록) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 INDEX 에 기재) |
