# Plan — 0165-cancel-residue-and-listen-hang (r5)

> **개정 이력**
> - **r1** — 증상 3개 ↔ 점 수정 3개. 리뷰 **Request changes (P1 3건)**.
> - **r2** — 구조(경계·세대·소유)로 전환. 리뷰가 메시지-원자 라우팅을 올바른 방향으로 인정,
>   **새 P1 3건**(그중 1건은 r2 가 만든 uuid 소유권의 ABA).
> - **r3** — `SubmissionIdentity`·큐 파생 잔여·멱등 스냅샷. 리뷰가 방향을 인정하되 **새 P1 3건**:
>   ⓐ 체인 중첩 자체는 여전히 허용 ⓑ channelId 결합 시점이 실제 호출 순서와 불일치 ⓒ `chat.listen`
>   이 additive 가 아니라 breaking.
> - **r4** — 소유권 경계를 turn 에서 체인(lease)으로, 채널 결합을 제출 트랜잭션으로, 스냅샷을
>   호환 확장으로. 리뷰가 방향을 인정하되 **새 P1 3건**: ⓐ lease 가 여전히 nullable `activeChild`
>   에 의존 ⓑ `all()` 이 child 없는 lease 를 숨겨 **재시작 게이트·shutdown** 이 깨진다 ⓒ **제출
>   트랜잭션이 실제 steer push(어댑터 훅)를 포괄하지 못한다**.
> - **r5 (본 문서)** — lease 를 **세션 제어의 단일 권위**로 완성하고(제어 상태·providerKey·
>   `allLeases()`), **모든 입력을 Runtime 의 제출 포트 하나로** 통과시킨다. 검증 과정에서 리뷰
>   지적 2건이 **현행 코드에 이미 존재하는 결함**임을 확인했다(작업 중 업데이트 설치 허용 ·
>   종료 시 active 서브프로세스 잔존) — r5 가 함께 닫는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0165-cancel-residue-and-listen-hang` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 (r1 → r5) |
| 매핑 | PHASES 행 (verify PASS 후 승격) |
| 상태 | r5 DRAFT → **READY** |
| 편성 | **1 핸드오프 · 2 스테이지** (A = 소유권·제어 권위·제출 포트·배치 라우팅 / B = 큐 진실·표시) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "첫 취소에서 어시스턴트의 **에러 메시지 버블 노출**. 이후 delta 도착 시작하자, 에러 메시지 버블 삭제후 delta 출력 시작" | 라이브 세션 + 첨부 `orcacancelresendanalysis.md` §1 |
| 명시 요구 ② | "마지막 어시스턴트 답변 이후 **inflight 애니메이션 지속** + **'중단했지만 대기 중인 메시지가 남아 있습니다'** 표기" | 동상 + 첨부 §2 |
| 명시 요구 ③ | "**구조적결함을 반드시 극복해야 한다. 단 사용자 경험을 해치면 안 된다.**" (반복 지시) | 라이브 세션 (r1·r3 리뷰 후 2회) |
| 명시 요구 ④ | "**이 작업의 목적은 핸드오프 문서 작성까지만이다.**" | 라이브 세션 |
| 사용자 결정 ⑤ | **0143(listen 대기 = inflight 지속) 유지 — 라벨만 추가.** foreground/transport UI 분리 미채택 | 라이브 세션 (r2 리뷰 후) |
| 사용자 결정 ⑥ | **0165 한 건 · 2 스테이지** | 동상 |
| 명시 요구 ⑦ | "**지금까지의 제안 및 피드백에 대해 비판적 검토를 하라**" — 리뷰 의견도 무비판 수용하지 말 것 | 라이브 세션 (r3 리뷰 후) |
| 외부 리뷰 1·2·3·4차 | 각 3건 (§외부 리뷰 처리) | PR 리뷰 |

## Context (왜)

실기 세션 `8f6ad70c` 의 취소→재전송 반복에서 세 증상이 났고, 로그에는 `error`/`warn` 이 0건이다 —
셋 다 예외가 아니라 **정상 경로의 오판**이라 관측 없이 UI 만 틀어진다.

세 번의 개정이 같은 자리를 맴돈 이유가 r4 에서 드러났다. r1~r3 은 **큐와 이벤트의 소유권**을
점점 정교하게 만들었지만, 그 바깥의 **세션 소유권**은 여전히 *개별 turn 의 수명*에 묶여 있었다.
그래서 안쪽을 아무리 조여도 "체인이 둘 열리는" 창이 남았다. r4 는 그 바깥을 닫는다.

## 요구 비판적 검토 (수석 엔지니어 관점) — 요구 ⑦ 포함

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **전제 5차 정정.** r3 까지는 "큐·이벤트의 소유권", r4 는 "체인 소유권" 까지 봤다. r5 에서 확인한 것은 한 겹 더 있다 — **세션 수명의 사실이 turn-local 에 산다.** 서브에이전트 제어 상태(`taskIds`·`subagentTypes`·`stoppedSubagents`)가 `freshTurnLocalState()` 에 들어 있어 **연속·listen 턴마다 리셋**되고, provider 경계 판정도 `turn.providerKey` 를 읽는다. 그래서 lease 를 만들어도 제어가 nullable child 에 남으면 결함이 그대로다 | `chat-turn.ts:96-112`(freshTurnLocalState) · `:298-311`(provider 경계) · `:1163-1164`(stopSubagent) |
| 이미 있는 것 아닌가 | **없다.** 세션 단위 admission 을 표현하는 타입이 없다 — registry 는 `Map<sessionId, TurnContext>` 로 *turn* 을 담는다. 그래서 "체인이 진행 중" 을 표현할 방법이 구조적으로 없었다 | `session-registry.ts:3-5` |
| 더 작은 해법이 있는가 | **네 번 시도했고 네 번 막혔다.** r1(점 수정) → r2(uuid 스코프) → r3(identity) → r4(체인 lease). 매번 한 겹 바깥/안쪽의 구멍이 남았다. r5 는 **권위를 세 개로 못박아** 더 이상 "어디에 있는지" 를 묻지 않게 한다 — 세션 제어=lease · 입력 제출=Runtime 포트 · UI=스냅샷 투영 | 리뷰 1~4차 |
| **인용 자료(리뷰)가 요구를 부풀리지 않았나** (요구 ⑦) | **3·4차 모두 검증했다.** 3차: 2건 확정 + 1건 **등급 하향**(버전 스큐 근거가 패키징 앱에 성립하지 않음 — 다른 이유로 수용). 4차: **3건 전부 확정**, 그중 2건은 **현행 코드에 이미 있는 결함**(§자료조사). 다만 4차 제안 중 **3건은 채택하지 않는다**(§외부 리뷰 처리 하단) — 근거 없이 상태·비용을 늘리기 때문 | §자료조사 · `chatReducer.ts:509-520` |
| 기존 채택 결정을 뒤집는가 | **문서화된 채택 결정은 0건 뒤집는다.** 0143 은 사용자 결정으로 유지, 0067 은 정밀화. 다만 **registry 의 "turn 단위 등록" 이라는 *구조*는 바꾼다**(채택 결정 문서 없음 — 구조 변경으로 표기) | §기존 결정 표 |

- **사용자에게 올릴 것**: 없음(결정 ⑤·⑥ 으로 해소).

## 자료조사 (Research)

> 인용 라인은 전부 이번 세션에서 직접 열어 확인했다. SDK 는 `npm ci` 로 설치한 `0.3.220` 실물.

### r5 에서 새로 확정한 사실 (리뷰 4차 검증 + 자체 발견) — **2건은 현행 결함**

| 발견 | 레퍼런스 |
|---|---|
| **mid-turn steer 는 어댑터가 직접 push 한다.** `makeSteerGateHook(req.takeSteerFlush, (batch) => input.push(batchContent(batch), batch.uuid), req.rollbackSteerFlush)` — 토큰을 모르는 어댑터가 stdin 에 밀어 넣는다. **r4 의 "Runtime 이 push 를 독점한다" 는 전제가 이 경로에서 성립하지 않는다**(그리고 이 경로가 잔여 ②-b 의 발원지다) | `claude.ts:393-397` · 훅 본체 `claude-adapt.ts:146-178` |
| **[현행 결함] 작업 중 업데이트 설치가 허용될 수 있다.** `restartGateState()` 는 `isGenerating: turns.length > 0` 을 **`all()` 로만** 계산하고, 게이트는 `!isGenerating` 이면 설치를 진행한다. 턴-후 루프가 등록을 교체·해제하는 창에서 `all()` 은 비어 있다 | `bootstrap.ts:490-494` · `shared/update-restart.ts:10` |
| **[현행 결함] 종료 시 active 서브프로세스가 잔존할 수 있다.** `shutdown` 은 `all()` 을 돌며 abort 하고 `closeIdleRuntimes()` 로 **idle 풀만** 닫는다 — 교체 창의 active runtime 은 둘 중 어디에도 없다 | `bootstrap.ts:553-560` · `runtime-pool.ts:64-68` |
| **[현행 열화] 서브에이전트 제어 상태가 턴마다 리셋된다.** `subagentTaskIds`·`subagentTypes`·`stoppedSubagents` 가 `freshTurnLocalState()` 에 있어 연속·listen 턴마다 비워진다 → turn N 에서 띄운 백그라운드 서브에이전트를 listen 턴 N+1 에서 중단하면 `taskId` 가 없어 `stopTask` 에 도달하지 못한다(교체 창 문제가 아니라 **상시**) | `chat-turn.ts:96-112` · `:1163-1170` |
| **provider 경계 판정이 nullable child 를 읽는다.** `reserveOnBusySession` 은 canSteer 직후 `crossesProviderBoundary(turn.providerKey, …)` 를 읽는다 — canSteer 만 lease 로 옮기면 이 줄이 남는다 | `chat-turn.ts:298-311` |

### r4 에서 확정한 사실 (유지)

| 발견 | 레퍼런스 |
|---|---|
| **같은 세션에 SDK 런타임이 2개 생긴다.** `RuntimePool` 은 **idle 핸들만** 보관한다. 체인 A가 도는 동안 runtime 은 체크아웃 상태(풀 밖)라 `pool.take(sessionId)` 가 `undefined` 를 반환하고 `acquireRuntime` 이 **곧장 `factory()`** 로 간다 → 두 번째 `SessionRuntime` = 두 번째 서브프로세스 | `runtime-pool.ts:15`, `:21-28` · `supervisor.ts:114-119` |
| **그 창은 microtask 가 아니라 I/O 대기다.** listen child `release` 뒤 `stopAndSettleAbortedTasks` → 루프 top `settleDeadBackgroundTasks` → `await prepareContinuation()`(provider 해석·extensions 빌드)까지 **여러 await** 가 등록 없이 지나간다 | `chat-turn.ts` 턴-후 루프 listen 분기 |
| **부수 피해 ①: 먼저 반납된 런타임이 조용히 close 된다.** 두 체인이 각자 `releaseRuntime` 하면 `keepIdle` 이 같은 키의 이전 핸들을 `closeEntry` 한다 → 진행 중 스트림·백그라운드 태스크 소멸 | `runtime-pool.ts:32-37` |
| **부수 피해 ②: "세션 전체 중단" 이 지금도 신뢰할 수 없다.** `discardRuntime` 은 **idle 풀만** 닫는다. 주석이 "진행 중 턴의 런타임은 풀 밖이라 여기서 잡히지 않는다" 고 자인한다 → 잔여 Notice 의 **유일한 조치**가 CLI 큐를 못 없앨 수 있다(보고 ②-b 의 처방이 성립하지 않는다) | `supervisor.ts:141-149` |
| **부수 피해 ③: 신규 세션 경로에도 같은 창.** `hasPending(owner)` 로 admission 하고 `promote` 로 `bySession` 에 옮긴다 | `session-registry.ts:17-19`, `:29-33` |
| **예약 시점에는 최종 채널을 알 수 없다.** 큐 예약·`promptUuid` 결정은 `handleChatSend` 에서, **채널 결정은 `runAttempt` 안**에서(`draining` 이면 teardown 후 재spawn) 일어난다 | `session-runtime.ts:230-283` |
| **UX 함정: lease 도입 시 `canSteer` 판정이 사용자에게 에러를 띄운다.** `reserveOnBusySession` 은 `getBySession(...)?.live?.canSteer` 로 판정해, `activeChild` 가 없는 순간이면 "이 백엔드는 피드백 끼어들기를 지원하지 않습니다" 를 보낸다. **`SessionRuntime.canSteer` 게터가 이미 있으므로** lease 의 runtime 기준으로 봐야 한다 | `chat-turn.ts:285-296` · `session-runtime.ts:189-191` |
| **리듀서는 `phase!=='started'` 를 전부 종료로 처리한다** → 필드 하나가 빠지면 `listening` 이 꺼지고 send 가 steer 가 아닌 새 턴이 된다(0153 이 고친 위험) | `chatReducer.ts:509-520` |
| registry 소비처 **전수 9곳** — shutdown 2(`bootstrap.ts:490,553`) · chat-turn 6(`:285`,`:394`,`:399`,`:443`,`:493`,`:1114/1142/1163`) · approvals 1(`coordinator.ts:91`) | `rg 'getBySession\|hasSession(\|hasPending(\|\.all()' src/main` |
| `isSessionLive`(`:493`)는 recovery 가 **살아 있는 세션의 dangling 복구를 건너뛰는** 데 쓴다 — lease 로 참이 길어지면 *더 보수적*이 된다(안전 방향) | `features/chat/recovery.ts:11`, `:31`, `:85-86` |

### r2/r3 에서 확정한 사실 (유지)

| 발견 | 레퍼런스 |
|---|---|
| 한 SDK 메시지가 N개 이벤트로 분해된다 | `claude-map.ts:1-8` |
| **실패·취소 result 는 terminal 을 2개 낸다** — `[telemetry, error]`. `SDKResultError.subtype` **4멤버** 전부 같은 분기 | `claude-map.ts:474-486` · `sdk.d.ts:4269-4271` |
| `error_during_execution` = "API 실패 **또는 취소된 요청**" | `docs/spec/claude/agent-sdk/agent-loop.md:274` |
| `terminal_reason`(19멤버)은 optional → 취소 판별에 쓰지 않는다 | `sdk.d.ts:4282`, `:6909` |
| `routeEvent` 가 **첫 terminal 에서 프레임을 닫아** 두 번째가 `unframed` 로 샌다 | `session-runtime.ts:354-380` |
| `openFrame()` 이 `unframed` 를 새 프레임 **앞에 합류**시킨다(소속 라벨 없음) | `session-runtime.ts:328-335` |
| `teardownChannel()` 이 `unframed` 를 비운다 → "첫 취소에서만" 인 이유 | `session-runtime.ts:446` |
| renderer 는 `error` 로 배너를 띄우고 `BEGIN_TURN` 에서 지운다 + **DB 에도 error 파트로 영속** | `chatReducer.ts:546-556`, `:297-309` · `writer.ts:276-285` |
| `orphanUnconfirmed` 호출점 **전수 2곳**, 둘 다 턴-후 루프 안(조건 `!aborted`) | `chat-turn.ts:939`, `:951` |
| `BackgroundTaskTracker` 는 재조정 지점이 없다 | `background-tasks.ts:41-46`, `:72-79` |
| **SDK 에 태스크 열거 API 가 없다** | `sdk.d.ts:2562`, `:2575` |
| listen 턴은 **stall 미무장** | `turn-coordinator.ts:241-243` |
| 중단 영수증 실측 지연 **6.06초**, 그 사이 respawn | 첨부 §2-2/§3 |
| `takeForRespawn` 은 미확정 배치를 **uuid 보존 재주입** | `pending-message-queue.ts:333-354` |
| `discardSubmitted` 는 `submitted` 만 매칭 | `pending-message-queue.ts:309-312` |
| 배치가 큐를 떠나는 실제 지점은 `commitConsumed → drainConfirmed` | `turn-coordinator.ts:167-187` |
| `beginListenPhase` 는 started 를 **1회만** 발행 | `chat-turn.ts:869-878` |
| renderer busy 는 **단일 정의** `sessionBusy = inflight \|\| listening` | `chatStore.ts:1286-1292` |
| pending id 정합의 주체는 `ids`(messageId) | `chat-turn.ts:1096`, `:1120` · `turn-coordinator.ts:176-186` |
| `live.events` 소비처 **3곳**, 생산자 **2곳** | `session-runtime.ts:174,290,342` |
| 게이트 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed (196 files)** + node:test **28 pass** | 이번 세션 실행 |

## 구조적 결함 (Root Structure)

> **소속 없는 신호, 재조정 없는 누적기, 복제된 상태, 그리고 — 가장 바깥에 — 안쪽 수명에 묶인 소유권.**

| # | 발현 | 보고 증상 | 처방 |
|---|---|---|---|
| **F-A** | 프레임 경계 ≠ provider 메시지 경계 → 메시지 꼬리가 다음 턴에 재귀속 | ① (+ 실제 API 실패도) | A3 |
| **F-B** | 턴-후 판정 입력이 재조정 없는 누적기 → 유령 근거로 listen 이 열린다 | ②-a | A4 · B2 |
| **F-C** | 비동기 신호·예약에 소속(세대·체인·시도) 표현이 없다 | ②-b | A2 · A4 |
| **F-D** | 파생 가능한 사실을 별도 Map 으로 복제하고 갱신 시점을 놓친다 | ②-b 고착 | B1 |
| **F-E** | **세션 소유권이 개별 turn 수명에 묶여 있다** — child 교체 창에서 두 번째 체인·두 번째 서브프로세스가 열리고, "세션 전체 중단" 은 active 런타임에 닿지 못한다 | ①②의 상위 원인 후보 + 미보고 데이터 위험 | **A1** |
| **F-F** | **세션 수명의 사실이 turn-local 에 산다** — 서브에이전트 제어 상태가 턴마다 리셋되고, provider 경계·재시작 게이트·shutdown 이 전부 *현재 turn* 을 근거로 판정한다. 그래서 turn 이 없는 구간이 곧 **제어 공백**이 된다(작업 중 업데이트 설치·종료 시 서브프로세스 잔존·중단 무반응) | 미보고 결함 3종 | **A1** |
| **F-G** | **입력 제출 경로가 둘이다** — 턴 프롬프트는 Runtime 이, mid-turn steer 는 **어댑터 훅이** push 한다. 권위가 갈려 "어느 채널에 실렸는가" 를 한 곳에서 기록할 수 없다 | ②-b | **A2** |

## 외부 리뷰 처리

| 라운드 | 지적 | 판정 | 처리 |
|---|---|---|---|
| 1차 | teardown 잔여 은폐 / 라우팅 타이머 오귀속 / 세션 단위 강등 | 전부 타당 | 큐 파생(B1) · 타이머 0(원칙 ②) · 스코프→identity(A4) |
| 2차 | uuid 소유권 ABA / 잔여 파생 시점 / listen 1회성 | 전부 타당(1건은 r2 자책) | A4 · B1 · B2 |
| **3차 ⓐ** | **체인 중첩을 허용한 채 오염만 차단한다** | **확정 — 리뷰보다 심각**(부수 피해 3건 추가) | **A1 SessionChainLease** |
| **3차 ⓑ** | **channelId 발급·결합 시점이 호출 순서와 불일치** | **확정** | **A2 제출 트랜잭션 + ChannelToken** |
| **3차 ⓒ** | `chat.listen` 이 breaking | **타당하나 등급 하향(P1→P3)** — 근거인 버전 스큐는 패키징 앱에 없다. 다만 리듀서 강건성 때문에 수용 | **B2 `phase` 유지 + `revision`** |
| **4차 ⓐ** | lease 가 여전히 **nullable `activeChild`** 에 의존(provider 경계·서브에이전트 중단) | **확정** (+ 제어 상태가 **상시** 리셋되는 것까지 자체 발견) | **A1 — lease 를 세션 제어의 단일 권위로** |
| **4차 ⓑ** | `all()` 이 child 없는 lease 를 숨겨 **재시작 게이트·shutdown** 이 깨진다 | **확정 — 현행에서도 이미 뚫려 있다** | **A1 `allLeases()`** |
| **4차 ⓒ** | 제출 트랜잭션이 **실제 steer push 를 포괄하지 못한다** | **확정 — r4 의 전제가 틀렸다** | **A2 제출 포트 단일화** |

### 4차 제안 중 **채택하지 않는 3건** (요구 ⑦ — 리뷰도 무비판 수용하지 않는다)

| 제안 | 판단 | 근거 |
|---|---|---|
| "CAS 실패 시 **해당 채널을 폐기**해 실행 가능성을 제거" | **미채택** | 제안한 순서가 `CAS(submitting) → push` 다. CAS 가 실패하면 **아직 push 하지 않았다** — 되돌릴 것이 없다. 채널 폐기는 백그라운드 태스크까지 죽이는 최대 비용 행위라(0151 이 사용자 결정으로만 남긴 이유) 아무것도 새지 않은 상황에 쓰면 순손실이다 |
| "큐 결합 전 도착한 provider 이벤트를 **버퍼링했다가 결합 후 공개**" | **미채택** | 토큰은 **push 전에** 발급되므로 그 사이 도착한 이벤트도 이미 올바른 토큰으로 라우팅된다. `Frame` 이 이미 큐로 버퍼링하고 coordinator 는 비동기 소비다 — 새 공개 게이트는 이득 없이 상태만 하나 더 만든다(원칙 ③ 위반) |
| `providerBinding.model`·`settingsRevision` 을 lease 에 복제 | **부분 미채택** | 모델·settings 신선도는 **runtime 이 이미 권위**로 들고 `decideRespawn` 이 그걸로 판정한다(`spawnedModel`·`spawnedProviderSettings`·`spawnedRuntimeToolsRevision`). lease 에 복제하면 같은 사실의 두 번째 사본이 된다 — lease 는 **`providerKey` 만** 든다 |

## 설계

### 원칙

> ① **소속을 붙인다** — 경계(메시지)·세대(채널 토큰)·소유(체인·시도).
> ② **시간은 정보를 잃지 않는 층에서만 쓴다** — 라우팅(프레임·드레인·큐)에 타이머 0.
> ③ **상태는 사실에서 파생하고, 사실이 바뀌는 순간 발행한다.**
> ④ **소유권은 가장 바깥 수명에서 잡는다** — 안쪽(child turn)의 교체가 바깥(체인·세션)의 소유를
> 흔들지 않는다. *(r4 — F-E)*
> ⑤ **세션 수명의 사실은 세션 수명 객체가 든다** — turn-local 에 두면 턴 교체마다 사라지고,
> turn 이 없는 구간이 곧 제어 공백이 된다. *(r5 — F-F)*
> ⑥ **권위는 하나다** — 같은 행위(입력 제출)에 경로가 둘이면 어느 쪽도 사실을 기록할 수 없다. *(r5 — F-G)*

---

### 스테이지 A — 소유권 경계 · 제출 트랜잭션 · 배치 라우팅

#### A1. SessionChainLease = **세션 제어의 단일 권위** (F-E·F-F)

```ts
interface SessionChainLease<W> {
  leaseId: string
  chainId: string
  sessionId: string | null           // 신규 세션은 null → promote 시 확정
  runtime: ManagedRuntime
  providerKey: string                // 체인/채널의 provider. **모델·settings 신선도는 runtime 권위**
  control: {                         // 세션 수명 제어 상태 — 턴 교체에도 살아남는다 (원칙 ⑤)
    taskIds: Map<string, string>     // toolUseId → taskId
    subagentTypes: Map<string, string>
    stoppedSubagents: Set<string>
    blockedSubagents: Set<string>
    cancelled: boolean
  }
  activeChild: TurnContext<W> | null // **세션 상태·제어의 근거로 쓰지 않는다**
}
```

- **획득/해제**: `handleChatSend` 진입에서 획득, **outer `finally` 단일 지점**에서
  `releaseLease(sessionId, leaseId)` — **leaseId 조건부(CAS)** 라 지각한 이전 체인이 새 lease 를
  지우지 못한다.
- **child 교체는 `swapChild(prev, next)` 원자 연산** — `unbind → await → bind` 로 null 창을
  만들지 않는다(리뷰 4차 수용).
- **소비처 매핑(전수 9곳)** — 3개 술어 계약을 유지하되 근거를 lease 로 옮긴다:
  - `hasSession(sessionId)` → **lease 존재**(admission·handoff 가드·`isSessionLive`)
  - `getBySession(sessionId)` → `activeChild`(approvals 등 *턴* 이 필요한 소비자)
  - **`allLeases()` 신설** → 재시작 게이트·shutdown 이 쓴다(아래)
- **제어는 lease API 로만** (P1-1):
  - 전송 admission — `lease.runtime.canSteer` + **`lease.providerKey`** 로 판정한다.
    nullable child 를 읽지 않는다(현행 `turn.providerKey` 참조 제거).
  - 턴 중단 — `control.cancelled = true` + `activeChild` abort. **child 사이에 눌러도** 루프가
    다음 반복에서 종료한다.
  - 서브에이전트 중단 — `control.taskIds`/`subagentTypes`/`stoppedSubagents` 를 lease 에서 읽는다.
    **연속·listen 턴에서도 `stopTask` 에 도달**한다(현행 상시 열화 해소).
  - "세션 전체 중단" — `discardRuntime` 이 **lease 의 runtime** 을 직접 잡는다.
- **`allLeases()` 가 닫는 현행 결함 2건**:
  - 재시작 게이트 — `isGenerating` 을 **lease 수**로 판정한다(현행: `all()` 이 비는 창에 **작업 중
    업데이트가 설치**된다). `activeToolCallCount` 는 `activeChild?.openToolRuns.size ?? 0` 합.
  - shutdown — **모든 lease 의 runtime 을 직접 close** 한다(현행: idle 풀만 닫아 active
    서브프로세스가 잔존).
- **신규 세션**: owner 키 lease 로 시작해 `promote` 에서 sessionId 키로 승격.

#### A2. 제출 포트 단일화 — **모든 입력이 Runtime 을 통과한다** (F-C·F-G, 리뷰 4차 ⓒ)

**현행은 경로가 둘이다** — 턴 프롬프트는 Runtime 이, mid-turn steer 는 **어댑터 훅이** push 한다
(`claude.ts:393-397`). 토큰을 모르는 어댑터가 push 하는 한 "어느 채널에 실렸는가" 를 기록할 수 없다.

- **어댑터에 push 클로저를 주지 않는다.** Runtime 이 구현한 **`submitSteer(batch)` 포트**만
  `TurnRequest` 로 넘기고, 게이트 훅은 **제출 요청만** 한다(훅의 fail-open·rollback 의미는 유지 —
  `claude-adapt.ts:146-178` 구조 보존).
- **네 경로 전부** 이 포트를 지난다: ⓐ 최초 전송 ⓑ 자동 연속 턴 ⓒ respawn 프렐류드
  ⓓ PostToolBatch steer.
- **트랜잭션 순서**: draining 확인/필요 시 respawn → **재사용 불가 `ChannelToken` 발급** →
  큐를 **CAS 로 `submitting(token)`** 전이 → **Runtime 이 push** → 성공 `submitted(token)` /
  실패 `held` 롤백.
  - **CAS 실패 = 이미 취소·폐기된 시도** → **push 하지 않는다.** 아직 아무것도 나가지 않았으므로
    **채널을 폐기하지 않는다**(§외부 리뷰 처리의 미채택 근거).
- 큐 상태: `held → submitting → submitted → confirmed`
  (`submitting|submitted|orphaned → discarded`). 기존 `rollbackSteerFlush` 가 롤백의 절반을 이미 갖는다.
- **어댑터는 토큰을 만들지 않는다** — `ProviderMessageBatch { sequence, events }` 만 생산하고,
  **Runtime 이 pump 시작 시 캡처한 토큰을 부착**한다(권위 1곳).
- **respawn**: `messageId`·`survivedInterrupt` 보존, `attemptId`·토큰 **재발급**. 이전 채널의
  배치·echo·interrupt 영수증은 **토큰 불일치로 폐기**된다.

#### A3. 메시지-원자 배치 라우팅 (F-A, r2/r3 계승)

**불변식: 한 provider 메시지의 이벤트는 전부 같은 목적지로 간다(프레임 / 드랍 / unframed).**

- `LiveTurn.eventBatches: AsyncIterable<ProviderMessageBatch>` — **선택적 우회로가 아니라 계약**.
  다중 이벤트를 내는 어댑터는 반드시 한 배치로, 단일 이벤트만 내는 어댑터(mock)도 1-이벤트 배치로.
- `routeBatch`: 토큰이 현재 세대와 다르면 통째로 폐기, 같으면 전 이벤트를 한 목적지로 보낸 **뒤**
  terminal 전이(프레임 닫기·draining 종료·`cliBusy` 해제)를 적용한다.
- 효과: ① 소멸 + **실제 실패 result 의 일반 누출 동시 소멸**. r1 의 `interruptedPendingResult`
  가변 플래그 불필요.

#### A4. SubmissionIdentity (F-B·F-C, r3 계승 — channelId 는 A2 로 이관)

```ts
interface PreparedAttempt { messageId: string; attemptId: string; chainId: string }
interface BoundAttempt extends PreparedAttempt { channelToken: string }   // push 성공 후
```

- **강등 조건**: `(attemptId, chainId)` 일치 시에만 `submitted → orphaned`. 지각한 이전 체인의
  `finally` 는 아무것도 건드리지 못한다(ABA 차단).
- 0067 정밀화: renderer pending id 정합은 **`ids`(messageId)가 담당**하므로 wire uuid(attemptId)
  재발급이 UI 정합을 깨지 않는다.
- **백그라운드 트래커**: 엔트리를 **channelToken** 으로 스코프 → forced teardown 경로가 `clear`
  를 호출하지 않아 생기던 잔류가 호출부 기억 없이 사라진다. 토큰은 **주입**받는다(레이어 경계).

---

### 스테이지 B — 큐 진실 · 표시 (0143 **유지** · 결정 ⑤)

#### B1. 잔여를 큐의 즉시 파생값으로 (F-D)

- `residualBySession` Map **폐기**. `TrackedBatch.survivedInterrupt: boolean` 만 둔다.
- 파생: `residualCount = open(batches).filter(b => b.survivedInterrupt).length`
  (open = `submitting | submitted | orphaned`). 순수 함수.
- **큐의 모든 전이가 단일 mutation 경계를 지나고 전이 직후 변경을 알린다.** 구독은 **turn 이
  아니라 라우터(애플리케이션) 수명으로 1회 등록**한다(리뷰 3차 수용) → 체인 종료 후 늦게 도착한
  영수증·커밋도 즉시 반영된다. 큐는 IPC 를 모르므로 **컴포지션 루트가 구독해 발행**한다.
- `discardSubmitted` 를 **open 매칭**(submitting·submitted·orphaned)으로 확장 — 강등이 늘어난
  대가를 상쇄한다(빼면 잔여 Notice 의 유일한 조치가 무력화).

#### B2. 호환 스냅샷 (리뷰 3차 ⓒ · 0143 유지)

```ts
{ type: 'chat.listen'; sessionId: string
  phase: 'started' | 'ended'        // 기존 계약 유지 — transport 에서 파생
  revision: number
  transport: 'idle' | 'listening'
  heldCount; submittingCount; submittedCount; residualCount; backgroundTaskCount: number
  lastActivityAt: number }
