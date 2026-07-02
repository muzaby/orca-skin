# Verify — 0060-steer-flush-boundary

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 verify 는 0060(0059 후속 버그수정 — steer flush 를 입력 즉시가 아니라 agent 가 입력을 흡수하는 turn 경계에서 수행)을 대조한다. 비기능(버그수정) = Claude 직접 구현이라 설계+구현+검증을 Claude 가 순차 수행.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0060-steer-flush-boundary` |
| 검증자 | Claude Code |
| 일자 | 2026-07-01 |
| 대상 커밋 | `7d481ce` |
| 라운드 | 1 |
| 상태 | **PASS** (7/7 충족) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> 0060 은 Claude 단독(plan+impl+verify). plan 본문이 곧 구현자 설계 노트다.

| 구현 노트 | 검증자 판단 | 반영 |
|---|---|---|
| 근본원인: 0059 가 flush 신호를 producer-pull(`onConsume`)로 골랐으나 SDK 가 입력 AsyncIterable 을 eager drain → pull ≠ turn 경계 | **타당** — `streaming-input.ts` 에서 pull 즉시 재개가 확인됨. 관찰-경계 기반 전환이 옳음 | 매트릭스 AC1~5 반영 |
| 방향: flush 를 push 에서 분리하고 TurnCoordinator 가 관찰하는 turn 경계(최상위 tool.call.completed settle / telemetry)에서 구동 | 타당 — orca 는 agentic 루프를 SDK 서브프로세스에 위임하므로 turn head 직접 소유 불가, 관찰 근사가 유일 현실적 seam | AC2~5 반영 |
| 미검증 가정(user echo 신호): claude-map 이 텍스트 echo 를 드롭 — echo 승격은 후속 하드닝, 이번은 echo 비의존 | 타당한 범위 축소 | §자기리뷰·사람 실측 대기 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 입력 push(pull) 즉시엔 flush 안 됨(producer-pull 분리) | ✅ | `adapters/streaming-input.ts:22-25,56-61` — `push`=queue.push+wake 만, `onConsume`/`nextInjectedInput` 제거. 테스트 `streaming-input.test.ts:57-72` "push 는 리터럴 전달만(pull 이 flush 유발 안 함)" |
| 2 | 최상위 `tool.call.completed` 배치 settle 시 flush(continuation 이전 커밋) | ✅ | `turn-coordinator.ts:89-96` `isSteerFlushBoundary`·`198-202` persist 이후 호출. 테스트 `turn-coordinator.test.ts:216-229` flush 가 완료 후·continuation(message.completed) 이전 |
| 3 | 서브에이전트 내부 도구(`parentToolRunId`)는 부모 경계 아님 | ✅ | `turn-coordinator.ts:91` `ev.parentToolRunId !== undefined` → false. 테스트 `:231-242` child 도구 완료에서 flush 안 함 |
| 4 | 병렬 최상위 도구 전부 settle 후에만 flush | ✅ | `turn-coordinator.ts:92-95` `openToolRuns` 순회 — 최상위 open 잔여 시 false. 테스트 `:244-261` t1 완료 시 t2 열림→미flush, t2 완료 후 flush |
| 5 | 도구 없는 턴은 telemetry 경계에서 flush | ✅ | `turn-coordinator.ts:90` telemetry→true. 테스트 `:263-267` 텍스트-only 턴 telemetry 후 flush |
| 6 | pending 없으면 경계에서도 persist 호출 0 | ✅ | `turn-coordinator.ts:98-102` `drainForFlush` 없으면 early return. 테스트 `:269-286` `persistSteer` 미호출 |
| 7 | 게이트 lint/typecheck/test green·경계·순환 0 | ✅ | §게이트 — test 618 passed·lint(boundaries·no-cycle) 통과 |

### dead 배선 제거 확인

`onInputConsumed`/`consumeInjectedInput`/`nextInjectedInput`/`onConsume` — `rg` 결과 `app/src` 전역 **0건** (0060 §설계 4 "dead 배선 제거" 이행). persist·renderer 는 무변경(호출 시점만 이동) — plan §설계 5 일치.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/typecheck:test/test | ✅ | — | green — test **618 passed** |
| 인수 기준 ↔ 코드 대조 | ✅ 증거(`파일:라인`·테스트) | 이견 시 중재 | 7/7 |
| 레이어 경계 위반 0 | ✅ | — | boundaries·no-cycle 0(순수 L1/L2 수정) |
| 문서 형식/링크/한국어 | ✅ | — | plan 정합 |
| AGENTS.md 위생 스캔 | ✅ | ✅ | 해당 없음(무변경) |
| 실환경 취합 시점 커밋 재현(서브에이전트 위임 시) | ✖ | ✅ | 사람 실측 대기 |
| user echo 신호 실측(디버그 `[wire]`) | ✖ | ✅ | plan §미검증 가정 — 후속 하드닝 |
| Open Question(승인 이벤트 별도 flush 경계 여부) | ✖ | ✅ | 기본 tool.call.completed 커버, 실측 후 판단 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm rebuild better-sqlite3 && npm run lint && npm run typecheck && npm run typecheck:test && npm test
lint      : PASS (eslint --cache --fix, 출력 0)
typecheck : PASS (node + web + test tsconfig 3종)
test      : Test Files 2 failed | 82 passed (84) / Tests 618 passed (618)
  - 실패 2 suite: persist.test.ts · send.runtime-resilience.test.ts
    → electron 바이너리 미설치 import 실패(0050~0059 동일 계열, 변경 무관·0 test)
$ npx vitest run turn-coordinator.test streaming-input.test steer-queue.test
  Test Files 3 passed (3) / Tests 19 passed (19)
```

