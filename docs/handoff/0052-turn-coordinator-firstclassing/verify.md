# Verify — 0052-turn-coordinator-firstclassing

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0052-turn-coordinator-firstclassing` |
| 검증자 | Claude Code |
| 일자 | 2026-06-29 |
| 대상 커밋 | (push 후 기재) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| settle 를 코디네이터 메서드 아닌 순수 함수로(stateless, cancel/stop 핸들러 공유) | 타당 — IPC 핸들러는 코디네이터 인스턴스가 없으므로 stateless 가 옳다 | 인수 3 증거에 반영 |
| 잠재문제 #1 import 순환 → turn-sinks.ts 분리 | 타당 — `import/no-cycle` 가 강제하는 패턴 준수 | 인수 2 boundaries 결과로 확인 |
| 잠재문제 #2·#3 무회귀 re-export | 타당 — 외부 importer 무변경으로 회귀 0 | 게이트 결과로 확인 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | TurnCoordinator(L1) 가 retry+consume·reduce·persist∥forward·terminal 합성·error/retry·stall+beginApprovalPause 1급 소유(동작 보존) | ✅ | `lifecycle/turn-coordinator.ts:run`(454–604 이식); 불변식 보존(persist∥forward·promote·ask flush·terminal 합성·retry eventsReceived===0) |
| 2 | 의존 역전 — sink 인터페이스만 주입, L1→L3 import 위반 0 | ✅ | `lifecycle/turn-sinks.ts`(TurnPersistSink·TurnEventSink·TurnTitleHook); `npm run lint` boundaries 0 error |
| 3 | settle/subagent 빌더 L1 이동 + 무회귀 배럴 re-export | ✅ | `lifecycle/settle.ts`·`lifecycle/subagent-settlement.ts`; `ipc/chat/subagent-settlement.ts`=re-export; `send.ts` settleOpenToolRuns 3-arg 래퍼(router 무변경) |
| 4 | send.ts 셸화 + cancel/stopSubagent → settle.ts | ✅ | `ipc/chat/send.ts:handleChatSend`=셋업+`coordinator.run`+finally; cancel=`settleOpenToolRunsCore`·stopSubagent=`settleSubagentTask`+`stopLiveSubagent` |
| 5 | 가로축 단위테스트 + 게이트 통과 | ✅ | `turn-coordinator.test.ts`(5)·`settle.test.ts`(6)+resilience(7) = 14 green; typecheck/lint/build ✅ |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | typecheck ✅·lint ✅·test(신규 14 green)·build ✅ |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 5/5 ✅ |
| 레이어 경계 위반 0 | ✅ | — | boundaries 0(L1 coordinator L3 import 0) |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX 한국어·표 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 변경 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기(동작 보존이라 시각 무변경 예상) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck   # node + web + test, 0 error
$ npm run lint                  # eslint --cache --fix ./src — 0 error (boundaries 포함)
$ npm test                      # 541 passed, 12 failed
  - 신규/영향: turn-coordinator(5)·settle(6)·send.runtime-resilience(7)·subagent-settlement = 14 green
  - 실패 12 = src/main/db/queries.test.ts (better-sqlite3 'Module did not self-register' = Node↔Electron ABI)
    · git stash 로 클린 트리에서도 동일 12 실패 재현 → 본 변경 무관(환경 제약, 0019 계열)
$ npm run build                 # tsc --noEmit && electron-vite build → out/ (main+preload+renderer) ✅
```

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 변경 없음(키/토큰/이메일/IP 스캔 N/A).
- 변동성/일회성/장문 혼입 없음 — plan/verify 는 핸드오프 표준 구조.

## PHASES.md 정합성

- verify PASS 후 PHASES "현재 작업 중"→완료 행 승격 대상(보드 링크 유지). 대상 커밋은 push 후 기재.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: god-object 분리 비범위 결정이 옳았으나, 후속 핸드오프에서 InflightTurn 을 4묶음(파이프라인/타이틀/세션바인딩/입력)으로 가를 때 sink 경계가 첫 분할선이 됨을 plan 에 더 구체화할 수 있었다.
- 구현 단계: 가로축 단위테스트는 핵심 순서를 고정하지만 settle-on-timeout(`runtime.timedOut`) 분기는 fake 의 getter 한계로 명시 케이스 미작성 — settle.ts 자체 테스트로 간접 커버. 후속 보강 여지.
- 검증 단계: 동작 보존은 단위테스트 + 불변식 대조로 확인했으나 **실환경 GUI 회귀(일반 턴·승인 왕복·취소·subagent stop·재시도)는 사람 검증 대기** — main 프로세스 electron 바이너리 미설치로 본 환경에서 통합 실행 불가.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격(대상 커밋 push 후). 사람 확인 대기: 실환경 GUI 회귀(가로축 동작 보존)·PR 머지.
- 후속 핸드오프 후보(비범위): InflightTurn god-object 분리 · Persistent+IdleCloseTimer · Supervisor cap/LRU · steer/queue admission · `orchestration/` 리네임.
