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
| D3 | Medium | **취소(steerCancel)의 비가역.** `chat:steer` 가 즉시 stdin push 하므로 취소 시점엔 이미 CLI 큐에 있음 — un-push API 없음(명세). 취소해도 모델은 그 텍스트를 경계에서 소비하는데 UI/DB 에는 기록이 없다(보이지 않는 조종). | 명세 §5(제거 API 부재) → **v3/v4 §7(훅 게이트)로 해법 제공** | **로컬 홀드 + PostToolBatch 게이트 flush 채택**(사용자 제공 명세 v3/v4 §7.3~7.4, 2026-07-02 확정): steer 를 stdin 에 즉시 넣지 않고 로컬 버퍼(held)에 보류(취소·수정 100%), PostToolBatch callback 훅(메인 루프 = `agent_id` 부재)에서 held 전체를 병합 단일 user 메시지(batch uuid·`priority:'next'`)로 주입. flush→echo sub-second 창의 취소는 **거부** — renderer 낙관 제거 → echo 커밋(`steer.flushed`)으로 버블 복원 = 이벤트 흐름만으로 정직 화해(전용 기전 0). 검토 대안 A2(시간 유예 창)+F(tombstone 화해)는 이벤트 게이트가 상위 호환이라 폐기. "stdin 주입 = 조작 권한 포기"(명세 §7.4) 결론 채택. | resolved (Claude 직접 구현 — 아래 구현 보고) |
| D4 | Low | **다건 steer 병합 표시 불일치.** CLI 큐/모델 컨텍스트는 개별 user 메시지 N 개(명세 C9), orca DB/UI 는 `'\n\n'` 병합 1행(0059 요구 4 "단일 flush 버블"). | 명세 §3 C9 [V]·§6.2 | **게이트 병합 단일 주입으로 D3 과 동시 해소**(사용자 확정: "다건 steer 는 커밋 시 합쳐서 1건으로 표현"): PostToolBatch 게이트에서 held 전체를 **병합해 user 메시지 1건으로 주입** → 1버블이 배치 확률이 아니라 구조로 보장 + 모델 컨텍스트=트랜스크립트 1:1(구 F5 불일치도 소멸). 배치를 넘어 서로 다른 경계에서 소비된 건 사이엔 어시스턴트 응답이 끼므로 강제 병합하지 않는다(트랜스크립트 왜곡 방지). | resolved (D3 과 동시 구현 — 아래 구현 보고) |
| D5 | High | **steer echo 미발화 — CLI replay 플래그 기본 off.** 실기에서 steer 가 모델에 반영됐는데도 버블 승격이 안 됨(사용자 버그리포트 2026-07-02). 원인: CLI 직렬화 계층은 drain 된 큐 커맨드(`queued_command` attachment)를 **`replayUserMessages` 가 참일 때만** user(isReplay) 메시지로 output 스트림에 yield 하는데(`h && attachment.type==="queued_command"` 게이트, `replayUserMessages: h = !1` 기본 false), SDK 의 기본 spawn argv 에 `--replay-user-messages` 가 없다(bridge 모드만 전달). 즉 **echo 가 구조적으로 한 번도 안 왔다** — D1 커밋 신호 영영 미발화 + D2 carryover 가 이미 소비된 steer 를 다음 턴에 중복 전달. | v0.3.143 리눅스 바이너리 내장 JS 직접 추출 실측(drain→`GM8` queued_command 생성→직렬화 게이트→`E7A` transport 생성자→`--replay-user-messages` argv). 명세 §6.1 의 "echo=항상 발화 [V]" 는 **플래그 조건부**로 정정 | `claude.ts` sendMessage options 에 `extraArgs: {'replay-user-messages': null}`(bare flag) 상시 전달. 활성 시 echo 는 **content=원문 그대로**(`_H.prompt` — kK4 래핑은 API 요청 측만)·**uuid=`source_uuid`=orca batch uuid 보존** 으로 실측 확인 — uuid 1차/text 폴백 매칭 모두 성립(§9 (a)·(e) 동시 해소). 부작용인 턴 첫 프롬프트 replay echo 는 coordinator 의 매칭 실패 무시(허위 커밋 구조적 불가)로 흡수 — carryover 가 send 전에 큐를 비우므로 오매칭 창 없음. | resolved (Claude 직접 구현 — 아래 구현 보고) |