impl 보고 게이트(**618 passed**)와 재실행 결과 일치.

## 위생 검토

- 코드만 변경(streaming-input·turn-coordinator·dead 배선 제거). AGENTS.md·비밀 혼입 없음.
- 커밋 `7d481ce` trailer 정합: `Agent: claude`·`Handoff: docs/handoff/0060-…`·`Status: implemented`·`Criteria-Met: 7/7`·`Verified-By: pending`.

## PHASES.md 정합성

- 0060 행을 lifecycle P1 시리즈 형식으로 승격. 커밋 `7d481ce` 기재.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 0059 가 producer-pull 을 flush 권위 신호로 오설계한 것을 0060 이 바로잡음 — 0059 설계 시
  "SDK 입력 스트림 eager drain" 특성을 실측(디버그 `[wire]`)으로 먼저 검증했다면 왕복을 줄일 수 있었다.
- 구현 단계: turn 경계 근사(최상위 tool.call.completed settle)는 **관찰 기반 휴리스틱**이라, agent 가
  텍스트-only continuation 을 여러 번 내는 등 실제 흡수 시점과 어긋날 이론적 여지가 남음 → plan §미검증
  가정(user echo)·오픈 퀘스천(승인 경계)으로 정직하게 분리됨.
- 검증 단계: 이번 verify 는 경계 판정 로직을 5 케이스 단위 테스트로 확증했으나, 실제 SDK 서브프로세스와의
  타이밍(서브에이전트 취합 시점 커밋)은 단위 테스트로 재현 불가 — 사람 실측으로 분리.

## 결론 / 다음 단계

- **상태: PASS** — 인수 7/7 충족. 경계 판정 5 케이스가 단위 테스트로 확증. 게이트 green(test 618). → PHASES 승격.
- 사람 확인 대기: 실환경 서브에이전트 위임 시 취합 시점 커밋 재현 · user echo 신호 실측(`npm run dev` +
  디버그 Wire 메시지) · PR 머지.

---

## 파생 이슈 검증 (r2 — 주입 명세 v2 대조 후속, 2026-07-02)

> 대상: plan §파생 이슈 D1(echo 기반 커밋+uuid)·D2(턴 종료 이월). 기록 커밋 `aaa868d`, 구현 커밋 `90e49f5`(Claude 직접 구현). D3(취소 의미론)·D4(병합 표시)는 Open Question 으로 미구현 유지(사용자 결정 대기).

### 해결 확인 매트릭스