```

- **값이 바뀔 때마다 전체 스냅샷 발행**(엣지 1회 아님), 동일 값은 발행하지 않는다.
  리듀서는 **낮은 `revision` 을 무시**한다.
- **단일 `reason` 대신 사실 전체를 보낸다** — 대기 이유는 동시에 여러 개일 수 있다(리뷰 3차 수용).
- **0143 유지**: `sessionBusy = inflight || transport === 'listening'` — 정의를 바꾸지 않는다.
  **애니메이션을 끄지 않는다.**
- 라벨만 사실에 맞게: 백그라운드 N건 대기 / 전달 확인 대기 / 잔여 Notice(기존) / 근거가 모두
  사라지면 `phase:'ended'` 로 즉시 종료. 장시간 무이벤트는 **표시만** "종료 확인 대기" —
  **프레임은 닫지 않는다**(원칙 ②).

| 신규 모듈 / 확장 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `SessionChainLease` + registry lease 계층 | 세션 소유권 | features/sessions | 순수 단위 — `session-registry.test.ts`·`supervisor.test.ts` |
| `SessionRuntime.submit()` · `ChannelToken` | 제출 트랜잭션·세대 발급 | features/sessions | 순수 단위 — 기존 fake live 채널 harness |
| `ProviderMessageBatch` + `eventBatches` | 메시지-원자 계약 | adapters | 어댑터 단위(claude·mock) + 라우팅 단위 |
| `PreparedAttempt/BoundAttempt` · `submitting` · `survivedInterrupt` · 파생 selector · 변경 알림 | 예약 수명·잔여 진실 | features/chat | 순수 단위 — `pending-message-queue.test.ts` |
| lease 배선 · `canSteer` 교정 · 큐 구독(라우터 수명) · 스냅샷 발행 | 배선 | app | **기존 harness seam** — 신규 `chat-turn.cancel-residue.test.ts` |
| 스냅샷 수용 · StatusLine 라벨 | 표시 | renderer | `chatReducer.listen.test.ts` + 시각 확인 |

## 인수 기준 (Acceptance Criteria)

### 스테이지 A — 소유권·제출·라우팅

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| A1 | listen child 교체 중 전송해도 **두 번째 체인·두 번째 runtime 이 생기지 않고** 기존 체인의 held 큐로 들어간다(`message.queued` 수신) | `chat-turn.cancel-residue.test.ts::"child 교체 창의 send 는 기존 체인에 예약된다"` + `supervisor.test.ts::"child unbind 는 lease 를 해제하지 않는다"` | `chat:send` → `supervisor.hasSession` → `reserveOnBusySession` |
| A2 | 교체 창의 send 가 **"끼어들기 미지원" 에러 대신 `message.queued` 를 받는다** (UX 보호) | `chat-turn.cancel-residue.test.ts::"activeChild 부재 창에서도 steer 예약이 성립한다"` | 동 A1 → `lease.runtime.canSteer` |
| A3 | lease 해제는 **leaseId 일치 시에만** 일어난다 — 지각한 이전 체인의 `finally` 가 새 lease 를 지우지 않는다 | `supervisor.test.ts::"leaseId 불일치 해제는 무시된다"` | outer `finally` |
| A4 | **child 사이에 누른 Stop 이 체인을 종료**시킨다 | `chat-turn.cancel-residue.test.ts::"activeChild 부재 시 Stop 이 체인을 멈춘다"` | `chat:cancel` → `lease.cancelled` |
| A5 | **"세션 전체 중단" 이 active runtime 을 종료**한다(현행 idle-only 결함 해소) | `supervisor.test.ts::"discardRuntime 은 lease 의 active runtime 을 닫는다"` | 잔여 Notice → `chat:discardSession` |
| A6 | `getBySession`·`all()` 이 **`activeChild` 를 돌려줘** 승인·중단·shutdown 경로가 현행과 동일하게 동작한다 | `supervisor.test.ts::"activeChild 가 registry 계약을 만족한다"` | approvals `coordinator.ts:91` · `bootstrap.ts:490,553` |
| A7 | 신규 세션(sessionId 미확정)도 lease 로 보호되며 `promote` 에서 sessionId 키로 승격된다 | `supervisor.test.ts::"owner lease 가 promote 로 승격된다"` | 새 채팅 첫 전송 |
| A8 | **reserve 이후 draining respawn 이 일어나도 attempt 는 실제 새 채널 토큰에만 결합**된다 | `session-runtime.test.ts::"submit 은 실제 push 된 채널 토큰으로 바인딩한다"` | `coordinator.run` → `runtime.submit()` |
| A9 | **push 실패 시 attempt 가 `held` 로 롤백**되고 `submitted` 로 기록되지 않는다 | `pending-message-queue.test.ts::"submitting 은 실패 시 held 로 되돌아간다"` | 동 A8 |
| A10 | 실패 result 가 만든 `[telemetry, error]` **두 이벤트가 같은 프레임으로 배달**된다 | `session-runtime.test.ts::"실패 result 배치는 같은 프레임으로 전부 배달된다"` | CLI result → `eventBatches` → `routeBatch` |
| A11 | 취소 draining 중 도착한 result 배치는 **전부 드랍되고 `hasUnframedBacklog` 가 false 로 남는다** | `session-runtime.test.ts::"취소 draining 중 배치는 통째로 드랍된다"` | `chat:cancel` → `markAborted` |
| A12 | **이전 토큰의 배치는 통째로 폐기**된다 | `session-runtime.test.ts::"토큰 불일치 배치는 라우팅되지 않는다"` | respawn 직후 구 채널 잔여 |
| A13 | claude 어댑터가 **한 SDK 메시지 = 한 배치**로 낸다 | `adapters/claude.eventbatches.test.ts::"한 SDK 메시지 = 한 배치"` | `ClaudeAdapter.sendMessage` |
| A14 | **mock 어댑터도 배치 계약을 지킨다**(단일 이벤트 = 1-이벤트 배치) — 우회로 0 | `adapters/mock.test.ts::"mock 도 배치로 낸다"` | dev mock 백엔드 |
| A15 | 취소로 끝난 턴 체인이 **자기 체인·자기 시도**의 예약을 `orphaned` 로 강등한다 | `chat-turn.cancel-residue.test.ts::"취소로 끝난 체인이 자기 시도를 강등한다"` | outer `finally` |
| A16 | **같은 messageId 가 새 시도로 재귀속된 뒤** 이전 체인의 `finally` 가 실행돼도 **새 시도는 `submitted` 로 남는다**(ABA) | `pending-message-queue.test.ts::"attemptId 불일치 강등은 새 시도를 건드리지 않는다"` | A1 창 + `takeForRespawn` |
| A17 | `orphaned` 배치가 **지각 echo 로 `confirmed` 된다** | `pending-message-queue.test.ts::"orphaned 배치도 지각 echo 로 확정된다"` | 늦은 CLI 픽업 |
| A18 | **이전 attempt 의 지각 echo·영수증은 현재 시도의 상태를 바꾸지 않는다** | `pending-message-queue.test.ts::"이전 attempt 의 지각 신호는 무시된다"` · `session-runtime.test.ts::"토큰 불일치 영수증은 폐기된다"` | respawn 후 구 채널 신호 |
| A19 | 채널 교체 후 **이전 토큰의 태스크 추적은 `hasAny` 가 false**, **같은 토큰에서는 유지**된다 | `background-tasks.test.ts::"토큰이 바뀌면 조회되지 않는다"` · `::"같은 토큰 엔트리는 유지된다"` | 설정·모델 변경 respawn |
| A20 | 교체 창의 send 가 **provider 경계 검사를 받는다** — 같은 provider 면 `message.queued`, 다른 provider 면 정상 안내 메시지. 판정은 `lease.providerKey` 로 한다 | `chat-turn.cancel-residue.test.ts::"activeChild 부재 창에서도 provider 경계 검사가 동작한다"` | `chat:send` → `reserveOnBusySession` → lease |
| A21 | **listen 턴 진행 중 누른 서브에이전트 중단이 `stopTask` 까지 도달**한다(lease `control.taskIds`) | `chat-turn.cancel-residue.test.ts::"listen 중 서브에이전트 중단이 taskId 로 도달한다"` | `chat:stopSubagent` → lease control |
| A22 | child 가 없는 구간에도 `restartGateState().isGenerating === true` 라 **작업 중 업데이트 설치가 차단**된다 | `bootstrap.restart-gate.test.ts::"child 없는 lease 도 isGenerating 이다"` | `update:*` → `restartGateState` → `shared/update-restart.ts` |
| A23 | shutdown 이 **모든 lease 의 runtime 을 close** 한다(종료 후 active 서브프로세스 잔존 0) | `bootstrap.shutdown.test.ts::"active lease 의 runtime 도 닫힌다"` | 앱 종료 → `Bootstrap.shutdown` |
| A24 | **PostToolBatch steer 배치도 Runtime 포트를 지나** 토큰에 결합된다 — 어댑터가 직접 push 하지 않는다 | `adapters/claude.steer-port.test.ts::"게이트 훅은 submitSteer 포트를 부른다"` + `session-runtime.test.ts::"submitSteer 가 토큰 결합까지 수행한다"` | CLI PostToolBatch 훅 → `submitSteer` |
| A25 | `submitting` **CAS 실패 시 push 하지 않고**, 채널도 폐기하지 않는다 | `session-runtime.test.ts::"CAS 실패는 push 없이 종료한다"` | 취소·폐기와 제출의 경합 |
| A26 | `swapChild` 전후로 **`hasSession` 이 계속 true** 다(원자 교체) | `supervisor.test.ts::"swapChild 는 hasSession 을 흔들지 않는다"` | 턴-후 루프의 child 교체 |

### 스테이지 B — 큐 진실·표시

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| B1 | 잔여 배치가 커밋되는 **그 순간**(백그라운드 listen 중, **체인 종료 전**) `residualCount` 가 0으로 발행된다 | `pending-message-queue.test.ts::"drain 직후 파생 잔여가 0이 된다"` + `chat-turn.cancel-residue.test.ts::"listen 중 커밋이 잔여 경고를 즉시 해제한다"` | `commitConsumed` → `drainConfirmed` → 큐 변경 알림 |
| B2 | 큐 변경 구독이 **라우터 수명으로 1회** 등록돼 체인 종료 후 도착한 변경도 발행된다 | `chat-turn.cancel-residue.test.ts::"체인 종료 후 큐 변경도 발행된다"` | `registerChatHandlers` 1회 |
| B3 | **respawn 재주입 후에도 `residualCount` 가 유지**된다(`survivedInterrupt` 보존) | `pending-message-queue.test.ts::"takeForRespawn 은 survivedInterrupt 를 보존한다"` | respawn |
| B4 | `residualCount` 파생이 **open(submitting+submitted+orphaned) 중 `survivedInterrupt` 만** 센다 | `pending-message-queue.test.ts::"잔여 파생은 open·survivedInterrupt 교집합이다"` | B1 |
| B5 | "세션 전체 중단" 이 **`orphaned`·`submitting` 배치도 폐기**해 텍스트를 draft 로 되돌린다 | `pending-message-queue.test.ts::"discardSubmitted 는 open 상태를 폐기한다"` | 잔여 Notice |
| B6 | 스냅샷에 **`phase` 가 계속 실려** 기존 리듀서 경로가 동일하게 동작한다 | `chatReducer.listen.test.ts::"phase 파생값이 기존 전이를 유지한다"` | main → renderer |
| B7 | **낮은 `revision` 스냅샷은 무시**된다 | `chatReducer.listen.test.ts::"낮은 revision 스냅샷은 무시된다"` | 동 B6 |
| B8 | 대기 **이유·개수가 바뀌면 스냅샷이 재발행**되고, **같은 값이면 재발행하지 않는다** | `chat-turn.cancel-residue.test.ts::"스냅샷은 값이 바뀔 때만 재발행된다"` | 턴-후 루프 |
| B9 | `sessionBusy` 정의가 **`inflight \|\| listening` 그대로**여서 중단 버튼·steer 라우팅·concurrency 차감이 현행과 동일하다(0143·0153·0136 보존) | `chatStore.test.ts::"busy 정의는 스냅샷 도입 후에도 동일하다"` | Composer · `shouldQueueAsPending` |
| B10 | 백그라운드 대기 중 StatusLine 이 **개수와 함께 대기 라벨을 표시하고 애니메이션은 유지**된다 | `chatReducer.listen.test.ts::"스냅샷이 상태에 반영된다"` + 사람 실기 | `PendingAssistant.tsx:42` |
| B11 | **미정착 태스크 0 + 열린 예약 0** 이면 `transport:'idle'`(`phase:'ended'`)이 발행돼 애니메이션이 멈춘다 (**②-a 최종 상태**) | `chat-turn.cancel-residue.test.ts::"유령 근거가 없으면 종료 신호를 낸다"` + 사람 실기 | 턴-후 루프 `break` |
| B12 | `docs/IPC_CONTRACT.md` 의 `chat.listen` 행이 **스냅샷 필드를 반영**한다 | 문서 육안 대조(verify 체크) | 문서 SSOT |

### 사람 실기 재현 절차 (AC-H)

`cd app && npm run dev` 후 — **네 최종 상태를 모두 확인**한다:

1. 전송 → 응답 중 **중단** → 재전송 → transcript 에 **에러 배너 없음**(①).
2. 답변 완료 후(백그라운드 작업 없음) → **애니메이션 정지**(②-a).
3. 잔여 경고가 떴다면 → 그 메시지가 커밋되는 순간 **경고 즉시 해제**(②-b).
4. 앱 재시작 후 같은 대화 → 답변 위에 **error 카드 없음**(① 영속 경로).

**추가 실기(A1 검증 보조)**: 백그라운드 서브에이전트가 도는 세션에서 연속 전송을 반복해
**`ps` 상 CLI 서브프로세스가 세션당 1개**로 유지되는지 확인한다.

## UX 보존 체크리스트 (요구 ③의 판정 기준)

| 항목 | r4 에서 | 근거 |
|---|---|---|
| 교체 창의 send | **pending 버블로 즉시 표시 후 기존 체인으로 전달**(에러·새 턴 아님) + **provider 안내 정상 동작** | A1 + `canSteer`·`providerKey` 교정 (AC-A1·A2·A20) |
| 애니메이션 정책 | **0143 유지** — 끄지 않는다 | B2 (AC-B9·B10) |
| 중단 버튼 | 항상 동작(child 사이 포함) + **서브에이전트 중단도 listen 중 도달** | A1 (AC-A4·A21) |
| "세션 전체 중단" | **이제 실제로 서브프로세스를 죽인다**(현행은 idle 만) | A1 (AC-A5) |
| 작업 중 업데이트 설치 | **차단된다**(현행은 교체 창에 설치가 통과할 수 있다) | A1 (AC-A22) |
| 앱 종료 | active 서브프로세스까지 정리(현행은 잔존 가능) | A1 (AC-A23) |
| steer 라우팅·concurrency | 현행 유지 | B2 (AC-B9) |
| 기존 renderer 경로 | `phase` 유지 | B2 (AC-B6) |
| 대기 이유 | 라벨·개수로 설명(정보 추가, 축소 0) | B2 (AC-B10) |

## 범위 / 비범위

- **범위**: 스테이지 A + B, AC **38건**(A 26 + B 12) + 사람 실기, `IPC_CONTRACT.md` 동기화.
- **비범위**:
  - **foreground/transport UI 분리** — 결정 ⑤로 미채택.
  - **provider 통지 유실의 재조정** — SDK 에 태스크 열거 API 없음.
  - 대기 라벨 **최종 문구** — verify 사람 실기에서 확정(i18n **키는 이번에 확정**).
  - **RuntimePool 의 active 추적 일반화** — lease 가 active 를 들고 있으므로 풀은 현행(idle 전용)
    유지. 풀 자체를 active/idle 2단으로 바꾸는 리팩토링은 하지 않는다.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| foreground/transport UI 분리 | **아니오** — 스냅샷이 이미 `transport`·`backgroundTaskCount` 를 싣는다. 채택 시 `sessionBusy` 한 줄 |
| provider 통지 유실 재조정 | **아니오** — SDK 가 열거 API 를 주면 붙인다 |
| RuntimePool active 2단화 | **아니오** — lease 가 소유권을 들고 있어 풀은 저장소로 남는다 |
| 대기 라벨 문구 | **아니오**(문자열). **i18n 키는 이번에 확정**(일방향) |

## 의존 기술 / 전제

- 기댈 기존 모듈: `SessionRuntimeRegistry`·`Supervisor`·`RuntimePool` · `SessionRuntime`(프레임·
  `canSteer`) · `PendingMessageQueue`(rollback 반쪽 존재) · `claudeToNormalized`(배열 반환) ·
  `sessionBusy` · `StatusLine`.
- 전제 1: `live.events` 소비처는 `session-runtime.ts` **3곳뿐** — A3 면적의 근거.
- 전제 2: `orphaned` 는 여전히 확정 가능(`pending-message-queue.ts:250`).
- 전제 3: in-process 백그라운드 태스크는 서브프로세스와 함께 죽는다(0136 승계) — A4 토큰 스코프 근거.
- 전제 4: renderer pending id 정합은 `ids`(messageId)가 담당 — A4 attemptId 재발급 근거.
- 전제 5: registry 소비처는 **전수 9곳**이며 전부 `hasSession`/`getBySession`/`all()` 3개 술어로
  표현된다 — A1 이 계약을 유지하며 교체 가능한 근거.
- **신규 의존성: 없음.**

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **0143** listen 대기 = 작업 중(inflight 지속) | `ChatTile.tsx:51-53` · `chatReducer.ts:92-96` | §B2 "애니메이션을 끄지 않는다" | **유지 — 사용자 결정 ⑤** |
| **registry 의 turn 단위 등록** (채택 결정 문서 없음 — *구조*) | `session-registry.ts:3-5`, `:21-42` | §A1 전체 | **구조 변경** — 등록 단위를 체인(lease)으로 올린다. `hasSession`/`getBySession` 계약은 유지하고 `allLeases()` 를 신설 |
| **재시작 게이트·shutdown 이 `all()`(turn 집합)로 판정** (구조) | `bootstrap.ts:490-494`, `:553-560` | §A1 "`allLeases()` 가 닫는 현행 결함 2건" | **구조 변경 + 현행 결함 수정** — 판정 근거를 lease 로 올린다(작업 중 업데이트 설치 차단·active runtime 종료) |
| **세션 제어 상태를 turn-local 에 보관** (구조) | `chat-turn.ts:96-112`(`freshTurnLocalState`) | §A1 `control` | **구조 변경** — 세션 수명 사실을 lease 로 올린다(원칙 ⑤). 턴-로컬은 순수 턴 상태만 남긴다 |
| **어댑터가 steer push 를 수행** (구조) | `claude.ts:393-397` · `claude-adapt.ts:146-178` | §A2 전체 | **구조 변경** — 어댑터는 제출 *요청* 만, push·토큰 결합은 Runtime(원칙 ⑥). 훅의 fail-open·rollback 의미는 유지 |
| **0067** "uuid 보존 = renderer pending id 정합" | `pending-message-queue.ts:328-332` 주석 | §A4 "정합은 `ids` 가 담당한다" | **정밀화** — wire uuid 는 시도마다 재발급 |
| 0154 "재주입도 폐기도 아닌 기다림" | `chat-turn.ts:920-936` | §A4·AC-A17 | **유지** |
| 0151 "잔여는 교집합만 / 처분은 사용자 선택" | `interrupt-reconcile.ts:1-16` | §A2·B1 | **유지** — 처분 수단이 **이제 실제로 동작**한다(A5) |
| 0136 릴리즈 밸브 no-op 규칙 | `session-runtime.ts:416-418` | §B2 "현행 유지" | **유지** |
| 0153 send admission(`inflight‖listening‖pendingCount`) | `sendAdmission.ts:15-24` | §B2·AC-B9 | **유지** |
| 0067 "unframed 는 무손실 이월" | `session-runtime.ts:330-332` | §A3 | **유지·정밀화** |
| main 레이어 DAG(feature 교차 금지) | `eslint.config.mjs` · `src/main/AGENTS.md` | §A4 "토큰은 주입" · §B1 "컴포지션 루트가 구독" | **준수** |
| IPC variant 변경 시 `IPC_CONTRACT.md` 동시 갱신 | `docs/AGENTS.md` §6 | §B2 | **준수** — AC-B12 |

## 파생 UX / 엣지케이스

- **child 교체 창의 즉시 재전송**: pending 버블 → 기존 체인의 held → 릴리즈 밸브로 flush(A1·A2).
- **handoff 가드가 더 오래 참이 된다**: `hasSession(handoffFrom)` 이 체인 내내 true → 진행 중
  세션에서의 핸드오프가 확실히 거부된다(현행은 교체 창에서 통과 가능). **더 보수적 = 안전 방향.**
- **recovery**: `isSessionLive` 도 체인 내내 true → 살아 있는 세션의 dangling 복구를 건너뛴다
  (`recovery.ts:31`) — 안전 방향.
- **취소 직후 즉시 재전송**: A3 이 result 배치를 통째로 드레인에 걸어 다음 턴이 오염되지 않는다.
- **채널 사망**: `finishPump` 가 토큰을 무효화 → 영수증·트래커 잔류가 함께 소멸.
- **앱 종료**: `all()` 이 activeChild 를 돌려주므로 shutdown abort 경로 불변(AC-A6).
- **창 종료/renderer 소멸**: 라우팅 타이머 0. 표시 타이머는 언마운트로 정리.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| **lease 누수 시 세션이 영구 busy** — 모든 send 가 held 로만 쌓인다 | 해제는 outer `finally` **단일 지점** + leaseId CAS. `all()`/shutdown 이 강제 정리. AC-A3 로 CAS 를 잠그고, lease 존재를 스냅샷(`transport`)으로 항상 관측 가능하게 한다 |
| A1 이 registry 계약을 바꾼다 — 소비처 9곳 회귀 | 3개 술어(`hasSession`/`getBySession`/`all`) **계약을 유지**하고 내부만 교체. AC-A6 이 승인·중단·shutdown 경로를 양성 단언 |
| A2 제출 트랜잭션이 send 경로를 재배치한다 | `submitting` 롤백은 기존 `rollbackSteerFlush` 의 확장. AC-A9 가 실패 경로를 잠근다 |
| A4 가 wire uuid 를 바꾼다 — 지각 echo 매칭 | 지각 echo 는 **죽은 채널 소속**이라 도달하지 않는다. AC-A17(같은 시도의 지각 echo 확정)·AC-A18(구 시도 무시)을 **양쪽 다** 잠근다 |
| 토큰 스코프가 **살아 있는 태스크를 지울** 위험 | AC-A19 후반(같은 토큰 유지)을 양성 단언. 토큰은 채널 교체 시에만 바뀐다(전제 3) |
| 스냅샷 발행 폭풍 | 값 변화 시에만 발행(AC-B8). 페이로드는 정수 6개 |
| 0143 유지의 귀결 — 진짜 통지 유실 시 애니메이션 지속 | 사용자 결정 ⑤의 명시적 귀결. 라벨·개수·중단 버튼으로 항해 가능. UI 분리 채택 시 `sessionBusy` 한 줄 |
| 스테이지 A 의 diff 가 크다 | 커밋을 A1(lease) → A2(제출 포트) → A3/A4(라우팅·identity) 순으로 쪼갠다. **A1 만 들어가도 현행 결함 3건**(작업 중 업데이트 설치·종료 시 서브프로세스 잔존·서브에이전트 중단 열화)이 닫히므로, 부분 착지도 순이득이다 |
| **A2 가 어댑터 훅 계약을 바꾼다** — steer 가 조용히 끊기면 사용자가 알아채기 어렵다 | 훅의 fail-open·rollback 구조를 **그대로 보존**하고 포트만 교체한다. AC-A24 가 "훅이 포트를 부른다"·"포트가 토큰 결합까지 한다" 를 양쪽에서 잠그고, 기존 `engine.steer.submit-rejected`·`flush-failed` 경고 로그를 유지해 무증상 실패를 만들지 않는다 |
| **lease `control` 로 옮긴 상태가 턴-로컬 사용처와 이중화될 수 있다** | 턴-로컬에서 **제거**하고 lease 만 남긴다(복제 금지 — 원칙 ③). `settleSubagentTask` 등 소비처는 lease control 을 인자로 받는다 |

- 되돌리기 어려운 결정: `chat.listen` 스냅샷 필드(공개 IPC) — additive + `phase` 유지.
  i18n 키 이름 이번 확정.
- **단독 결정 금지 항목(Open Question)**: 없음.

## 영향 받는 파일

**스테이지 A**
- `app/src/main/features/sessions/session-registry.ts` · `supervisor.ts` — lease 계층
  (`swapChild` 원자 교체 · CAS release · `control` · `providerKey` · **`allLeases()`** ·
  `discardRuntime` 이 active 도달)
- `app/src/main/app/bootstrap.ts` — `restartGateState()`·`shutdown` 이 **`allLeases()` 기준**으로
  (현행 결함 2건 수정)
- `app/src/main/features/sessions/session-runtime.ts` — `submit()`·**`submitSteer()`** 트랜잭션 ·
  `ChannelToken` 발급·부착 · `routeBatch`
- `app/src/main/adapters/{types,turn,claude,claude-adapt,mock}.ts` —
  `ProviderMessageBatch{sequence,events}`(토큰 미생성) · **게이트 훅이 `submitSteer` 포트 호출**
- `app/src/main/features/chat/pending-message-queue.ts` — `PreparedAttempt/BoundAttempt` ·
  `submitting` · identity 강등 · `survivedInterrupt`
- `app/src/main/features/chat/background-tasks.ts` — 토큰 스코프
- `app/src/main/app/chat-turn.ts` — lease 수명 · **`canSteer`·`providerKey` 판정 교정** ·
  chainId 발급 · 제어 상태를 lease 로 이관(`freshTurnLocalState` 축소)

**스테이지 B**
- `app/src/main/features/chat/pending-message-queue.ts` — 파생 selector · 변경 알림
- `app/src/main/app/chat-turn.ts` — 큐 구독(라우터 수명) · 스냅샷 발행
- `app/src/shared/ipc.ts` — `chat.listen` 스냅샷(additive, `phase` 유지)
- renderer — `chatReducer.ts`(revision·스냅샷) · `chatStore.ts`(**`sessionBusy` 불변**) ·
  `PendingAssistant.tsx` · `StatusLine.tsx` · `shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md`

**변경 없음**: `features/chat/post-turn.ts`(라우팅 타이머 0) · `RuntimePool`(idle 저장소 유지)

## 참고 문서

- `docs/arch/backend/adapters.md` · `docs/arch/backend/observability.md`
- `docs/IPC_CONTRACT.md` §2/§3 (§6 변경 절차)
- `docs/handoff/` 0154 · 0151 · 0143 · 0136 · 0153 · 0067 · 0051(§A 런타임 거버넌스)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed
  (196 files)** + node:test **28 pass**.
- 신규 테스트: supervisor/registry 7 · bootstrap(게이트·shutdown) 2 · session-runtime 8 ·
  pending-message-queue 8 · background-tasks 2 · 어댑터 3 · chat-turn harness 10 · renderer 3.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 5건 + 사용자 결정 2건을 인용, 추론은 표기
- [x] 자료조사 — r4 신규 10행 + 계승 19행, 전부 `파일:라인`. **인용 앵커를 직접 열어 확인**
- [x] 의존 기술 — 전제 5건, 신규 의존성 0
- [x] 파생 UX — child 교체 창·handoff 가드·recovery·취소 후 재전송·채널 사망·앱 종료·창 종료 7건
- [x] 리스크 — 7건 + 완화책, Open Question 0
- [x] **요구 ⑦(비판적 검토) 이행** — 3차: 2건 확정 / 1건 **등급 하향**(근거를 코드로 반박). 4차: **3건 전부 확정**(2건은 **현행 결함**)하되 **제안 3건은 미채택**(채널 폐기·공개 게이트·providerBinding 복제 — 근거 기재). 리뷰가 **놓친 4건**(런타임 close · discardRuntime idle-only · canSteer UX 함정 · **제어 상태 상시 리셋**)을 추가로 찾아 설계에 반영
- [x] `검증 수단` 공란 0 — AC 38건 중 36건 `파일::케이스`, 사람 실기 2건(절차 명시), 문서 대조 1건
- [x] 부정형/"불변" 기준 0개 — AC-A2·A3·A11·A12·A16·A18·B7 은 "…를 받는다"·"무시된다"·"false 로 남는다"·"submitted 로 남는다" 로 **관측 가능한 상태**를 단언
- [x] AC 간 모순 없음 — 짝 확인: A1↔A16(체인 미생성 / 그래도 identity 방어선 유지) · A17↔A18(같은 시도 확정 / 다른 시도 무시) · A19 전·후반(무효화 vs 과잉 삭제) · A2↔A20(에러 없음 + 경계 검사는 살아 있음 — 상호 보완) · A25↔A9(CAS 실패는 push 0 / push 실패는 held 롤백 — 서로 다른 시점) · A22↔A26(lease 존재 = 게이트 참 / 교체 중 hasSession 참) · B8(변화 시 발행 / 동일 값 미발행) · B9↔B10(busy 정의 불변 + 라벨만 추가) · B10↔B11(근거 있으면 유지 / 없으면 정지)
- [x] 인용 수치 직접 측정 — registry 소비처 **9곳** · `live.events` 소비처 **3** · 생산자 **2** · `orphanUnconfirmed` **2** · SDK subtype **4** · `TerminalReason` **19** · 영수증 지연 **6.06초** · 게이트 기준선 전부 이번 세션
- [x] 신규 모듈 테스트 방법 — 6항목 전부. electron 의존은 **기존 harness seam**, 토큰은 **주입**이라 순수 테스트 가능
- [x] 전수 조사 N — 위 수치 + `teardownChannel()` **3** + lease 소비처 **9**
- [x] 각 AC 에 프로덕션 도달 경로 — 유일한 호출자가 테스트인 AC 0개
- [x] "사람 실기" AC 에 실행 경로(4단계 + `ps` 보조)가 있고 비범위에 막혀 있지 않다
- [x] 선택적 필드 미지정 케이스 — `eventBatches` 를 **계약**으로 규정해 미지정 케이스를 없앴다(AC-A14 가 mock 준수를 잠근다). `terminal_reason` 은 optional 이라 판정에 쓰지 않는다(근거 기록)
- [x] 소비 계약의 제약 필드 강제 지점 — lease(누가 획득·누가 CAS 해제)·토큰(누가 발급·누가 검사)·시도/체인(누가 발급·강등 조건)·배치 경계(누가 terminal 전이)·잔여(누가 파생·언제 발행)를 §A1~B1 에 명시
- [x] 참조 구현 전수 커버리지 — `SDKResultError.subtype` 4멤버가 같은 분기 → A3 이 전수 커버
- [x] 미룬 항목 일방향 여부 — 4건 답변. UI 분리는 selector 한 줄로 전환 가능하게 스냅샷 필드를 미리 싣는다. i18n 키는 이번 확정
- [x] 관문 4 를 본문 완성 후 실행 — 기존 결정 표 10행을 본문 문장 인용으로 채웠고, 인용 경로를 실제로 열어 확인
- [x] "확정돼 있다" 류 서술 — 문서 `§표제어` 근거 0건(코드 주석·`sdk.d.ts` 원문·실측 로그·사용자 결정만 인용)

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 가 직접 구현).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

**스테이지 A** (커밋 순서 = A1 → A2 → A3/A4)
- [ ] A1 SessionChainLease (`swapChild` · CAS release · `control` · `providerKey` · **`allLeases()`
      → 재시작 게이트·shutdown** · discardRuntime · **canSteer/providerKey 교정**)
- [ ] A2 `submit()`/**`submitSteer()`** 트랜잭션 + `ChannelToken` + `submitting` CAS
      (**어댑터 직접 push 제거**)
- [ ] A3 ProviderMessageBatch 라우팅 (claude · mock · routeBatch)
- [ ] A4 SubmissionIdentity 강등 · 트래커 토큰 스코프

**스테이지 B**
- [ ] B1 잔여 파생 + 라우터 수명 구독 + `discardSubmitted` open 확장
- [ ] B2 호환 스냅샷(`phase` 유지 · revision) + StatusLine 라벨 · i18n 키 + `IPC_CONTRACT.md`

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | ②-a 의 실제 판정 입력이 실기 로그로 확정되지 않았다 | r2 자체 검토 | r4 는 유령 근거를 각각 제거하고 AC-B11 로 최종 상태를 단언. 재현 시엔 스냅샷의 개수 필드가 입력을 가린다 | open |
| D2 | 진짜 백그라운드 통지 유실 시 애니메이션 지속(0143 유지의 귀결) | 사용자 결정 ⑤ | 라벨·개수·중단 버튼으로 항해. UI 분리 채택 시 `sessionBusy` 한 줄 | 결정됨(유지) |
| D3 | **"세션 전체 중단" 이 현행에서 active runtime 을 못 죽인다** — 0151 이 설계한 처방이 실제로는 미동작 | r4 자체 발견(`supervisor.ts:141-149`) | A1 이 lease 의 runtime 을 직접 잡아 해소(AC-A5) | 이번 범위 |
| D4 | **[현행 결함] 작업 중 업데이트 설치가 허용될 수 있다** — 재시작 게이트가 `all()`(turn 집합)로 `isGenerating` 을 판정해, 턴-후 루프의 child 교체 창에서 거짓이 된다 | r5 검증(`bootstrap.ts:490-494` · `shared/update-restart.ts:10`) | A1 `allLeases()` 로 lease 수 기준 판정(AC-A22) | 이번 범위 |
| D5 | **[현행 결함] 종료 시 active 서브프로세스가 잔존할 수 있다** — `shutdown` 이 `all()` abort + idle 풀 close 뿐이라 교체 창의 active runtime 이 어디에도 안 잡힌다 | r5 검증(`bootstrap.ts:553-560`) | A1 이 모든 lease 의 runtime 을 직접 close(AC-A23) | 이번 범위 |
| D6 | **[현행 열화] 서브에이전트 중단이 연속·listen 턴에서 `stopTask` 에 도달하지 못한다** — 제어 상태가 `freshTurnLocalState()` 로 턴마다 리셋 | r5 자체 발견(`chat-turn.ts:96-112`) | A1 `control` 을 lease 로 이관(AC-A21) | 이번 범위 |
