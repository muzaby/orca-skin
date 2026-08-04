# Plan — 0165-cancel-residue-and-listen-hang (r2)

> **r2 전면 개정.** r1(증상 3개 ↔ 점 수정 3개)은 리뷰에서 P1 3건으로 Request changes 됐고,
> 그 지적을 확인하는 과정에서 **r1 의 원인 귀속 자체가 미증명**임이 드러났다. r2 는 증상별
> 패치를 버리고 세 증상이 공유하는 **구조적 결함**을 겨냥한다. r1 의 F1(interrupt 표식)·
> F4(유예 상한 타이머)·F6(teardown 시 잔여 해제)은 **폐기**한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0165-cancel-residue-and-listen-hang` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 (r1) → 2026-08-04 (r2 개정) |
| 매핑 | PHASES 행 (verify PASS 후 승격) |
| 상태 | r1 READY → **리뷰 Request changes** → r2 DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "첫 취소에서 orca ui에서는 어시스턴트의 **에러 메시지 버블 노출**. 이후 delta 도착 시작하자, 에러 메시지 버블 삭제후 delta 출력 시작" | 라이브 세션 요청 (2026-08-04) + 첨부 `orcacancelresendanalysis.md` §1 |
| 명시 요구 ② | "마지막 어시스턴트 답변 이후 **inflight 애니메이션 지속** + 패널스택에서 **'중단했지만 대기 중인 메시지가 남아 있습니다'** 표기" | 라이브 세션 요청 + 첨부 §2 |
| 명시 요구 ③ (r2) | "**구조적결함을 반드시 극복해야 한다. 단 사용자 경험을 해치면 안 된다.**" | 라이브 세션 지시 (r1 리뷰 후) |
| 명시 요구 ④ (r2) | "**이 작업의 목적은 핸드오프 문서 작성까지만이다.**" | 동상 |
| 외부 리뷰 | P1 3건 (teardown 잔여 은폐 · 3초 타이머 오귀속 · 세션 단위 강등 오염) | r1 PR 리뷰 (Request changes) |
| 추론 의도 | ③은 "증상별 대증요법 금지 + 기존 UX 축소 금지" 로 읽는다 — 즉 결함은 원인 제거하되, 0143 이 만든 대기 표시를 **빼는 방식으로 해결하지 말라**는 제약 (추론) | ③ 문면 |

## Context (왜)

실기 세션 `8f6ad70c`(2026-08-03 02:11:29~02:12:20Z, 앱 `0.3.1`)의 취소→재전송 반복에서 세 가지가
어긋났다. 로그에 `error`/`warn` 이 0건인 것이 핵심 단서다 — 셋 다 예외가 아니라 **정상 경로의
오판**이라 관측 레코드 없이 UI 만 틀어진다.

r1 은 이를 세 개의 독립 버그로 보고 각각 패치했다. 그 접근이 리뷰에서 막힌 이유는 패치가 틀려서만이
아니라, **세 증상이 같은 뿌리에서 나오는데 뿌리를 건드리지 않았기 때문**이다. r2 는 뿌리를 쓴다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **전제 정정 (2차)** — r1 은 ②-a 의 원인을 `haveUnconfirmed` 로 단정했으나 **증명되지 않는다.** 재주입 배치는 프렐류드·프롬프트 uuid 가 모두 `turnOpenUuids` 에 실려 첫 모델 출력에서 확정된다. 실기 로그의 마지막 listen 이 어느 입력으로 열렸는지는 **로그로 가릴 수 없다**(판정 입력 미기록). r2 는 원인을 단정하지 않고 **고착 가능한 입력을 각각 구조적으로 제거·노출**한다 | `turn-coordinator.ts:232-236`(turnOpenUuids), `:283-289`(model-output confirm) · 첨부 §2-1 |
| 이미 있는 것 아닌가 | **부분적으로 있다 — 그래서 위험했다.** "의도적 중단은 에러가 아니다" 는 결정이 어댑터 *예외* 경로에만 있고(`claude.ts:445-447` "설계 결정 3") result 경로엔 없다. 다만 r2 는 이를 플래그로 메우지 않는다 — C1 이 프레임 경계를 고치면 중단 result 는 드레인에 **통째로** 걸려 표식 자체가 불필요하다 | `claude.ts:445-456` ↔ `claude-map.ts:474-486` |
| 더 작은 해법이 있는가 | **r1 이 그 "더 작은 해법" 이었고 실패했다.** 점 수정 3개는 (a) 새 가변 상태 1개 (b) 라우팅 계층 타이머 1개 (c) 세션 광역 강등을 도입했고, 리뷰가 셋 다 새 오판 경로로 지목했다. C1(메시지-원자 라우팅)은 **코드량은 비슷하되 불변식을 세우므로** 같은 클래스의 미래 결함까지 닫는다. 파급 면적 실측: `live.events` 소비처 **3곳** · 생산자 **2곳** | `session-runtime.ts:174,290,342` / `claude.ts`·`mock.ts` |
| 인용 자료가 요구를 부풀리지 않았나 | **첨부 분석은 정확하다.** §4 "delta 개시 미기록" 은 설계상 정상(관측 카탈로그 원칙). 다만 §2-1 이 "로그 종료" 로 적은 것은 실제로는 **그 턴이 끝나지 않은 것**이다 | `docs/arch/backend/observability.md` · 첨부 §2-1 |
| 기존 채택 결정을 뒤집는가 | **0건.** 0143(대기=작업 중)·0154(기다린다·폐기 금지)·0136(릴리즈 밸브)·0151(교집합·사용자 선택) 전부 유지한다. 아래 §기존 결정 표 참조 | — |

- **사용자에게 올릴 것**: 없음. r1 이 OQ 로 올리려던 "대기 표시 분리" 는 요구 ③("UX 를 해치지
  말라")이 방향을 확정했다 — **애니메이션을 빼지 않고 라벨을 더한다**(C5).

## 자료조사 (Research)

> 인용 라인은 전부 이번 세션에서 직접 열어 확인했다. SDK 는 `npm ci` 로 설치한 `0.3.220` 실물.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **한 SDK 메시지가 N개 이벤트로 분해된다** — 매퍼 계약에 명시 | `claude-map.ts:1-8` (헤더) |
| **실패·취소 result 는 terminal 을 2개 낸다** — `[telemetry, error]`. `SDKResultError.subtype` 4멤버(`error_during_execution`·`error_max_turns`·`error_max_budget_usd`·`error_max_structured_output_retries`) 전부 같은 분기를 탄다 | `claude-map.ts:474-486` · `sdk.d.ts:4269-4271` |
| `error_during_execution` 은 "API 실패 **또는 취소된 요청**" 을 겸한다 | `docs/spec/claude/agent-sdk/agent-loop.md:274` |
| `terminal_reason`(`aborted_streaming` 등 19멤버)은 **optional** — 미지정 CLI 에서 판정이 무너지므로 취소 판별에 쓰지 않는다 | `sdk.d.ts:4282`, `:6909` |
| **`routeEvent` 는 첫 terminal 에서 프레임을 닫는다** — 두 번째 terminal 은 `frame===null` 이라 `unframed` 로 간다 | `session-runtime.ts:354-380` (draining 분기 `:360-367`, 프레임 분기 `:368-377`, unframed `:379`) |
| **`openFrame()` 이 `unframed` 를 새 프레임 앞에 합류**시킨다 — 소속 라벨이 없어 어느 턴 것인지 아무도 검사하지 않는다 | `session-runtime.ts:328-335` |
| `teardownChannel()` 이 `unframed` 를 비운다 → "첫 취소에서만" 증상이 나온 이유(2·3번째 취소 직후엔 forced teardown+respawn 이 있었다) | `session-runtime.ts:446` · 첨부 §3 |
| renderer 는 `error` 이벤트로 라이브 배너를 띄우고 `BEGIN_TURN` 에서 지운다 → "delta 도착 시 삭제" 와 정확히 일치 | `chatReducer.ts:546-556`, `:297-309` · `chatStore.ts:238-262` · `Exchange.tsx:64,77` |
| 같은 `error` 는 **DB 에도 다음 턴 assistant 의 error 파트로 영속**된다(재로드 시 잔존 — 미보고 파생 피해) | `features/history/writer.ts:276-285` |
| **`orphanUnconfirmed` 호출점 전수 2곳**, 둘 다 턴-후 루프 안. 루프 조건이 `!aborted` 라 취소·stall 로 끝난 체인은 **도달하지 않는다** | `chat-turn.ts:939`, `:951` (`rg` 전수) |
| **`BackgroundTaskTracker` 는 재조정 지점이 없다** — 해제는 provider 통지(`settled`)와 호출부의 `clear` 뿐 | `background-tasks.ts:41-46`, `:72-75`, `:77-79` |
| **SDK 에 태스크 열거 API 가 없다** — `Query` 는 `stopTask(taskId)`·`backgroundTasks(toolUseId?)` 뿐. `haveTasks` 를 provider 에 되물을 길이 없다 | `sdk.d.ts:2562`, `:2575` |
| **listen 턴은 stall 미무장** — 프레임을 닫는 것은 ⓐ CLI terminal ⓑ 릴리즈 밸브 ⓒ 취소뿐 | `turn-coordinator.ts:241-243` · `session-runtime.ts:419-427` |
| **중단 영수증은 늦게 온다** — 실측 6.06초(02:12:04.142 발행 → 02:12:10.202 수신), 그 사이 respawn(02:12:06.989) | `session-runtime.ts:485-504` · 첨부 §2-2/§3 |
| `takeForRespawn` 은 미확정 배치를 **폐기하지 않고 uuid 보존 재주입**한다(origin 을 turn-open 으로 재스탬프) → 죽은 큐의 영수증과도 교집합이 생긴다 | `pending-message-queue.ts:333-354` |
| `discardSubmitted` 는 `state==='submitted'` 만 매칭 → **강등된 배치는 "세션 전체 중단" 으로 폐기되지 않는다** | `pending-message-queue.ts:309-312` |
| 잔여 경고 해제 지점은 2곳뿐(영수증 clear · `chatDiscardSession`) | `chat-turn.ts:236-241`, `:806-818`, `:1109-1127` |
| `chat.listen` 는 현재 `phase` 만 싣는다(relay-only·미영속) | `app/src/shared/ipc.ts:841` · `docs/IPC_CONTRACT.md:453` |
| StatusLine 은 `turnStartedAt ?? listenStartedAt` 로 애니메이션을 유지한다(0143) | `PendingAssistant.tsx:39-42` · `StatusLine.tsx:46-100` |
| 게이트 기준선(이번 세션 실측): lint 0 error / **1 warning**(`react-hooks/incompatible-library`, 기존·무관) · typecheck 0 · vitest **1772 passed (196 files)** + node:test **28 pass** | 이번 세션 실행 |

## 구조적 결함 (Root Structure)

> **소속 없는 신호, 재조정 없는 누적기.**
> 턴 파이프라인이 비동기 provider 신호를 *현재 상태*와 대조한다. 신호에 소속(**메시지 경계·
> 채널 세대·체인 소유**)이 붙어 있지 않고, 누적 상태를 권위 신호로 되맞추는 지점이 없다.
> 신호 하나가 어긋나거나 유실되면 상태가 조용히 틀린 채 영구히 남고, 그 상태가 UI 를 붙든다.

| # | 발현 | 보고 증상 | 근거 |
|---|---|---|---|
| **F-A** | 프레임 경계 ≠ provider 메시지 경계 → 메시지 꼬리가 `unframed` 로 새어 **다음 턴에 재귀속** | ① (+ 미보고: 실제 API 실패도 동일) | `session-runtime.ts:354-380`, `:328-335` |
| **F-B** | 턴-후 판정 입력이 전부 **재조정 없는 누적기** → 하나만 고착돼도 끝나지 않는 listen 이 매 턴 열린다. 게다가 **판정 입력이 관측에 없어** 사후에 어느 누적기인지 가릴 수 없다 | ②-a | `chat-turn.ts:939,951` · `background-tasks.ts:41-46,72-75` · `turn-coordinator.ts:241-243` |
| **F-C** | 비동기 신호에 **세대·소유 태그가 없다** — 영수증은 죽은 큐와 대조되고, 잔여 경고는 파생 가능한 사실을 이벤트로 밀어 넣었고, 강등은 세션 광역이다 | ②-b | `session-runtime.ts:485-504` · `chat-turn.ts:236-241` · `pending-message-queue.ts:309-312` |

## 외부 리뷰 P1 3건 처리

| # | 지적 | 판정 | 처리 |
|---|---|---|---|
| P1-1 | teardown 에서 잔여 경고를 지우면 **실제 재실행될** 메시지를 숨긴다 | **타당** — `takeForRespawn` 은 폐기가 아니라 재주입(`:333-354`) | r1 F6 **폐기**. 잔여는 큐에서 파생하고, 배치가 실제로 큐를 떠날 때만 갱신한다(C4) |
| P1-2 | 3초 타이머가 CLI 사고 중인 창에서 프레임을 닫아 오귀속을 재생산한다 (`cliBusy` 는 이벤트 파생 상태) | **타당** — `routeEvent:356-359` | r1 F4 **폐기**. **라우팅 계층에 타이머를 두지 않는다.** 시간은 표시 계층에서만 쓴다(C5) |
| P1-3 | 세션 단위 강등이 새 턴 예약까지 오염할 수 있다 (`startResume` 은 기존 턴 종료를 기다리지 않음) | **타당** — `session-registry.ts:21-23` | 강등을 **체인 소유 uuid** 로 스코프(C2) |
| 부수 | PR 본문 `Status: implemented` 인데 코드가 없다 | 저장소 관례(0160·0161 plan 커밋 동일) | 관례는 유지하되 **커밋 본문에 "설계 전용 — 코드 없음" 을 명시**한다 |

## 설계

### 원칙 (이 핸드오프가 세우는 불변식)

> **① 소속을 붙인다** — 경계(메시지)·세대(채널)·소유(체인). 소속 없는 신호를 현재 상태와
> 대조하지 않는다.
> **② 시간은 정보를 잃지 않는 층에서만 쓴다** — 라우팅(프레임·드레인·큐)에는 타이머를 두지
> 않는다. 시간은 *표시* 를 바꿀 뿐 이벤트의 목적지를 바꾸지 않는다.

### C1 — 메시지-원자 라우팅 (F-A) ★핵심

**불변식: 한 provider 메시지의 이벤트는 전부 같은 목적지로 간다(프레임 / 드랍 / unframed).**

- `LiveTurn`(`adapters/types.ts:19`)에 **선택 필드** `eventBatches?: AsyncIterable<NormalizedEvent[]>`.
- `claude.ts` 의 `events()` 는 이미 `claudeToNormalized(msg, ctx)` 의 **배열**을 `yield*` 로 펴고
  있다 — 펴지 않고 배치째 내보내는 스트림을 추가한다(`drainCompactSummaries` 산출물은 같은
  배치 뒤에 이어 붙인다 — 현행 순서 보존).
- `SessionRuntime` pump 는 `eventBatches` 가 있으면 그것을, 없으면 `events`(이벤트 1개 = 배치 1개)를
  소비한다 → **미지정 = 현행과 완전 동일**(mock·향후 어댑터 무영향).
- `routeEvent` → `routeBatch(evs)`: 배치 전 이벤트를 같은 목적지로 보낸 **뒤** 터미널 전이
  (프레임 닫기 · draining 종료 · `cliBusy` 해제)를 적용한다.
- **효과**: ① 소멸 + 실제 실패 result 의 일반 누출 동시 소멸 + 앞으로 terminal 2개를 내는 매핑이
  생겨도 구조적으로 안전. **r1 의 `interruptedPendingResult` 플래그는 폐기**(새 가변 상태 0).

### C2 — 예약 강등을 체인 종료 라이프사이클에, 체인 소유 uuid 로 (F-B·F-C)

- `handleChatSend` 턴 체인 `finally` **1지점**에서 강등 — 정상·취소·stall·throw 전 경로 커버.
- **스코프**: 이 체인이 예약한 uuid 집합만. 수집 지점 5곳 — 턴 프롬프트(`mainBatch`)·프렐류드
  (`takeForRespawn`)·게이트(`takeSteerFlush`)·연속 턴(`reserveHeld`)·연속 턴 respawn 이월.
- `PendingMessageQueue.orphanUnconfirmed(sessionId, uuids?)` — 인자가 있으면 그 uuid 만 강등.
  기존 루프 호출 2곳은 0154 의미(세션 단위)를 유지한다.
- **동반 필수**: `discardSubmitted` 를 **open(submitted|orphaned)** 매칭으로 확장한다. 강등이
  늘어나는데 이걸 빼면 잔여 경고의 **유일한 조치가 조용히 무력화**된다(= UX 훼손).

### C3 — 채널 세대(epoch): 하나의 원시 개념으로 누출 3종을 닫는다 (F-B·F-C)

`SessionRuntime` 에 `channelEpoch`(spawn·teardown·finishPump 마다 증가)를 둔다.

1. **중단 영수증**: `markAborted` 가 호출 시점 epoch 을 캡처하고, resolve 시 epoch 이 같을 때만
   `onInterruptReceipt` 로 올린다 → 죽은 큐의 영수증이 구조적으로 걸러진다(②-b).
2. **백그라운드 태스크 추적**: 트래커 엔트리에 **관측 epoch** 을 기록하고 조회(`hasAny`·`ids`·
   `isAsyncLaunched`)를 현재 epoch 으로 필터한다. in-process 태스크는 서브프로세스와 함께
   죽으므로 세대가 바뀌면 자동 무효다. **지금은 호출부가 기억해서 `clear` 해야 하고
   (`settleDeadBackgroundTasks`), forced teardown 경로(설정·모델 변경 respawn, draining respawn)는
   그 호출이 없어 잔류가 생긴다** — epoch 스코프가 그 잔류 클래스를 호출부 기억 없이 없앤다.
   트래커는 epoch 을 스스로 알지 못하므로 **컴포지션 루트가 주입**한다(레이어 경계 유지).
3. **unframed 위생**: 버퍼 엔트리에 epoch 을 달아 세대 교체분이 섞이지 않게 한다(현행
   `teardownChannel` 의 비우기를 구조로 승격).

### C4 — 잔여 경고를 큐에서 파생 (F-C)

- `PendingMessageQueue.openUuids(sessionId)` 추가(= `submitted | orphaned`).
- `refreshResidual(sessionId, sender)`: 저장된 잔여 uuid ∩ `openUuids` → 남은 개수를
  `chat.residual` 로 보낸다(0이면 해제). 호출 지점 = C2 와 같은 체인 종료 `finally`.
- **teardown 으로는 해제하지 않는다**(P1-1) — 재주입된 배치는 여전히 실행되므로 경고가 참이다.
  배치가 확정→커밋되어 큐를 떠날 때 자연히 0이 된다.

### C5 — 대기 상태를 정직하게 (F-B 의 재조정 불가분) — UX 축소 없음

C2+C3 이후 남는 유일한 고착 경로는 **"채널은 살아 있는데 CLI 가 통지를 잊은"** 경우다. SDK 에
열거 API 가 없어 **재조정이 원리적으로 불가능**하다. r1 은 여기서 프레임을 닫으려 했고 리뷰가
막았다. r2 의 답은 **라우팅을 건드리지 않고 표시를 정직하게** 만드는 것이다.

- **0143 결정을 유지한다** — 백그라운드 대기도 "작업 중" 이고 **애니메이션은 계속 돈다.**
  빼는 변경은 없다(요구 ③).
- `chat.listen{phase:'started'}` 에 **파생값** `reason: 'tasks'|'unconfirmed'|'flush'` + `taskCount`
  를 싣는다. `decidePostTurnStep` 의 입력에서 파생하므로 **새 누적기가 생기지 않는다.**
- renderer 는 그 이유로 **StatusLine 라벨만** 바꾼다(예: 랜덤 verb 대신 "백그라운드 작업 N건
  대기 중"). 라우팅·프레임·큐 영향 0. 사용자는 비로소 *무엇을* 기다리는지 알고, 이미 있는 중단
  버튼이 그 대기를 끝낸다는 것도 안다 — **탈출구가 없던 게 아니라 보이지 않았다.**
- **관측**: listen/flush 개시 시 `chat.postturn.step` 에 `step` + 입력 5종 + `taskCount` 를 남긴다
  (카운트·불리언만 — 원문 금지). 이것이 있어야 다음 재현에서 ②-a 의 입력이 확정된다.

> **왜 이것이 "구조 결함 극복" 인가**: 고착 가능한 입력 2개 중 `haveUnconfirmed` 는 C2 로 **원인
> 제거**, `haveTasks` 는 C3 으로 **세대 잔류 제거**, 그러고도 남는 provider 통지 유실분은 재조정이
> 원리적으로 불가능하므로 **숨기지 않고 드러낸다.** 시간은 표시 계층에만 쓰므로 P1-2 의 오귀속은
> 발생하지 않는다.

| 신규 모듈 / 확장 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `LiveTurn.eventBatches?` (`adapters/types.ts`) | 메시지-원자 스트림 계약 | adapters | 타입 — 소비는 아래 두 항목이 검증 |
| `SessionRuntime.routeBatch` + `channelEpoch` | 배치 라우팅 · 세대 태깅 | features/sessions | 순수 단위 — 기존 `session-runtime.test.ts` 의 fake live 채널 harness 재사용 |
| `PendingMessageQueue.openUuids` · `orphanUnconfirmed(uuids?)` · `discardSubmitted` open 확장 | 예약 수명 | features/chat | 순수 단위 — `pending-message-queue.test.ts` |
| `BackgroundTaskTracker` epoch 스코프 | 태스크 추적 세대화 | features/chat | 순수 단위 — `background-tasks.test.ts` (epoch 은 **주입**받으므로 electron 비의존) |
| `chat.postturn.step` 로그 · `chat.listen` reason/taskCount | 관측 · 표시 신호 | app(컴포지션 루트) | electron 의존 → **기존 harness seam**: `chat-turn.runtime-tools.test.ts` 방식(ipcMain·coordinator·post-turn mock)으로 신규 `chat-turn.cancel-residue.test.ts` 에서 핸들러 직접 호출 |
| StatusLine 대기 라벨 | 표시 | renderer features/chat | reducer 단위(`chatReducer.listen.test.ts`) + 시각 확인(사람) |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 실패 result 가 만든 `[telemetry, error]` **두 이벤트가 같은 프레임으로 배달**된다(프레임 소비자가 2건을 모두 본다) | `features/sessions/session-runtime.test.ts::"실패 result 배치는 같은 프레임으로 전부 배달된다"` | CLI result → `claude.ts` eventBatches → pump → `routeBatch` → `consumeFrame` → `TurnCoordinator` |
| 2 | 취소 draining 중 도착한 실패 result 배치는 **전부 드랍되고 `hasUnframedBacklog` 가 false 로 남는다** | `session-runtime.test.ts::"취소 draining 중 result 배치는 통째로 드랍된다"` | `chat:cancel` → `abortTurn` → `markAborted`(draining) → `routeBatch` |
| 3 | `eventBatches` **미제공** 어댑터는 이벤트 1건 = 배치 1건으로 현행과 동일하게 라우팅된다 (미지정 케이스) | `session-runtime.test.ts::"배치 미지원 어댑터는 이벤트 단위로 동일 동작한다"` | mock 어댑터(dev) · 향후 어댑터 |
| 4 | claude 어댑터가 **한 SDK 메시지의 정규화 결과를 한 배치로** 내보낸다 | `adapters/claude.eventbatches.test.ts::"한 SDK 메시지 = 한 배치"` | `ClaudeAdapter.sendMessage` → `LiveTurn.eventBatches` |
| 5 | 취소 후 재전송한 턴의 transcript 에 **직전 턴의 에러 배너가 서지 않고 답변만 렌더**된다 | **사람 실기** — `cd app && npm run dev` → 전송 → 응답 중 중단 → 재전송 → transcript 확인 (renderer·main 모두 범위 안) | 앱 전체 |
| 6 | 취소로 끝난 턴 체인이 **자기 체인이 예약한** uuid 를 `orphaned` 로 강등한다 | `app/chat-turn.cancel-residue.test.ts::"취소로 끝난 체인이 자기 uuid 를 강등한다"` | `chat:cancel` → `abortTurn` → `handleChatSend` 의 `finally` |
| 7 | 이전 체인의 `finally` 실행 후에도 **다른 체인이 예약한 배치는 `submitted` 로 남는다** (리뷰 요구 ③) | `features/chat/pending-message-queue.test.ts::"uuid 스코프 강등은 다른 배치를 건드리지 않는다"` | 동 6 (세션 재사용 경합) |
| 8 | `orphaned` 배치가 **지각 echo 로 `confirmed` 된다**(강등이 커밋을 잃게 하지 않는다) | `pending-message-queue.test.ts::"orphaned 배치도 지각 echo 로 확정된다"` (기존 AC7 케이스 유지) | 취소 후 CLI 가 큐 잔여를 뒤늦게 픽업 |
| 9 | "세션 전체 중단" 이 **`orphaned` 배치도 폐기해 텍스트를 draft 로 되돌린다** | `pending-message-queue.test.ts::"discardSubmitted 는 orphaned 도 폐기한다"` | 잔여 Notice 버튼 → `chat:discardSession` |
| 10 | **세대가 바뀐 뒤 도착한 중단 영수증은 `onInterruptReceipt` 로 배달되지 않는다** (리뷰 요구 ①) | `session-runtime.test.ts::"세대가 바뀐 뒤 도착한 중단 영수증은 폐기된다"` | `markAborted` → `live.interrupt()` promise → delegate |
| 11 | **같은 세대**에서 도착한 영수증은 그대로 배달된다 | `session-runtime.test.ts::"같은 세대의 중단 영수증은 배달된다"` | 동 10 |
| 12 | 채널 teardown/respawn 후 **이전 세대의 태스크 추적은 `hasAny` 가 false** 다 | `features/chat/background-tasks.test.ts::"세대가 바뀌면 이전 세대 엔트리는 조회되지 않는다"` | 설정·모델 변경 respawn(`decideRespawn`) · draining respawn |
| 13 | **같은 세대 안에서는** 등록한 태스크가 `hasAny`/`isAsyncLaunched` 로 계속 조회된다(과잉 삭제 방지) | `background-tasks.test.ts::"같은 세대 엔트리는 유지된다"` | 백그라운드 서브에이전트 실행 세션 |
| 14 | **respawn 재주입 후에도 잔여 경고 count 가 유지**된다 (리뷰 요구 ②·P1-1) | `chat-turn.cancel-residue.test.ts::"respawn 재주입 후에도 잔여 경고가 유지된다"` | `chat:send` respawn → `takeForRespawn` → 체인 종료 `refreshResidual` |
| 15 | 잔여 배치가 확정→커밋되어 큐를 떠나면 **`chat.residual{count:0}` 이 나간다** | `chat-turn.cancel-residue.test.ts::"잔여 배치가 커밋되면 경고가 해제된다"` | 동 14 |
| 16 | `openUuids` 가 `submitted` 와 `orphaned` 를 **둘 다** 센다 | `pending-message-queue.test.ts::"openUuids 는 submitted+orphaned 를 센다"` | C4 파생 계산 |
| 17 | `chat.listen{phase:'started'}` 가 **`reason` 과 `taskCount` 를 싣는다** | `chat-turn.cancel-residue.test.ts::"listen 신호가 이유와 태스크 수를 싣는다"` | 턴-후 루프 → `sendChatEvent` → renderer |
| 18 | `reason:'tasks'` 대기에서 **StatusLine 이 대기 라벨을 표시하고 애니메이션은 유지**된다(0143 보존) | `features/chat/reducer/chatReducer.listen.test.ts::"listen reason 이 상태에 반영된다"` + **사람 실기**(백그라운드 서브에이전트 실행 후 라벨·애니메이션 동시 확인) | `PendingAssistant.tsx:42` → `StatusLine` |
| 19 | listen/flush 개시 시 `chat.postturn.step` 이 **step + 입력 5종 + taskCount** 를 남긴다(원문 0건) | `chat-turn.cancel-residue.test.ts::"턴-후 판정 입력이 로그에 남는다"` | `~/.config/orca/logs/` JSONL |
| 20 | `docs/IPC_CONTRACT.md` 의 `chat.listen` 행이 **새 필드(`reason`·`taskCount`)를 반영**한다 | `docs/IPC_CONTRACT.md` 육안 대조(verify 체크) | 문서 SSOT |

## 범위 / 비범위

- **범위**: C1~C5 + 위 20개 AC + `IPC_CONTRACT.md` 동기화.
- **비범위**:
  - **provider 통지 유실 자체의 재조정** — SDK 에 태스크 열거 API 가 없다(`sdk.d.ts:2562,2575`).
    C5 가 이를 *드러내는* 데까지가 이번 범위다.
  - renderer 대기 라벨의 **최종 문구** — verify 의 사람 실기에서 확정(i18n 키는 만든다).
  - 첨부 §4 의 "delta 개시 미기록"·"3.499초 무이벤트 구간" — 로깅 카탈로그 설계 사안.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| provider 통지 유실 재조정 | **아니오** — SDK 가 열거 API 를 주면 그때 붙인다. 지금 대체 구현을 넣으면 SDK 도입 시 두 벌이 된다 |
| 대기 라벨 문구 | **아니오** — i18n 문자열, 저장·전송되지 않음. 단 **i18n 키 이름은 이번에 확정**한다(키는 코드 참조가 생기는 일방향 문) |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `claudeToNormalized`(이미 배열 반환) · `PendingMessageQueue` · `SessionRuntime`
  프레임 모델 · `decidePostTurnStep` · `BackgroundTaskTracker` · `sendChatEvent` · `StatusLine`.
- 전제 1: `live.events` 소비처는 `session-runtime.ts` **3곳뿐**이다(`:174` 셔틀 getter, `:290`
  turn-scoped, `:342` pump) — 이 전제가 깨지면 C1 의 파급 면적 추정이 무너진다.
- 전제 2: `orphaned` 는 여전히 확정 가능하다(`confirm` 의 `open` 술어) — `pending-message-queue.ts:250`.
- 전제 3: in-process 백그라운드 태스크는 서브프로세스와 함께 죽는다(0136 의 전제를 승계) —
  C3-2 의 epoch 무효화가 이에 근거한다.
- **신규 의존성: 없음.**

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| 0143 "listen 대기도 사용자 관점 작업 중 — 애니메이션 지속" | 코드 주석 `ChatTile.tsx:51-53` · `chatReducer.ts:92-96` | §설계 C5 "애니메이션은 계속 돈다. 빼는 변경은 없다" | **유지** (요구 ③이 재확인) |
| 0154 "재주입도 폐기도 아닌 **기다림**" / "orphaned 는 폐기 대상이 아니다" | `chat-turn.ts:920-936` · `pending-message-queue.ts:294-305` | §설계 C2 "강등은 폐기가 아니다 — 지각 echo 로 확정 가능(AC8)" | **유지** |
| 0154 "미확정 유예는 1라운드 — 무한 대기 불가" | `post-turn.ts:51-53` | §구조적 결함 F-B | **유지** — 라운드는 1회였고 문제는 *길이*였다. r1 은 이를 타이머로 끊으려다 막혔고, r2 는 **고착 입력 자체를 제거**한다(C2·C3) |
| 0136 "릴리즈 밸브는 CLI 자동 턴 진행 중이면 no-op" | `session-runtime.ts:416-418` | §설계 C5(밸브 미변경) | **유지** — 밸브에 손대지 않는다 |
| 0151 "잔여는 교집합만 / 처분은 사용자 선택" | `interrupt-reconcile.ts:1-16` · `chat-turn.ts:753-767` | §설계 C3-1·C4 | **유지** — 판정 규칙·선택지는 그대로, *영수증의 유효 범위*와 *해제 시점*만 정한다 |
| 0067 "unframed 는 무손실 이월" | `session-runtime.ts:330-332` | §설계 C1·C3-3 | **유지·정밀화** — 이월은 유지하되 **메시지 꼬리가 섞이지 않게** 한다 |
| main 레이어 DAG(feature 교차 import 금지) | `app/eslint.config.mjs` · `src/main/AGENTS.md` | §설계 C3-2 "트래커는 epoch 을 주입받는다" | **준수** — `features/chat` 가 `features/sessions` 를 import 하지 않도록 컴포지션 루트가 주입 |
| IPC 이벤트 variant 변경 시 `IPC_CONTRACT.md` 동시 갱신 | `docs/AGENTS.md` · `IPC_CONTRACT.md §6` | §설계 C5 (`chat.listen` 필드 추가) | **준수** — AC20 으로 강제 |
| "의도적 중단은 에러가 아니다(설계 결정 3)" | `claude.ts:445-447` | §설계 C1 "표식 없이 드레인이 통째로 거른다" | **유지** — 같은 결정을 *구조* 로 달성(플래그 추가 0) |

## 파생 UX / 엣지케이스

- **취소 직후 즉시 재전송**: C1 이 result 배치를 통째로 드레인에 걸어 다음 턴이 오염되지 않는다.
- **중단했는데 result 가 영영 안 오는 경우**: 채널 사망 → `finishPump` 가 epoch 을 올린다 →
  영수증·트래커 잔류가 함께 무효화(C3).
- **취소 + 백그라운드 태스크 동시 존재**: C2 는 예약만 강등하고 태스크 추적은 건드리지 않는다.
  다음 턴 후에도 `haveTasks` 로 listen 이 열리고 **애니메이션은 유지**된다(0143) — 다만 라벨이
  "백그라운드 작업 N건 대기 중" 으로 바뀌어 사용자가 상태를 안다(C5).
- **잔여 경고 표시 중 세션 전체 중단**: C2 의 open 확장 덕에 강등된 배치도 폐기되고 텍스트가
  draft 로 복원된다. `chat.residual{count:0}` 은 renderer 에서 멱등(`chatStore.ts:476-483`).
- **창 종료/renderer 소멸**: C5 는 타이머를 쓰지 않으므로 정리 대상이 없다.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| C1 이 프레임 모델의 핵심 경로를 바꾼다 — 회귀 시 턴 경계 전반이 흔들린다 | 선택 필드로 도입해 **미지정 = 현행 동일**(AC3)로 폴백 경로를 남긴다. 소비처 3곳·생산자 2곳으로 면적이 실측 확정돼 있고, 배치 라우팅 자체는 순수 단위 테스트 대상이다 |
| C3-2 의 epoch 필터가 **살아 있는 태스크를 지워** 완료 통지를 잃을 수 있다 | AC13(같은 세대 유지)을 양성 단언으로 잠근다. epoch 은 **채널 교체 시에만** 증가하며, 채널이 죽으면 in-process 태스크도 죽는다는 0136 전제를 승계한다 |
| C5 가 판정 입력을 로그에 남긴다 — 관측 카탈로그 증가 | 카운트·불리언만(원문 0). `observability.md` 의 prod info 원칙 준수. AC19 로 형식을 고정 |
| ②-a 의 실제 입력이 여전히 미확정이라, 이번 변경으로 증상이 안 사라질 수 있다 | **문서에 그렇게 적는다**(원인 단정 금지). C2·C3 은 각각 *증명된* 고착 경로를 없애고, 남는 경우는 C5 가 드러낸다 — verify 는 "증상 소멸" 이 아니라 **AC 충족 + 재현 로그 확보**로 판정한다 |

- 되돌리기 어려운 결정: `chat.listen` 의 필드 추가(공개 IPC variant) — additive-optional 로 두고
  `IPC_CONTRACT.md` 에 동시 기재한다. i18n 키 이름도 이번에 확정한다.
- **단독 결정 금지 항목(Open Question)**: 없음.

## 영향 받는 파일

- `app/src/main/adapters/types.ts` — `LiveTurn.eventBatches?` (C1)
- `app/src/main/adapters/claude.ts` — 배치 스트림 (C1). **r1 의 interrupt 표식 없음**
- `app/src/main/features/sessions/session-runtime.ts` — `routeBatch` · `channelEpoch` (C1·C3)
- `app/src/main/features/chat/pending-message-queue.ts` — `openUuids` · `orphanUnconfirmed(uuids?)`
  · `discardSubmitted` open 확장 (C2·C4)
- `app/src/main/features/chat/background-tasks.ts` — epoch 스코프 (C3-2)
- `app/src/main/app/chat-turn.ts` — chainUuids 수집 · `finally` 강등/`refreshResidual` · listen
  reason · `chat.postturn.step` (C2·C4·C5)
- `app/src/shared/ipc.ts` — `chat.listen` variant 필드 (C5)
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` · `store/chatStore.ts` ·
  `components/transcript/PendingAssistant.tsx` · `components/StatusLine.tsx` ·
  `shared/i18n/resources/{ko,en}.ts` — 대기 라벨 (C5)
