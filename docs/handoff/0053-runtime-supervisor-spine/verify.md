# Verify — 0053-runtime-supervisor-spine

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능 = Claude 직접 plan→impl→verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0053-runtime-supervisor-spine` |
| 검증자 | Claude Code |
| 일자 | 2026-06-29 |
| 대상 커밋 | (push 후 기재) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계리뷰: idle/LRU/IdleClose 는 Persistent 전 死코드 → 척추만, 정책 0054 | 타당 | 인수 1·범위에 정책 비범위 명시 확인 |
| 선조치 #1: onOwnerGone 은 runtime 직접 mark(pre-run 창) → abortTurn 통합 제외 | 타당 | 인수 2 가 onOwnerGone 을 의도적 예외로 규정 — 코드·주석 대조(매트릭스 #2) |
| 선조치 #2: chatCancel 낙관적 settle/forward 유지 | 타당 | 동작 보존 — 핸들러 settle/forward 잔류 확인(매트릭스 #4) |
| 선조치 #3: dead `TurnRegistry` alias·배럴 value re-export 제거 | 타당 | 인수 4 무회귀 정리 대조(매트릭스 #4) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | RuntimeSupervisor(L1) 신설 — registry 소유 + release + 0054 seam 주석 | ✅ | `app/src/main/lifecycle/supervisor.ts`(RuntimeSupervisor 클래스·위임 메서드·`release` WeakSet 가드·seam 주석 헤더) |
| 2 | 단일 abort 프리미티브 `abortTurn`; chatCancel·stall 공유; onOwnerGone 예외 | ✅ | `supervisor.ts:abortTurn` · `timers.ts`(stall→abortTurn) · `send.ts` chatCancel→`abortTurn`, onOwnerGone 은 `runtime.markAborted` 유지+근거 주석 |
| 3 | 단일 멱등 close `release` — 2회 호출 시 finish 1회; finally 대체 | ✅ | `send.ts` finally `supervisor.release(turn)` · 테스트 `supervisor.test.ts`("release 는 멱등…" finishSpy 1회) |
| 4 | 컴포지션 루트 배선 + dead alias 정리 | ✅ | `router.ts`(`new RuntimeSupervisor`·chat/approvals/shutdown 주입) · `approvals.ts`(supervisor param) · `session-registry.ts`(alias 제거) · `turn-registry.ts`(타입 배럴만) |
| 5 | 단위테스트 + 게이트 통과 | ✅ | `supervisor.test.ts` 7 green · typecheck/lint(boundaries·no-cycle 0) 통과(아래 게이트) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck | ✅ | — | 통과 |
| 게이트 test | ✅ 실행분 | — | supervisor 7 green + lifecycle 전부 green; 환경성 실패만(아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 5/5 |
| 레이어 경계 위반 0 (boundaries·no-cycle) | ✅ | — | 0 (L1 supervisor↔L1 registry/timers, L3 router/approvals → L1) |
| 문서 형식/링크/한국어 | ✅ | — | INDEX·§A·provider-runtime·plan/verify 정합 |
| 제품 의도 부합(동작 보존) | ✖ 보조 | ✅ 결정 | 사람 GUI 회귀 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | N/A(main-side, 이벤트 시퀀스 불변) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck      # node + web + test 모두 통과 (에러 0)
$ npm run lint                     # eslint --cache --fix (boundaries·import/no-cycle 위반 0)
$ npx vitest run src/main/lifecycle/supervisor.test.ts src/main/lifecycle/timers
  Test Files  2 passed (2)
       Tests  9 passed (9)      # supervisor 7 + timers 2
$ npm test                        # 전체: 541 passed
  실패 = db/queries.test.ts(better-sqlite3 Node ABI) + persist·send.runtime-resilience(electron 바이너리 미설치 import 차단)
  → 모두 환경성(프록시가 electron 다운로드 차단), 클린 트리 동일, 본 변경과 무관(0033/0046/0052 동일 계열).
```

## 위생 검토

- `AGENTS.md` 변경 없음 — 위생 스캔 N/A. 신규/수정 코드·문서에 키/토큰/이메일/IP 패턴 혼입 0.

## PHASES.md 정합성

- 비기능 리팩토링 — verify PASS 시 PHASES 승격 후보(0052 와 동일 계열). INDEX 0053 행 = `verify/PASS`.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: idle/LRU/IdleClose 의 Persistent 의존(死코드)을 사전에 짚어 척추/정책을 분리한 것은 적절. 다만 `abortTurn` 의 onOwnerGone 비대칭(2 동일 + 1 변종)은 "3중복 통합" 서사를 약화 — plan 에 명시해 해소.
- 구현 단계: 동작 보존 위해 chatCancel 낙관적 settle 을 손대지 않음 — `release` 멱등 가드는 현재 단일 호출자라 0054 전엔 효력이 드러나지 않음(테스트로만 잠금). 의도된 seam.
- 검증 단계: electron 바이너리 미설치로 `send.runtime-resilience` 회귀를 CI 에서 못 돌림 — 타입체크/lint 와 lifecycle 단위테스트로 간접 보증, **실기 회귀는 사람 GUI 검증 필요**(취소·창 닫힘·stall).

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격 후보. 후속 = **0054**(Persistent runtime + cap/LRU/IdleCloseTimer + concurrency 소유 이관, 본 척추의 `release`/seam 에 plug-in).
- 사람 확인 대기: 실환경 GUI 회귀(일반 턴·사용자 취소·창 닫힘·stall 타임아웃) — 0052 와 동일 동작 확인 · PR 머지.
