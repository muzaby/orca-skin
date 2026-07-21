# Plan — 0136-background-subagent-runtime

> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0136-background-subagent-runtime` |
| 작성자 | Claude Code |
| 일자 | 2026-07-21 |
| 매핑 | PHASES (verify PASS 시 승격) — `0135-subagent-foreground-restore` 와 짝 |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | inflight 표시 붕괴 검토 후 "단기 핸드오프 문서와 중기 핸드오프 문서를 먼저 작성하고 구현을 시작하라" | 라이브 세션 요청(2026-07-21) |
| 추론 의도 | **중기** = CLI 2.1.198+ 의 "서브에이전트 기본 백그라운드" 의미론을 Orca 런타임이 **올바르게 소화**하는 것: ① 런치 영수증의 구조화 판정 ② 턴 종료 후 도착하는 백그라운드 이벤트의 라이브 배달 ③ 그 동안의 사용자 send 상호작용 보존. (검토 보고의 "중기" 3항을 사용자가 채택한 것으로 해석 — 추론) | 검토 보고(본 세션) + 사용자 지시 "중기" |

## Context (왜)

`0135` 가 기본값을 foreground 로 원복해도, **백그라운드 서브에이전트 경로 자체는 여전히 존재**한다 — `ORCA_SUBAGENT_BACKGROUND=1` opt-in, 그리고 모델이 `run_in_background: true` 를 명시한 호출(0135 AC2 는 명시값을 보존). 이 경로에서 Orca 런타임은 세 갈래로 깨진다:

1. **런치 영수증 오판** — 부모 Agent `tool_result` 의 wire `content` 는 모델용 텍스트고, 구조화 출력(`{status:'async_launched', …}`)은 SDK 메시지의 **별도 필드 `tool_use_result`** 에 온다. claude-map 이 `p.content` 만 실으므로 렌더러 `isAsyncLaunchedResult` 가 매치되지 않아 실행 중인 에이전트가 "완료" 로 렌더된다.
2. **프레임 밖 이벤트 적체** — 메인 턴 result(terminal)에서 `SessionRuntime` 프레임이 닫힌 뒤 도착하는 백그라운드 진행 이벤트(child tool/text·task_progress)·`task_notification`(settled)·CLI 가 완료 알림으로 스스로 여는 자동 턴의 전체 스트림이 `unframed` 버퍼에 쌓여 **다음 사용자 send 까지 배달되지 않는다**. settle(권위 정착)도 코디네이터 루프 안에서만 돌므로 라이브 정착이 불가능하다.
3. **벌크 배달 렌더 붕괴** — 다음 send 의 `openFrame()` 이 백로그를 통째로 합류시켜, 이미 끝난 대화가 rAF 한두 프레임에 커밋되고 백로그 속 telemetry 가 inflight 를 즉시 내린다("응답은 오는데 턴이 끝난 것처럼").

본 핸드오프는 이 세 갈래를 각각 ① `tool_use_result` 구조화 매핑 ② **listen 턴**(입력 push 없는 프레임 소비) ③ busy-send 릴리즈 밸브로 해소한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| CLI 2.1.198 백그라운드 기본화 + 완료 시 알림 턴("is notified when they finish") — 알림은 CLI 내부 큐로 주입되고 drain 루프가 즉시 턴을 연다 | 웹 https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md §2.1.198, SDK `sdk.d.ts`(0.3.215) interrupt receipt 문서("auto-resume continuations … the drain loop, which starts the next queued turn immediately") |
| `SDKUserMessage.tool_use_result` = "Structured tool output — the tool's full Output object, not the string content sent to the model … For the Agent/Task tool … render from it instead of parsing the tool_result text" | SDK 0.3.215 `sdk.d.ts:4526-4529` |
| async 런치 영수증 구조: `{status:'async_launched', agentId, description, prompt, outputFile, …}` (AgentOutput 유니언) | SDK 0.3.215 `sdk-tools.d.ts:146-175` |
| claude-map 은 `p.content` 를 result 로 실음 — `tool_use_result` 미독 | `app/src/main/adapters/claude-map.ts:315-339` |
| 렌더러는 output 이 `{status:'async_launched'}` **객체**일 때 '실행 중' 유지 — 기존 테스트 픽스처도 객체 가정(= 본 매핑이 원래 계약) | `app/src/renderer/src/features/chat/lib/parts.ts:275-281`, `parts.test.ts:307` |
| 프레임 절단: terminal 에서 frame 닫힘·이후 이벤트는 `unframed`, 다음 `openFrame()` 이 백로그 합류. 자동 프레임 오픈은 Orca 자체 `pendingMessages` 폴링만 커버 | `app/src/main/features/sessions/session-runtime.ts:284-306,258-265`, `app/src/main/app/chat-turn.ts:732-737` |
| settled 권위 정착(`settleSubagentTask`)·중단 coerce 는 **코디네이터 이벤트 루프 안**에서만 동작 | `app/src/main/features/chat/turn-coordinator.ts:298-305`, `features/chat/settle.ts:44-58` |
| tool_result 영속은 `upsertToolResultPart`(toolRunId 멱등) — 런치 영수증 뒤 settled 권위 결과가 덮어써도 안전 | `app/src/main/features/history/writer.ts:260-272` |
| 렌더러 view 페어링도 같은 toolRunId 의 **마지막** tool_result 가 이김(Map.set) — 이중 결과 안전 | `app/src/renderer/src/features/chat/lib/parts.ts:78-105` |
| stall 타이머 120s — 이벤트 무소식이면 `abortTurn(turn,'stall')`. 백그라운드 대기(침묵 가능)에 그대로 쓰면 오판 | `app/src/main/features/chat/timers.ts:4,21` |
| busy send 는 `reserveOnBusySession` 이 held 적재 — flush 는 게이트 훅(PostToolBatch) 또는 턴 종료 자동 연속뿐. CLI 유휴 + 프레임만 열린 상태에선 아무도 flush 못 함(밸브 필요 근거) | `app/src/main/app/chat-turn.ts:214-320,732-737` |
| 렌더러는 main 이 시작한 턴도 활동 이벤트 도착 시 `BEGIN_TURN` 자동 전이 — listen 턴이 배달하는 알림 턴 스트림에 inflight 가 자연 동작 | `app/src/renderer/src/features/chat/store/chatStore.ts:332-343` |
| 신규 `SDKBackgroundTasksChangedMessage`(레벨 신호, membership 변화마다 전체 집합) 존재 — 에지 신호(task_started/notification) 유실 대비 레벨 신호. 채택은 후속 검토 | SDK 0.3.215 `sdk.d.ts`(BackgroundTasksChanged 문서) |

## 인수 기준 (Acceptance Criteria)

1. **구조화 매핑**: claude-map 이 SDK user 메시지에 `tool_use_result` 가 있고 그 `status === 'async_launched'` 이며 메시지의 tool_result 블록이 **정확히 1개**일 때, 해당 `tool.call.completed.result` 를 `tool_use_result` 객체로 싣는다. 그 외(완료 결과·복수 블록·필드 부재)는 현행 `p.content` 유지.
2. AC1 결과로 렌더러(`isAsyncLaunchedResult`→`deriveSubagentTaskStatus`)가 백그라운드 런치된 Task 행을 '실행 중' 으로 유지한다(기존 renderer 코드 무변).
3. **listen 턴**: `TurnRequest.listen?: true` — `SessionRuntime.runAttempt` 가 pushTurn/spawn 없이 프레임만 열어 소비한다(백로그 합류 포함). 채널이 없거나 죽었으면 즉시 빈 스트림 반환. terminal 도착 시 일반 턴과 동일하게 프레임이 닫힌다.
4. **listen 턴 구동**: chat-turn 의 턴-후 연속 루프가 "held pending 없음 + 미정착 백그라운드 태스크 존재 + 채널 생존" 이면 listen 턴을 열어 CLI 자동 턴(진행·settled·알림 턴)을 라이브 소비한다 — settle/persist/relay/제목/usage 가 기존 버스 파이프라인 그대로 흐른다. held pending 이 있으면 기존 자동 연속 턴이 우선.
5. **백그라운드 태스크 추적**: `subagent.task` phase `started` 등록 → `settled` 해제, 세션 키. 코디네이터가 이벤트 루프에서 갱신하고 chat-turn 루프가 조회한다. 채널 콜드 spawn 전에는 해당 세션 추적을 리셋(스폰 = in-process 태스크 소멸).
6. **stall 미적용**: listen 턴은 stall 타이머를 무장하지 않는다(백그라운드 침묵이 '응답 없음 중단' 으로 오판되지 않게). 사용자 명시 취소(중단 버튼)·owner 소멸 경로는 일반 턴과 동일하게 동작.
7. **busy-send 릴리즈 밸브**: listen 턴 진행 중 사용자 send(held 예약 성공) 시 listen 프레임을 종료시켜(`draining` 미설정 — 이후 이벤트는 unframed 로 이어짐) 연속 루프가 즉시 held flush 턴으로 전환한다.
8. **채널 사망 정리**: listen 턴이 채널 사망으로 끝났고 추적 중 태스크가 남아 있으면 합성 settled(`failed`)로 부모 Task/열린 child 를 정착(기존 `createSubagentSettlementEvents` 재사용)하고 추적을 비운다 — '실행 중' 영구 고착 방지.
9. 단위 테스트: ① claude-map `tool_use_result` 매핑(적용/비적용 분기) ② session-runtime listen 프레임(백로그 합류·terminal 종료·채널 부재 즉시 종료·`endListenFrame` 릴리즈) ③ 백그라운드 추적기 등록/해제/리셋 ④ 코디네이터 listen 요청의 stall 미무장. (chat-turn 루프 통합은 기존 `chat-turn.continuity` 계열이 electron 로드 스위트라 실기/CI 몫 — 순수 단위로 대체.)
10. 게이트: lint/typecheck 0 error + 순수 vitest green(electron ABI egress 베이스라인 분리 보고 관례). 문서 동기: `docs/arch/backend/provider-runtime.md` 서브에이전트 절에 백그라운드 라이프사이클(런치 영수증→listen 턴→settled 권위 정착) 요약 추가.

## 범위 / 비범위

- **범위**: main 프로세스 — `adapters/claude-map.ts` · `adapters/turn.ts`(listen 플래그) · `features/sessions/session-runtime.ts` · `features/chat/turn-coordinator.ts` · `features/chat/background-tasks.ts`(신규 추적기) · `app/chat-turn.ts` + 각 테스트 + provider-runtime.md 동기.
- **비범위**:
  - `SDKBackgroundTasksChangedMessage`(레벨 신호) 채택 — 에지 신호 유실 대비 강화. 후속 검토로 기재만.
  - `remote_launched`(CCR 원격 디스패치) 결과 매핑 — Orca 미사용 경로.
  - **백그라운드를 Orca 제품 기본으로 전환할지** — Open Question(사용자 결정), 아래 리스크 절.
  - 렌더러 변경 — 기존 계약(`isAsyncLaunchedResult`·자동 BEGIN_TURN·settled 덮어쓰기)이 이미 소화 가능함을 자료조사로 확인.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- SDK 0.3.215 `tool_use_result` 필드(자료조사 2행)·`task_started/task_progress/task_notification` 시스템 메시지 shape 불변(0.3.143↔0.3.215 diff 실측 동일). 신규 의존성 0.
- 백그라운드 태스크 완료 시 CLI 가 알림 턴(result 로 종결)을 연다 — listen 프레임의 자연 종료 조건. 알림 턴이 없는 엣지는 릴리즈 밸브(AC7)·채널 사망 정리(AC8)가 커버.
- persistent 채널 + pump(0067) 구조 위에서만 의미 있음 — oneshot/mock 은 listen 미지원(채널 부재 즉시 종료 AC3 로 자연 무해).

## 설계

**① 구조화 매핑 (claude-map)** — user 분기에서 `msg.tool_use_result` 를 좁혀 읽는다:

```
const structured = (msg as {tool_use_result?: unknown}).tool_use_result
→ tool_result 블록 수 === 1 && isRecord(structured) && structured.status === 'async_launched'
→ events.push({type:'tool.call.completed', …, result: structured, …})
```

`isError`·`parentToolRunId`·`subagentMeta` 처리는 현행 그대로. 완료(비-async) 결과는 wire content 유지 — 렌더 본문(요약 텍스트)·복사 대상이 현행과 동일하게 남는다.

**② listen 턴 (session-runtime + coordinator + chat-turn)**

- `TurnRequest.listen?: boolean` (어댑터는 이 필드를 결코 보지 않는다 — SessionRuntime 이 선분기).
- `SessionRuntime.runAttempt`: `req.listen` 이면 `beginSend()` 후 채널 생존 검사 → 생존 시 `openFrame()`(백로그 선합류) + `consumeFrame`, 사망/부재 시 `markLive()` 후 즉시 return. `listenFrame` 참조를 별도로 들고, 신규 public `endListenFrame()` 은 **현재 프레임이 listen 프레임일 때만** `frame=null` 후 `end()` — `consumeFrame` 의 finally 가 `this.frame !== frame` 을 보고 `draining` 을 세우지 않으므로 이후 이벤트는 unframed 로 살아남아 다음 프레임에 합류한다(릴리즈 밸브의 무손실 근거).
- `TurnCoordinator.run`: `request.listen` 이면 stall 타이머 대신 no-op 타이머(AC6). 나머지(이벤트 reduce·settle·commit·버스 팬아웃·로그)는 동일 — `chat.turn.started` 메타에 `listen: true` 를 실어 관측 구분.
- `features/chat/background-tasks.ts`(신규, 순수): `BackgroundTaskTracker` — `started(sessionId, toolUseId)` / `settled(sessionId, toolUseId)` / `ids(sessionId)` / `clear(sessionId)`. 코디네이터 deps 에 optional 포트로 주입(수직 슬라이스 경계 유지 — chat 슬라이스 내부).
- `chat-turn.ts` 연속 루프 확장:

```
while (!aborted && sessionId):
  if pending > 0        → 기존 자동 연속 턴 (held flush)
  elif tracker.ids(sessionId).size > 0 && runtime.channelAlive
                        → listen 턴: makeContinuationTurn + coordinator.run({...request, listen:true, text:'', signal:…}
                          − promptUuid/preludes/forkFrom/handoff)
                          루프 재평가(알림 턴 종료 → pending/추적 재검사)
  else                  → break