| # | 대응 방향 (plan 파생 이슈 표) | 충족 | 증거 |
|---|---|---|---|
| D1-a | steer stdin 메시지에 `uuid`+`priority:'next'` 명시 | ✅ | `adapters/streaming-input.ts` `steerMessage()`·`push(text, uuid)` — 초기 프롬프트에는 미부착. 테스트 `streaming-input.test.ts` "push(text, uuid)" (SDK 0.3.143 `SDKUserMessage.uuid/priority` 타입 지원 실측 — 범프 0) |
| D1-b | claude-map 이 echo 를 `input.echo` 로 승격 | ✅ | `adapters/claude-map.ts` user 분기 — tool_result 없음·`parent_tool_use_id:null`·텍스트(배열/string) → `input.echo{text,uuid?}`. 테스트 5케이스(uuid 보존·string content·서브에이전트 제외·tool_result 동반 제외·공백 무시) |
| D1-c | 커밋 신호를 echo 매칭(uuid 1차/text 폴백)으로 전환, 경계 근사 제거 | ✅ | `turn-coordinator.ts` `markSteerConsumed`/`flushConsumedSteer` — `isSteerFlushBoundary`/`consumeSteerForInput` 제거(`rg` 0건). echo 는 persist/forward 미경유(내부 흡수). flush 는 echo 배치 종료(첫 비-echo 이벤트, persist 전; telemetry 만 persist 후 — usage 링크 보존). 테스트: echo 후 flush·echo 없이 경계/telemetry 미flush·text 폴백·부분 소비·배치 병합·미매칭 무시·pending 0 |
| D2-a | 턴 종료 무조건 flush 제거 — 미소비 pending 큐 잔존 | ✅ | telemetry/synthetic 경로 모두 `flushConsumedSteer`(소비분만). 테스트 "echo 없이는 … pending 잔존" — persist 0·`steer.flushed` 0·큐 1 잔존 |
| D2-b | 다음 `chat:send` 이월 — steer row 선영속+프롬프트 병합+`steer.flushed` 미발신 | ✅ | `ipc/chat/send.ts` `steerCarryover` — resume 경로에서 `drainForFlush` → `persistUserMessage`(새 user row 앞) + `request.text` 병합. renderer `chatStore.ts` send 액션 로컬 커밋(낙관적 버블 앞) — 테스트 "idle 세션 send 는 잔여 pendingSteer 를 새 메시지보다 앞서 로컬 커밋" |
| — | IPC 계약 갱신 | ✅ | `IPC_CONTRACT.md` §2 `chat:steer` 서술·§3 `input.echo`(main 내부 전용 명시)·`steer.flushed` 발생 시점 갱신. 채널 수 무변(이벤트 variant 만 추가) |

### 게이트 재실행 (r2)

```
$ cd app && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci && npm rebuild better-sqlite3
$ npm run lint && npm run typecheck && npm test
lint      : PASS (eslint --cache --fix, 출력 0)
typecheck : PASS (node + web + test)
test      : Test Files 2 failed | 82 passed (84) / Tests 630 passed (630)
  - 실패 2 suite: persist.test.ts · send.runtime-resilience.test.ts
    → electron 바이너리 미설치(프록시 403) import 실패 — 0050~0060 동일 환경 제약, 0 어서션 실패
$ npx vitest run turn-coordinator.test steer-queue.test streaming-input.test claude-map.test chatStore.test
  Test Files 5 passed / Tests 84 passed
```

### 검증 책임 분리 (r2 증분)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| D1/D2 코드 대조·게이트 | ✅ | — | 상기 매트릭스·630 green |
| echo uuid 보존 실측(명세 §8 (a) [I]) | ✖ | ✅ | text 폴백으로 동작 보장 — 보존 확인 시 폴백 의존 제거 가능 |
| C1/C2/C5 실기 시퀀스 재현·carryover 통합(send.ts electron 의존) | ✖ | ✅ | `npm run dev` + 디버그 `[wire]` |
| D3(취소 의미론)·D4(병합 표시) 결정 | ✖ 옵션 제시 | ✅ | Open — plan 파생 이슈 표 |

### 자기 리뷰 (r2)

- 0060 r1 이 "후속 하드닝"으로 남긴 echo 신호를 사용자 제공 명세 v2([V] 확증)로 승격 — r1 의 경계
  근사가 가진 두 결함(허위 커밋 race·모델-미전달 committed)을 코드에서 제거했다.
- carryover 의 main 경로(send.ts)는 환경 제약으로 단위 테스트 불가 — renderer/큐 단위 커버 + 사람
  실측으로 분리. echo 미보존·미발생 CLI 버전에 대한 방어는 "미매칭 무시+이월"이라 안전 방향(유실
  대신 지연)이나, 중복 전달 가능성(소비됐는데 echo 미관측 → 다음 턴 재병합)은 이론상 남는다 —
  실측에서 echo 관측이 확인되면 소멸하는 리스크로 기록한다.

### 결론 (r2)

- **파생 이슈 D1·D2: resolved** — 게이트 green(test 630). D3·D4 는 Open Question 유지.
- 사람 확인 대기: echo uuid 보존·C1/C2/C5 실기 재현·carryover 통합 실측·D3/D4 결정·PR 머지.