### D1·D2 구현 보고 (Claude, 커밋 `90e49f5`)

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `adapters/{streaming-input,claude,claude-map,types}.ts`·`lifecycle/{steer-queue,turn-coordinator,ports,session-runtime}.ts`·`ipc/chat/send.ts`·`shared/ipc.ts` / renderer: `store/chatStore.ts` / docs: `IPC_CONTRACT.md` / tests: steer-queue·turn-coordinator·streaming-input·claude-map·chatStore |
| D1 핵심 | ① `push(text, uuid)` — steer stdin 메시지에 `uuid`(SteerQueue item id)+`priority:'next'` 명시(SDK 0.3.143 타입 지원 확인, 범프 0) ② claude-map: tool_result 없음·`parent_tool_use_id:null`·텍스트 user 메시지 → **`input.echo`**(main 내부 variant, renderer 미전달) ③ TurnCoordinator: echo → `SteerQueue.markConsumed`(uuid 1차/text 폴백, 미매칭 무시=허위 커밋 구조적 불가) → **첫 비-echo 이벤트에서 소비분만 병합 flush**(persist 전 — DB 정렬 보존; telemetry 만 persist 후). `isSteerFlushBoundary` 경계 근사 제거 |
| D2 핵심 | ① 턴 종료(telemetry/synthetic)에서 미소비 pending flush 제거 — 소비분만 커밋, 잔여는 큐 잔존(renderer pending 유지) ② 다음 `chat:send`(같은 세션·idle)에서 `drainForFlush` 이월: steer row 를 새 user row **앞에** persist + 모델 프롬프트 `\n\n` 병합, `steer.flushed` 미발신 ③ renderer send 액션이 pendingSteer 를 낙관적 버블보다 앞서 로컬 커밋(`APPEND_COMMITTED_USER_MESSAGE`) — 라이브·재로드 정렬 `[steer][새 메시지]` 일치 |
| 게이트 | lint PASS / typecheck(node+web+test) PASS / test **630 passed** (신규: coordinator echo 8케이스·steer-queue markConsumed/drainConsumed·streaming-input uuid/priority·claude-map echo 5케이스·chatStore carryover). 환경 제약: electron 미설치 2 suite(`persist`·`send.runtime-resilience`) import 불가 — 0050~0060 동일 계열 |
| 한계 | `chat:send` carryover 경로(send.ts)는 electron 의존이라 이 환경에서 단위 테스트 불가 — renderer 로컬 커밋·SteerQueue drain 은 각각 테스트로 커버, 통합은 사람 실측 |

### D3·D4 설계 확정 요지 (명세 v3/v4 검토, 2026-07-02)

사용자 제공 **명세 v3/v4**(§7 훅 기반 steer 조작 게이트)를 검토·채택. 핵심: "로컬에 최대한 오래 들고
있다가 게이트 훅 시점에 최종본 주입"이 이 엔진에서 유일하게 완전한 취소 모델(§7.4). steer 항목 수명:

```
[held] 로컬 버퍼 — 취소·수정 100% (stdin 미주입)
  → PostToolBatch 게이트(메인 루프): held 전체 병합 → 단일 user 메시지(batch uuid) push
[flushed] CLI 큐 — 취소 거부(sub-second 창, 직후 drain·echo)
  → echo 관측(D1 경로) → [committed] 병합 1버블. 턴 종료 잔여 → D2 carryover(항상 취소 가능)
```