```

  - listen 턴 진입 전 `listenRelease` 맵(세션 키)에 `() => runtime.endListenFrame()` 를 등록, 종료 시 해제. `reserveOnBusySession` 이 held 적재 성공 직후 이 릴리즈를 호출(AC7).
  - 콜드 spawn 경로(채널 사망 후 send)와 새 세션 첫 턴 진입 시 `tracker.clear(sessionId)`(AC5).
  - listen 턴 종료 후 `!runtime.channelAlive && tracker.ids().size > 0` 이면 각 toolUseId 에 대해 `createSubagentSettlementEvents` 로 합성 정착(status `failed`, "채널 종료로 중단") 을 버스로 방출 후 clear(AC8).

**재사용**: `makeContinuationTurn`·`supervisor.startResume/release`·settle 계열·버스 팬아웃 — 신규 구조물은 추적기 1개와 listen 분기뿐.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **inflight 의미론**: 백그라운드 태스크만 돌고 CLI 가 유휴인 구간은 렌더러 inflight=false(턴 없음)가 **의도된 상태** — Task 행의 '실행 중'(AC2)이 레벨 인디케이터. 알림 턴이 시작되면 활동 이벤트로 inflight 자동 전이(자료조사 10행).
- 알림 턴의 트리거 user 메시지(태스크 알림)는 text-only user → `input.echo` 로 main 내부 소비(렌더 미표시) — pending 매칭 실패는 무해(기존 계약).
- listen 턴 중 사용자 **중단 버튼**: 기존 cancel 경로(`markAborted`→interrupt+draining)가 그대로 동작 — CLI 알림 턴이 진행 중이면 그 턴이 중단된다(일반 턴과 동일 의미).
- listen 턴 중 **owner(창) 소멸**: 기존 `onOwnerGone` 이 activeTurn 신호를 abort — 동일.
- 다중 백그라운드 태스크: settled 가 하나씩 도착해도 추적이 남아 있으면 루프가 listen 을 재개.
- 테마/접근성/i18n: 신규 UI 문자열 없음(합성 정착 메시지는 기존 한국어 관례 문자열 — `subagent-settlement` 동형).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| listen 턴이 세션을 "턴 진행 중" 으로 잡아 supervisor/동시성 회계에 노출 | activeTurns 증감 유지(정직한 busy 표시). held send 는 릴리즈 밸브로 즉시 진행 — 데드락 없음(AC7) |
| CLI 가 알림 턴을 열지 않는 엣지(억제된 알림 등)에서 listen 프레임이 장기 개방 | stall 미무장이라 오판 abort 는 없고, 사용자 send(밸브)·중단·owner 소멸로 회수. 잔여는 채널 수명에 귀속 |
| task_started/notification 에지 신호 유실 시 추적 고착 | 콜드 spawn 리셋(AC5) + 채널 사망 정리(AC8). 레벨 신호(`BackgroundTasksChanged`) 채택은 후속 검토(비범위) |
| 백로그와 라이브 스트림의 순서 역전 | 없음 — unframed→openFrame 합류가 기존 순서 보존 경로 그대로(자료조사 6행) |

- 되돌리기 어려운 결정: 없음 — listen 플래그·추적기는 additive, 제거 시 현행(적체) 동작으로 복귀.
- **단독 결정 금지 항목(Open Question)** → 사용자에게: 본 런타임이 안정화된 뒤 **서브에이전트 백그라운드를 Orca 제품 기본으로 전환할지**(0135 의 foreground 고정 해제 여부). 본 핸드오프는 기술적 수용까지만.

## 영향 받는 파일

- `app/src/main/adapters/claude-map.ts` (+ `claude-map.test.ts`)
- `app/src/main/adapters/turn.ts`
- `app/src/main/features/sessions/session-runtime.ts` (+ `session-runtime.test.ts`)
- `app/src/main/features/chat/turn-coordinator.ts` (+ `turn-coordinator.test.ts`)
- `app/src/main/features/chat/background-tasks.ts` (신규, + 테스트)
- `app/src/main/app/chat-turn.ts`
- `docs/arch/backend/provider-runtime.md`

## 참고 문서

- `docs/arch/backend/provider-runtime.md` §서브에이전트, `docs/arch/backend/adapters.md`
- `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` (SessionRuntime/프레임 설계 정본)
- CLI CHANGELOG §2.1.198/§2.1.205/§2.1.208 (백그라운드 계열 거동)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + 순수 vitest. IPC 채널 변경 0 (IPC_CONTRACT 무변).
- 신규 테스트 요구: AC9.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 요청 인용, "중기" 해석은 추론 표기.
- [x] 자료조사 — 전 발견 레퍼런스(SDK 실측 `파일:라인`·웹 URL·코드 라인).
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — SDK 필드/알림 턴 전제 명시, 신규 의존성 0.
- [x] 파생 UX — inflight 의미론·중단·owner 소멸·다중 태스크 열거.
- [x] 리스크 — 데드락/고착/순서 역전 검토, 제품 기본 전환은 Open Question 분리.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 직접).

## [구현자 기입] 설계 리뷰 (비판적)

- (구현 턴에서 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| — | | | |

## [구현자 기입] 구현 체크리스트

- [ ] AC1 claude-map `tool_use_result` 매핑 + 테스트
- [ ] AC3 session-runtime listen 프레임 + `endListenFrame` + 테스트
- [ ] AC5 BackgroundTaskTracker + 코디네이터 훅 + 테스트
- [ ] AC4/AC7/AC8 chat-turn 루프·릴리즈 밸브·사망 정리
- [ ] AC6 stall 미무장 + 테스트
- [ ] AC10 게이트 + provider-runtime.md 동기

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | |
| 실행 명령 | |
| 게이트 결과 | |
| 블로커 / 역질문 | |
| 대상 커밋 | |