- `docs/IPC_CONTRACT.md` — `chat.listen` 행 갱신 (AC20)
- `app/src/main/features/chat/post-turn.ts` — **변경 없음**(r1 의 `isUnconfirmedGraceListen`·
  `UNCONFIRMED_GRACE_MS` 폐기)

## 참고 문서

- `docs/arch/backend/adapters.md` (어댑터 정규화) · `docs/arch/backend/observability.md` (로그 원칙)
- `docs/IPC_CONTRACT.md` §2/§3 — **`chat.listen` variant 변경 동시 갱신 필수**(§6 변경 절차)
- `docs/handoff/0154-steer-premature-orphan-cancel/plan.md` · `0151-steer-queue-state-machine/plan.md`
  · `0143`(백그라운드 기본화) · `0136`(listen 프레임·릴리즈 밸브)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 기준선(이번 세션 실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 ·
  vitest **1772 passed (196 files)** + node:test **28 pass**.
- 신규 테스트: session-runtime 5건 · pending-message-queue 4건 · background-tasks 2건 ·
  claude 어댑터 1건 · chat-turn harness 5건 · chatReducer 1건.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 4건(원 보고 2 + r2 지시 2)을 인용, 추론은 추론으로 표기
- [x] 자료조사 — 발견 20행 전부 `파일:라인`, **인용 앵커를 이번 세션에 직접 열어 확인**
- [x] 의존 기술 — 전제 3건 명시, 신규 의존성 0
- [x] 파생 UX — 취소/재전송/채널 사망/태스크 병존/창 종료 5건
- [x] 리스크 — 4건 + 완화책, Open Question 0건
- [x] 요구 비판적 검토 5질문 — **전제를 2차 정정**(r1 의 원인 귀속 철회)하고도 요구 범위를 줄이지 않았다(보고 3현상 전부 범위 안)
- [x] `검증 수단` 공란 0 — AC 20건 중 18건이 `파일::케이스`, AC5·AC18 이 "사람 실기 + 실행 경로", AC20 이 문서 대조
- [x] 부정형/"불변" 기준 0개 — AC3·AC8·AC13 은 "동일하게 라우팅된다"·"확정된다"·"유지된다" 로 양성 단언. AC2 는 "드랍되고 `hasUnframedBacklog` 가 false 로 남는다" 로 **관측 가능한 상태**를 단언
- [x] AC 간 모순 없음 — 짝 확인: AC1↔AC2(프레임 생존 vs draining) · AC3↔AC4(미지정 vs 제공) · AC12↔AC13(세대 무효화 vs 과잉 삭제 방지) · AC6↔AC7(자기 체인 vs 타 체인) · AC8↔AC9(강등 후 확정 vs 강등 후 폐기 — 서로 다른 종착지라 양립)
- [x] 인용 수치 직접 측정 — SDK subtype 4멤버·`TerminalReason` 19멤버·`stopTask`/`backgroundTasks` 2메서드는 설치본 `sdk.d.ts`, 호출점 전수(`orphanUnconfirmed` 2 · `live.events` 3 · 생산자 2)는 `rg`, 영수증 지연 6.06초는 첨부 로그 타임스탬프 차, 게이트 기준선은 이번 세션 실행
- [x] 신규 모듈 테스트 방법 — 6항목 전부. electron 의존(chat-turn)은 **기존 harness seam** 명시, epoch 은 **주입**으로 순수 테스트 가능하게 설계
- [x] 전수 조사 N — `orphanUnconfirmed` **2곳** · `live.events` 소비처 **3곳** · 생산자 **2곳** · `teardownChannel()` 호출점 **3곳** · SDK result subtype **4멤버** · `TerminalReason` **19멤버**
- [x] 각 AC 에 프로덕션 도달 경로 — 유일한 호출자가 테스트인 AC 0개
- [x] "사람 실기" AC(5·18)에 실행 경로가 있고 비범위에 막혀 있지 않다(renderer·main 모두 범위 안)
- [x] 선택적 필드 미지정 케이스 AC — `eventBatches` 미지정 = 현행 동작을 **AC3** 이 잠근다. `terminal_reason` 은 optional 이라 **판정에 쓰지 않기로** 결정하고 근거를 §자료조사에 기록
- [x] 소비 계약의 제약 필드 강제 지점 — 세대(누가·언제 증가/검사)·소유(누가 uuid 를 수집)·배치 경계(누가 터미널 전이를 적용)를 §설계 C1~C3 에 명시
- [x] 참조 구현 전수 커버리지 — `SDKResultError.subtype` 4멤버가 모두 같은 분기를 타므로 C1 이 전수 커버
- [x] 미룬 항목 일방향 여부 — 2건 모두 답변, i18n **키 이름은 일방향이라 이번에 확정**
- [x] 관문 4 를 본문 완성 후 실행 — 기존 결정 표 9행을 본문 문장 인용으로 채웠고, 인용 경로를 실제로 열어 확인
- [x] "확정돼 있다" 류 서술 — 문서 `§표제어` 를 근거로 삼지 않고 **코드 주석·`sdk.d.ts` 원문·실측 로그**만 인용(앵커 인용 0건)

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 가 직접 구현). 설계자는 위쪽을 쓰고,
> 구현자는 이 블록만 추가한다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

- [ ] C1 메시지-원자 라우팅
- [ ] C2 체인 소유 강등 + `discardSubmitted` open 확장
- [ ] C3 channel epoch (영수증 · 트래커 · unframed)
- [ ] C4 잔여 경고 파생
- [ ] C5 listen reason · 대기 라벨 · `chat.postturn.step`
- [ ] `IPC_CONTRACT.md` 동기화

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
| D1 | ②-a 의 실제 판정 입력이 실기 로그로 확정되지 않았다 — C5 의 `chat.postturn.step` 로 다음 재현에서 확정한다 | r2 자체 검토(r1 원인 귀속 철회) | 재현 로그 확보 후 필요 시 후속 핸드오프 | open |