**orca 실측 확증(구현 전제)**: ① SDK 0.3.143 이 `PostToolBatch` 지원(`HOOK_EVENTS`·dts "배치 전체
해결 후 다음 모델 요청 전 1회" — 명세 §7.5 와 일치, 범프 0) ② callback 훅 파이프라인 기존재
(`Options.hooks` + `adaptHooks`, `adapters/claude-adapt.ts:114`) ③ 메인 루프 판별자
`BaseHookInput.agent_id`(서브에이전트 발화 시에만 존재 — dts 명시) ④ FIFO 강화: callback 훅 응답과
steer push 가 같은 stdin FIFO 라 push 를 응답 전에 쓰면 CLI 가 반드시 먼저 읽음 → same-batch 포함이
파이프 순서로 뒷받침(명세 §7.3 [I]의 orca 특수 강화; 실측 1회 권장, 부정돼도 다음 경계 열화로 안전).

**orca 편차(명세 §7.5 권장안 대비)**: ① **Stop 게이트(C1) 비채택** — orca 는 턴-스코프 서브프로세스
(result→close)라 Stop flush 는 같은 query 안 새 턴 시작 = 0054 one-shot 수명과 충돌; C1/턴 잔여는
기존 D2 carryover 가 커버(로컬 홀드라 "죽은 stdin 사본" 개념 자체 소멸) ② **SubagentStop 게이트
불요** — PostToolBatch 와 같은 경계에 합류(명세 자인), 단일 게이트로 단순화; UserPromptSubmit(P2)은
orca 에 P2 pickup 이 없어 해당 없음.

**모듈 영향(구현 범위)**: `steer-queue.ts`(`flushBatch`·flushed cancel 거부·batch uuid markConsumed) ·
`extensions/types.ts`(`TurnRequest.takeSteerFlush` 콜백 — 의존 역전) · `claude-adapt.ts`
(`makeSteerGateHook`·`mergeHooks`) · `claude.ts`(게이트 훅 배선) · `ipc/chat/send.ts`(`chat:steer` 의
즉시 `injectMessage` 제거 + 콜백 조립). TurnCoordinator·renderer·IPC 채널/variant **무변경**.

### D3·D4 구현 보고 (Claude, 커밋 `8e5d3fd`)

> 구현 전 수석엔지니어 검토(2026-07-02): SDK 0.3.143 dts 를 tarball 로 직접 대조해 설계 전제 3건
> ([`PostToolBatch`] "batch 전체 해결 후 다음 모델 요청 전 1회"·`agent_id` 서브에이전트 한정·
> `SDKUserMessage.uuid/priority`) 전부 실증 — 설계 승인 + 보완 5건(B1~B5)을 반영해 구현.

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `lifecycle/{steer-queue,ports,session-runtime}.ts`·`adapters/{claude,claude-adapt,streaming-input,types,mock}.ts`·`extensions/types.ts`·`ipc/chat/send.ts` / tests: steer-queue·claude-adapt·turn-coordinator |
| D3 핵심 | ① SteerQueue 상태를 플래그 증식 대신 **컬렉션 분리**(B1): `held[]`(취소 100%) / `flushed FlushedBatch[]`(uuid·병합 텍스트 flush 시점 1회 보존·consumed) — 취소 거부·배치 매칭·carryover 포함이 구조로 보장 ② `chat:steer` = enqueue+`steer.queued` 만(즉시 injectMessage 제거) ③ `TurnRequest.takeSteerFlush` 콜백(의존 역전, requestApproval 대칭) — send.ts 가 `turn.dbSessionId` **동적 참조** 클로저로 조립(B3) ④ `claude-adapt.makeSteerGateHook(take, push)`: `agent_id` 부재(메인 루프)에서만 take→push, push 가 훅 응답 반환 선행(FIFO same-batch), **fail-open**(예외 → `{}` — 부가기능이 턴 본체를 못 죽임, B2) + `mergeHooks`(이벤트별 매처 concat) ⑤ flushed 취소 거부 = `cancel` 이 held 만 검색 → `steer.cancelled` 미발신 → echo 커밋(`steer.flushed`)이 renderer 낙관 제거를 복원(이벤트 흐름만으로 정직 화해 — renderer 무변경 확인) |
| D4 핵심 | 게이트가 held 전체를 병합 단일 user 메시지(batch uuid)로 주입 → 1버블=1 모델 메시지 구조 보장. `drainConsumed` 는 소비 확정 **배치** 병합 — 복수 배치 동시 회수는 연속 echo(같은 drain 지점 소비)뿐이라 병합이 D4 규칙(어시스턴트 응답 낀 경계만 분리)과 정합. `markConsumed`/`drainConsumed`/`drainForFlush` 시그니처 유지 → **TurnCoordinator·renderer·IPC 무변경** |
| dead 배선 | `injectMessage` 전면 제거(B4 — ports·adapters/types·session-runtime·mock·claude 반환 객체, 유일 호출자 소멸). `canSteer` 의미 주석 갱신(B5): "mid-turn stdin 주입 가능"→"steer UX 수용(게이트/carryover 전달)" |
| 안전 열화 논증 | FIFO 부정 시 다음 경계 소비 or carryover — **이중 전달 구조적 불가**(CLI 가 drain 했다면 다음 API 요청 존재→echo→consumed; 못 했다면 모델 미전달→carryover 정당). C1(텍스트-only)은 게이트 미발화→carryover(현행 대비 개선 — one-shot 에서 stdin 사본이 죽던 것). 훅 상시 등록은 `hook_*` SDK 메시지가 claude-map fallthrough `[]` 라 이벤트/stall 무영향 |
| 게이트 | lint PASS / typecheck(node+web+test) PASS / test **641 passed** (신규: steer-queue 상태모델 8케이스·makeSteerGateHook 4·mergeHooks 3). 환경 제약: electron 미설치 2 suite(`persist`·`send.runtime-resilience`) import 불가 — 0050~0060 동일 계열(electron 바이너리 다운로드 403) |

### D5 구현 보고 (Claude, 커밋 `f449c67`)

| 항목 | 내용 |
|---|---|
| 원인 분석 방법 | 이 환경은 중첩 claude 서브프로세스 실행 불가 → **동봉 CLI 바이너리(linux-x64, 233MB Bun 컴파일)의 내장 JS 를 오프셋 추출**로 판독. 사슬: mid-turn drain(`getCommandsByMaxPriority("next")` + `agentId===void 0` 메인 루프 필터) → `GM8`: 커맨드→`{type:"queued_command", prompt:원문, source_uuid:커맨드 uuid}` attachment → 직렬화 계층: `else if (h && a.attachment.type==="queued_command") yield {type:"user", content:_H.prompt, uuid:_H.source_uuid, isReplay:!0}` — **`h`=`replayUserMessages` 기본 `!1`** → transport 생성 `E7A(…, $.replayUserMessages, …)` ← argv `--replay-user-messages`(SDK 기본 spawn 미포함, bridge 모드 전용) |
| 수정 | `adapters/claude.ts` sendMessage options 에 `extraArgs: {'replay-user-messages': null}` — sdk.mjs 의 extraArgs 직렬화(`null`→bare flag) 실측. `complete()`(제목 생성)는 steer 무관이라 미적용 |
| 부수 효과 검토 | 플래그 활성 시 턴 첫 프롬프트도 isReplay user 로 replay 됨 → claude-map 이 `input.echo` 로 승격하지만 coordinator 매칭 실패 무시로 흡수(그 시점 flushed 큐는 항상 빈 상태 — carryover 가 send 전에 큐를 비움). renderer 미전달·IPC 무변경 |
| 명세 정정 | 명세 §6.1 "drain 소비분은 user 메시지로 output 스트림에 yield [V]" 는 **`--replay-user-messages` 조건부**로 정정. §9 (a) uuid 보존·(e) 원문 보존은 플래그 활성 전제에서 [V] 로 승격 |
| 게이트 | lint/typecheck(3종) PASS, test **642 passed**(신규 `claude.steer-replay.test.ts` — extraArgs 회귀 고정). electron 2 suite 환경 제약 동일 |

### 실측 대기 항목 (사람 확인)

- ~~echo 의 `uuid` 보존 여부(명세 §9 (a) [I])~~ — **해소(D5 바이너리 실측)**: wire echo 는 `uuid: source_uuid`(=orca batch uuid) 보존. 단 `--replay-user-messages` 필요(D5).
- ~~P1(attachment 경로) 주입분 echo 의 원문 보존(명세 §9 (e))~~ — **해소(D5 바이너리 실측)**: wire echo 의 content 는 원문 그대로(`_H.prompt`) — "The user sent a new message…" kK4 래핑은 모델용 API 요청 측에만 적용.
- C1(텍스트-only 턴) 종료 시 미소비 큐가 CLI transcript 에 남는지(명세 §9 (c)) — 남지 않는다는 전제(D2 이월 설계 근거)를 실기로 확증.
- C2(도구 중 steer)의 mid-turn echo 커밋 위치·C5(위임 중) task 취합 후 echo — 명세 §6.2 시퀀스 재현. **D5 수정 후 재실기 1순위** — steer 입력→도구 경계 flush→echo→버블 승격 전체 사슬.
- PostToolBatch 훅 대기 중 stdin write 의 same-batch 포함(명세 §9 (d)) · 훅 등록만으로 steer 미사용 턴 무회귀 · 위임 중 서브에이전트 내부 배치에서 flush 안 됨(`agent_id` 필터) · replay 플래그 활성 후 턴 첫 프롬프트 replay echo 의 무해성(렌더러 표시 0) 확인.
