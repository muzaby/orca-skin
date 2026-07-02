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

---

## [검증자 기입] 파생 이슈 (Derived Issues)

> 출처: **0059~0060 후속 검토(2026-07-02)** — 사용자 제공 "Claude Code Pending 메시지 주입 시점 명세 v2"(CLI v2.1.198 바이너리 추출 검증, SDK 0.2.110/0.3.198 기준) 대조. 명세 §6 이 본 plan §"검증되지 않은 가정"의 user echo 신호를 [V] 로 확증(`SDKUserMessageReplay` — drain 시 소비된 큐 커맨드가 user 메시지로 output 스트림에 yield)함에 따라, 0060 이 "후속 하드닝"으로 남긴 자리를 파생 이슈로 승격한다. D1·D2 는 Claude 직접 구현(버그수정), D3·D4 는 Open Question(사용자 결정 대기).

| # | 심각도 | 이슈 | 근거(명세 대조) | 대응 방향 | 상태 |
|---|---|---|---|---|---|
| D1 | High | **커밋 신호가 관찰 근사(echo 미사용) → 허위 커밋 race + uuid/priority 미명시.** steer 가 CLI drain 직후 stdin 도착하면 orca 는 자기가 본 `tool.call.completed` 에서 커밋하지만 모델은 다음 경계에서야 소비 — DB 순서가 실제 모델 컨텍스트와 어긋남. `claude-map.ts` 는 echo(비-tool_result user 메시지)를 수신하면서 드롭 중. `userMessage()` 는 `uuid`/`priority` 미명시(SDK 0.3.143 타입 지원 확인됨 — 범프 불필요). | 명세 §6.1 [V](echo=유일 정밀 신호)·§7.1(uuid+priority 명시)·§8(uuid 보존은 [I] → 내용 폴백) | steer stdin 메시지에 `uuid`(SteerQueue item id)+`priority:'next'` 명시. `claude-map` 이 echo 를 `input.echo`(main 내부 NormalizedEvent)로 승격, TurnCoordinator 커밋 신호를 echo 매칭(uuid 1차/내용 폴백)으로 전환 — 소비 표시(markConsumed) 후 첫 비-echo 이벤트에서 소비분만 병합 flush(DB 정렬 보존). | resolved (Claude 직접 구현 — 아래 구현 보고) |
| D2 | High | **턴 종료 무조건 flush = 모델-미전달 메시지의 committed 영속.** 명세 C1/C7 의 "pending 은 CLI 큐 잔존→다음 턴 소비"는 장수 프로세스 전제인데, orca 는 턴-스코프 one-shot(result→`input.close()`→서브프로세스 종료=CLI 큐 소멸). 그런데 telemetry/synthetic 경계가 미소비 pending 까지 flush("유실 방지") → 모델이 영원히 못 본 텍스트가 committed 로 영속·표시. abort 후 잔여도 다음 턴 첫 경계에서 같은 허위 커밋. 0059 파생 UX "잔여 큐를 다음 턴으로 drain" 미구현 자리. | 명세 §3 C1[I]·C7[V/I]·§6.3("echo 없이 턴이 끝나면 queued 유지가 정답") | 턴 종료(telemetry/synthetic) flush 를 **소비분(echo 관측분)만**으로 축소 — 미소비 pending 은 큐 잔존·renderer pending 유지. 잔여분은 **다음 `chat:send`(같은 세션, idle)에서 이월**: steer row 를 새 user row 앞에 persist + 모델 프롬프트에 `\n\n` 병합, renderer 는 send 액션에서 로컬 커밋(낙관적 버블보다 앞서 append — main `steer.flushed` 미발신으로 중복 방지). | resolved (Claude 직접 구현 — 아래 구현 보고) |
| D3 | Medium | **취소(steerCancel)의 비가역.** `chat:steer` 가 즉시 stdin push 하므로 취소 시점엔 이미 CLI 큐에 있음 — un-push API 없음(명세). 취소해도 모델은 그 텍스트를 경계에서 소비하는데 UI/DB 에는 기록이 없다(보이지 않는 조종). | 명세 §5(제거 API 부재, `priority:"now"` abort 만 존재) | **Open Question — 사용자 결정**: (a) 취소 UX 제한/제거, (b) 주입을 orca 큐 보류로 지연(단, drain 타이밍 race 재유입 트레이드오프), (c) 취소돼도 "이미 전달됨" 표시. echo 전환 후엔 소비 시점이 보이므로 (c) 가 저비용. | open (결정 대기) |
| D4 | Low | **다건 steer 병합 표시 불일치.** CLI 큐/모델 컨텍스트는 개별 user 메시지 N 개(명세 C9), orca DB/UI 는 `'\n\n'` 병합 1행(0059 요구 4 "단일 flush 버블"). echo 기반 커밋은 자연스럽게 개별 커밋과 결이 맞음. | 명세 §3 C9 [V]·§6.2 | **Open Question — 사용자 결정**: 병합 1버블 유지(현행, D1 구현은 소비분 병합 flush 로 유지) vs 개별 버블 전환(모델 컨텍스트와 1:1). | open (결정 대기) |

### 실측 대기 항목 (D1/D2 구현 후 사람 확인)

- echo 의 `uuid` 보존 여부(명세 §8 (a) [I]) — 미보존이어도 내용 폴백으로 동작하나, 보존 확인 시 폴백 의존 제거 가능. `npm run dev` + 디버그 `[wire]`.
- C1(텍스트-only 턴) 종료 시 미소비 큐가 CLI transcript 에 남는지(명세 §8 (c)) — 남지 않는다는 전제(D2 이월 설계 근거)를 실기로 확증.
- C2(도구 중 steer)의 mid-turn echo 커밋 위치·C5(위임 중) task 취합 후 echo — 명세 §6.2 시퀀스 재현.
