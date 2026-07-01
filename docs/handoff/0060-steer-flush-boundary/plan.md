# Plan — 0060-steer-flush-boundary

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 **0059 의 후속 버그수정** — steer pending 이 입력 즉시 flush 되던 문제를 "agent 가 입력을 흡수하는 turn 경계에서만 flush" 로 고친다. 비기능(버그수정) = **Claude 직접 구현**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0060-steer-flush-boundary` |
| 작성자 | Claude Code |
| 일자 | 2026-07-01 |
| 상태 | **IMPL_DONE** (설계+구현+게이트 Claude 단독) |
| 구현 주체 | **Claude** (비기능 — 버그수정) |
| 선행 | `0059-steer-queue-feedback`(steer/queue enactment + pending UX) · `0056`(admission) · `0052`(TurnCoordinator) |
| 브랜치 | `claude/steer-pending-flush-bug-cjgtld` |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 버그리포트 | steer pending 메시지가 **입력 즉시 flush** 된다. "query 동작이 소비와 같은 행위가 아님". | 라이브 세션(2026-07-01) |
| 실관찰 | 실제 Claude 는 **서브에이전트 위임 시 모든 응답이 취합되는 시점**에 mid-turn 입력을 커밋한다. | 사용자 관찰 |
| 방향 결정 | flush 신호를 **관찰 경계 기반**(도구/권한 이벤트 = mid-turn pause 지점)으로 설계. 스펙(opencode) + 실관찰 모두 권장. | AskUserQuestion(2026-07-01) |
| 참고 스펙 | opencode steer flush 스펙 — flush 는 continuation 턴 헤드에서 tool_use settle 뒤(서브에이전트=task 도구 §7.5), 스트림 핸들러 안에서 promote 금지(§9). | 사용자 제공 스펙 문서 |

## Context (왜)

0059 는 flush 의 권위 신호로 **producer-side pull (`onConsume`/`nextInjectedInput`)** 을 골랐다(그 plan 자료조사·리스크 표: "큐 소비 = producer pull, output 이벤트 아님 → 제너레이터 yield 지점에서 결정적 관측"). **이 가정이 틀렸다.** SDK 는 `query({prompt: input.stream})` 의 입력 AsyncIterable 을 **eager 하게 drain** 해 서브프로세스 stdin 으로 흘리므로, pull 은 다음 turn 경계가 아니라 `input.push` 즉시 일어난다. 그 결과:

```
chat:steer → enqueue → steer.queued(pending 버블) → injectMessage → input.push → wake()
  → (SDK 가 이미 다음 입력을 기다림) 즉시 재개 → nextInjectedInput() → consumeSteerForInput()
  → drainForFlush + persistSteerUserMessage + steer.flushed  ← 입력 즉시 커밋(버그)
