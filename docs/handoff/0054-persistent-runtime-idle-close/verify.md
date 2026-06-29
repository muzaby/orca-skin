# Verify — 0054-persistent-runtime-idle-close

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 핸드오프는 Claude 가 plan→impl→verify 를 순차 수행(비기능).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0054-persistent-runtime-idle-close` |
| 검증자 | Claude Code |
| 일자 | 2026-06-29 |
| 대상 커밋 | (push 후 기재) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계리뷰: 키스톤=Persistent, 정책 없이 소유/배선+IdleClose 만 | 타당 | 매트릭스 #3·#4 가 정책 부재(seam 유지)를 확인 |
| 우려: "구조적 Persistent" 런타임 이득 작음(서브프로세스 미재사용) | 타당 — 의도적 | plan §리스크 명시·비범위(0055 true streaming-input)로 정직히 분리, 과대주장 아님 |
| 선조치 #1 abortTurn 분리(순환) | 타당 | 매트릭스 #6(no-cycle 0) |
| 선조치 #3 게이트 OFF 회귀 0 | 타당 | 매트릭스 #5(stub 재실행 resilience green) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | close 정책 파라미터화 + alias 무회귀 + 동작 보존 | ✅ | `session-runtime.ts` `SessionRuntime(adapter, closePolicy)`·`reusable` getter·`export const OneShotSessionRuntime = SessionRuntime`. `runAttempt`/status 불변. test `session-runtime.test.ts` "close 정책(0054)" 3건 + 기존 OneShot 2건 green |
| 2 | IdleCloseTimer 실구현(별 상수·별 트리거) | ✅ | `timers.ts` `createIdleCloseTimer(onIdle, IDLE_CLOSE_TIMEOUT_MS=300_000)`·reset/clear. test `timers.test.ts` fire/clear/default 3건 green |
| 3 | RuntimePool 보존/회수(정책-자유, 타이머 풀 소유) | ✅ | `runtime-pool.ts` `take`/`keepIdle`/`closeAll`. test `runtime-pool.test.ts` 7건 green(재사용·만료 reap·null·외부close·교체·closeAll) |
| 4 | Supervisor 거버넌스 — teardown≠runtime close | ✅ | `supervisor.ts` `acquireRuntime`/`releaseRuntime`/`closeIdleRuntimes`, `release(turn)` 멱등 불변. test `supervisor.test.ts` "런타임 거버넌스(0054)" 6건 + 기존 척추 7건 green |
| 5 | 게이트 OneShot 기본, OFF 시 무변경 | ✅ | `send.ts:146` `ORCA_PERSISTENT_RUNTIME==='1'?'persistent':'oneshot'` → `acquireRuntime(...factory)`·finally `releaseRuntime(turn.dbSessionId, runtime)`. OneShot=reusable false → 즉시 close·풀 미진입. `send.runtime-resilience` 7건 electron-stub 재실행 green(회귀 0) |
| 6 | 순환 0 + 게이트 통과 | ✅ | `abort.ts` 분리(`timers`·`send`·`supervisor.test` 기존 import 보존), supervisor re-export. lint(no-cycle·boundaries) 0·typecheck 0·test 578 passed |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | typecheck 0·lint 0·test 578 passed |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 6/6 ✅ |
| 레이어 경계·no-cycle 위반 0 | ✅ | — | 0 (abort.ts 분리로 L1 순환 차단) |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX/§A 정합 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기(게이트 ON 실환경) |
| Open Questions(cap 수치·평가세션 회계) | ✖ | ✅ | 0055 로 분리(본 비범위) |
| UI/UX 시각 검증 | ✖ | ✅ | N/A(렌더러 무변경·게이트 OFF 기본) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck   # node+web+test, 0 error
$ npm run lint                  # eslint --fix (boundaries + import/no-cycle) 0 error
$ npm test                      # Test Files 78 passed; Tests 578 passed
  · lifecycle 9 files 55 green (runtime-pool 7·timers 5·supervisor 13·session-runtime 11 등)
  · 환경 제한: electron 미설치로 import 차단된 2 suite(persist·send.runtime-resilience)는
    electron stub alias 재실행 시 9 passed(7=resilience) — 변경 무관(프록시 electron 바이너리
    다운로드 차단, 0033/0046/0052/0053 동일 계열)
```

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 미변경. 키/토큰/이메일/IP 패턴 혼입 0(코드·문서 모두 env 키 이름 `ORCA_PERSISTENT_RUNTIME` 만).
- 장문 코드설명서·일회성 운영정보 혼입 0(설계 근거는 §A·plan 으로 분리).

## PHASES.md 정합성

- INDEX 0054 행 추가(verify/PASS). PHASES 승격은 라이프사이클 P1 누적(0050~0054) 묶음 — 승격/PR 형식은 사람 머지 결정에 맞춰 기재.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: "구조적 vs true Persistent" 경계를 명시해 과대주장은 피했으나, IDLE_CLOSE_TIMEOUT_MS 기본값(300s)은 근거가 약함 — 게이트 OFF 라 무해하나 0055 에서 config 노출 시 재검토 필요.
- 구현 단계: electron 미설치로 `send.ts` 통합 경로를 정식 게이트에서 직접 못 돌림 — stub alias 로 우회 검증. 정상환경 재실행은 사람 게이트로 남김.
- 검증 단계: 게이트 ON(persistent) 의 실 GUI 회귀(2턴 재사용·idle reap)는 단위로만 커버 — 실환경 확인은 사람 대기.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 6/6, 게이트 typecheck/lint/test green(환경 제한 2 suite 는 stub 재실행 green). 신규 의존성 0, IPC/DB 무변경, 게이트 OFF 동작 보존.
- 후속 **0055**: cap admission · LRU/idle eviction(`evictIdle`) · ConcurrencyRegistry 소유 이관 · steer/queue + true streaming-input · `orchestration/` 리네임.
- 사람 확인 대기: 게이트 ON 실환경 GUI 회귀(같은 세션 cross-turn 재사용·idle reap·shutdown)·정상환경 게이트 재실행·PR 머지.