```

즉 **"SDK 가 stdin 으로 입력을 당김(query/pull)" ≠ "agent 가 turn 경계에서 그 입력을 소비함"**. orca 는 opencode 와 달리 agentic 루프 전체를 SDK 서브프로세스(=실제 Claude Code)에 위임하고 이벤트 스트림을 *관찰만* 하므로, turn head 를 직접 소유하지 않고 **관찰 가능한 경계 이벤트**로 flush 를 구동해야 한다.

## 설계 (관찰 경계 기반)

flush 를 **입력 push 경로에서 분리**하고 **TurnCoordinator 이벤트 루프가 관찰하는 turn 경계**로 구동한다.

1. **`adapters/streaming-input.ts`** — `push(text)` 는 리터럴 user 메시지를 큐에 넣어 SDK 로만 전달(thunk 간접·`onConsume`·`nextInjectedInput` 제거). pull 이 더 이상 drain/persist 를 트리거하지 않는 **단일 격리점**.
2. **`lifecycle/turn-coordinator.ts`** — `send()` 의 `consumeInjectedInput` 결합 제거. 이벤트 루프에서 `isSteerFlushBoundary` 판정 시 `consumeSteerForInput`(drain→persistSteerUserMessage→`steer.flushed`) 호출:
   - **telemetry** (턴 종료 — 도구 없는 텍스트-only 턴 경계). persist 이후 실행해 usage messageId 링크·assistant 마감 보존.
   - **최상위 `tool.call.completed`** (`parentToolRunId===undefined`) **이며 최상위 open 도구 잔여 0**(병렬 배치 전부 settle = agent continuation 직전). 서브에이전트 내부 도구는 부모 경계 아님(§7.5). 부모 Task tool_result 가 여기 해당 → "서브에이전트 모든 응답 취합 시 flush" = 실관찰 일치.
   - 스트림이 경계 없이 끝나도(synthetic telemetry) 잔여 pending flush(유실 방지).
3. **`ipc/chat/send.ts` `chat:steer`** — enqueue + steer.queued + injectMessage(stdin 즉시 push) 유지. injectMessage 는 이제 flush 를 유발하지 않음(§1 효과).
4. **`extensions/types.ts`·`adapters/claude.ts`** — dead 배선(`onInputConsumed`/`consumeInjectedInput`/`nextInjectedInput`/`onConsume`) 제거.
5. **persist·renderer 무변경** — `persistSteerUserMessage`(진행 중 assistant 마감→steer row→이후 새 메시지) 는 호출 시점만 이동. renderer `steer.flushed→APPEND_COMMITTED_USER_MESSAGE`(0059 D1) 는 flush 를 경계에서 늦게 받는 것만으로 옳게 동작. **백엔드 전용 수정.**

## 인수 기준

1. 입력 push(pull) 즉시엔 flush 안 됨(producer-pull 분리).
2. 최상위 tool.call.completed 배치 settle 시 flush, continuation 이전 커밋.
3. 서브에이전트 내부 도구(parentToolRunId) 완료는 부모 flush 경계 아님.
4. 병렬 최상위 도구 전부 settle 후에만 flush.
5. 도구 없는 턴은 telemetry 경계에서 flush.
6. pending 없으면 경계에서도 persist 호출 0.
7. 게이트 lint/typecheck/test green, 레이어 경계·순환 0.

## 영향 받는 파일

- `app/src/main/adapters/streaming-input.ts` · `adapters/claude.ts` · `extensions/types.ts`
- `app/src/main/lifecycle/turn-coordinator.ts`
- 테스트: `adapters/streaming-input.test.ts`(push 리터럴·close 후 무시) · `lifecycle/turn-coordinator.test.ts`(경계 flush 5케이스)

## 게이트 결과

- `npm run lint` PASS / `npm run typecheck`(node+web+test) PASS / `npm test` **618 passed**.
- 환경 제약: `persist.test`·`send.runtime-resilience.test` 2 suite 는 electron 바이너리 미설치로 import 불가(0059 D1 동일 계열, 변경 무관). better-sqlite3 은 Node ABI 재빌드 후 green.

## 검증되지 않은 가정 (실측 여지)

- **user echo 신호**: `claude-map.ts` 는 `user` 메시지 중 tool_result 만 이벤트화하고 텍스트 echo 는 드롭. SDK 가 흡수한 steer 를 `user`(text) 로 echo 한다면 그것이 더 권위있는 flush 신호(경계 근사 아닌 실제 흡수 시점). `npm run dev` + 디버그 "Wire 메시지"(0025 `[wire]`) 로 (a) echo 유무 (b) 도구/서브에이전트 settle 과의 타이밍 실측 → 확인 시 echo 신호 승격(후속 하드닝). 이번 구현은 echo 비의존 경계-기반.

## 오픈 퀘스천

- 승인(권한) 이벤트를 tool.call.completed 와 별개 flush 경계로 둘지 — 기본은 tool.call.completed 로 커버(승인→도구 실행 후). 실측 후 필요 시 추가.
