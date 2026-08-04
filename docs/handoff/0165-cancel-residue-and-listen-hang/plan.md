# Plan — 0165-cancel-residue-and-listen-hang (r3)

> **개정 이력**
> - **r1** — 증상 3개 ↔ 점 수정 3개. 외부 리뷰 **Request changes (P1 3건)**.
> - **r2** — 구조(경계·세대·소유)로 전환. 리뷰가 C1(메시지-원자 라우팅)을 **올바른 구조적
>   해결**로 인정했으나 **새 P1 3건** — 그중 첫 번째는 **r2 가 만든 결함**(uuid 소유권의 ABA).
> - **r3 (본 문서)** — 소유권을 uuid 에서 **SubmissionIdentity** 로 올리고, 잔여를 **큐의 즉시
>   파생값**으로, 표시 신호를 **멱등 스냅샷**으로 바꾼다. 스테이지 A/B 로 편성.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0165-cancel-residue-and-listen-hang` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 (r1 → r2 → r3) |
| 매핑 | PHASES 행 (verify PASS 후 승격) |
| 상태 | r3 DRAFT → **READY** |
| 편성 | **1 핸드오프 · 2 스테이지** (A = main 소속·라우팅·큐 진실 / B = 표시 신선도) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "첫 취소에서 orca ui에서는 어시스턴트의 **에러 메시지 버블 노출**. 이후 delta 도착 시작하자, 에러 메시지 버블 삭제후 delta 출력 시작" | 라이브 세션 (2026-08-04) + 첨부 `orcacancelresendanalysis.md` §1 |
| 명시 요구 ② | "마지막 어시스턴트 답변 이후 **inflight 애니메이션 지속** + 패널스택에서 **'중단했지만 대기 중인 메시지가 남아 있습니다'** 표기" | 동상 + 첨부 §2 |
| 명시 요구 ③ | "**구조적결함을 반드시 극복해야 한다. 단 사용자 경험을 해치면 안 된다.**" | 라이브 세션 (r1 리뷰 후) |
| 명시 요구 ④ | "**이 작업의 목적은 핸드오프 문서 작성까지만이다.**" | 동상 |
| **사용자 결정 ⑤** | **0143(listen 대기 = inflight 지속) 표시 결정을 유지한다 — 라벨만 추가.** 리뷰의 foreground/transport UI 분리 제안은 채택하지 않는다 | 라이브 세션 (r2 리뷰 후, 선택지 제시에 대한 응답) |
| **사용자 결정 ⑥** | **0165 한 건으로 두되 2 스테이지로 편성한다** | 동상 |
| 외부 리뷰 1차 | P1 3건 — teardown 잔여 은폐 · 3초 타이머 오귀속 · 세션 단위 강등 오염 | r1 PR 리뷰 |
| 외부 리뷰 2차 | P1 3건 — **uuid 스코프의 ABA** · 잔여 파생 시점 누락 · listen 신호 1회성/증상 미해소 검증 | r2 PR 리뷰 |

## Context (왜)

실기 세션 `8f6ad70c`(2026-08-03 02:11:29~02:12:20Z, 앱 `0.3.1`)의 취소→재전송 반복에서 세 가지가
어긋났다. 로그의 `error`/`warn` 이 0건인 것이 단서다 — 셋 다 예외가 아니라 **정상 경로의 오판**
이라 관측 레코드 없이 UI 만 틀어진다.

r1(점 수정)은 리뷰에 막혔고, r2(구조 전환)는 방향을 인정받았으나 **소유권 표현을 uuid 로 둔 탓에
같은 결함을 ABA 형태로 재생산**했다. r3 는 소유권·잔여·표시를 각각 **정체성(identity)·파생값·
스냅샷**으로 올려 결함 클래스를 닫는다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **전제 3차 정정.** r1 은 ②-a 를 `haveUnconfirmed` 로 단정했다(미증명 — 재주입 배치는 첫 모델 출력에서 확정된다). r2 는 원인 단정을 철회했으나 소유권을 uuid 로 표현해 **새 오염 경로**를 열었다. r3 는 ②-a 를 "**유령 근거로 열리는 listen**" 문제로 재정의하고, 유령 근거 2종(취소 체인 잔류 예약 · 세대 지난 태스크 엔트리)을 각각 제거한다 | `turn-coordinator.ts:232-236`, `:283-289` · 아래 §자료조사 P1-1 행 |
| 이미 있는 것 아닌가 | **없다 — 오히려 있던 것이 함정이었다.** `takeForRespawn` 의 "uuid 보존" 은 renderer pending id 정합을 위한 것인데(0067), 그 정합은 실제로는 `ids`(messageId)가 담당한다. wire uuid 까지 보존한 탓에 **죽은 채널의 영수증이 산 배치와 교집합**을 만든다 | `pending-message-queue.ts:328-354` · `chat-turn.ts:1120-1124`(ids 사용) |
| 더 작은 해법이 있는가 | **r1·r2 가 각각 "더 작은 해법" 이었고 둘 다 실패했다.** r1 = 점 수정 3개(새 상태·라우팅 타이머·광역 강등), r2 = uuid 스코프. 두 번의 실패가 공통으로 가리키는 것은 **표현이 부족하다**는 것이다 — 소유권을 표현할 타입이 없으니 스코프를 좁혀도 ABA 가 남는다. r3 의 `SubmissionIdentity` 는 필드 3개 추가로 그 표현을 만든다 | 리뷰 1·2차 |
| 인용 자료가 요구를 부풀리지 않았나 | **리뷰 2차 지적 3건 모두 코드로 재현 경로까지 확인**했다(§자료조사). 부풀림 없음. 다만 리뷰의 처방 중 **UI 분리는 사용자가 채택하지 않았다**(결정 ⑤) — 그 부분만 대체 설계(B2)로 답한다 | §자료조사 · 결정 ⑤ |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다.** 0143 은 사용자 결정으로 **유지**, 0067 은 *정밀화*(정합 주체를 `ids` 로 명시)한다. 나머지(0136·0151·0153·0154) 유지 | §기존 결정 표 |

- **사용자에게 올릴 것**: 없음(결정 ⑤·⑥ 으로 해소).

## 자료조사 (Research)

> 인용 라인은 전부 이번 세션에서 직접 열어 확인했다. SDK 는 `npm ci` 로 설치한 `0.3.220` 실물.

### r3 에서 새로 확정한 사실 (리뷰 2차 검증)

| 발견 | 레퍼런스 |
|---|---|
| **ABA 오염은 도달 가능하다 — r2 의 결함.** 턴-후 루프는 listen 마다 `supervisor.startResume(sessionId, listenTurn)` 로 등록을 갈아끼우고, listen 종료 `finally` 에서 `supervisor.release(listenTurn)` 한다. `registry.finish` 는 **값 동일성으로 `bySession` 항목을 삭제**하므로 **체인 A가 아직 도는 중에 `hasSession=false` 창**이 열린다 → 그 창의 send 가 **새 체인 B**를 시작하고 `takeForRespawn` 이 **같은 uuid** 를 재주입 → 뒤늦은 A의 `finally` 가 B의 배치를 강등한다 | `chat-turn.ts` listen 분기(`startResume`/`release`) · `session-registry.ts:21-23`, `:35-42` · `pending-message-queue.ts:333-354` |
| **잔여는 큐 변경 시점에 갱신돼야 한다.** 배치가 큐를 떠나는 실제 지점은 `TurnCoordinator.commitConsumed` → `drainConfirmed` 다. 체인 `finally` 에서만 재파생하면 백그라운드 listen 이 이어지는 동안 **커밋 뒤에도 경고가 남는다** | `turn-coordinator.ts:167-187` |
| **listen 신호는 1회성이다.** `beginListenPhase` 가 `listenPhaseSessionId` 가드로 **started 를 1회만** 발행한다 → 엣지 이벤트에 파생값(reason·taskCount)을 실으면 flush→tasks 전이·태스크 감소가 반영되지 않는다 | `chat-turn.ts:869-878` |
| renderer 의 busy 는 **단일 정의**다 — `sessionBusy = inflight \|\| listening`. 0143 을 유지하려면 이 정의를 건드리지 않으면 된다 | `chatStore.ts:1286-1292` |
| pending id 정합의 실제 주체는 `ids`(messageId 목록)다 — `message.cancelled`·`message.committed`·`message.submitted` 가 모두 `ids` 로 renderer 와 맞춘다 | `chat-turn.ts:1096-1103`, `:1120-1124` · `turn-coordinator.ts:176-186` |

### r2 에서 확정한 사실 (유지)

| 발견 | 레퍼런스 |
|---|---|
| 한 SDK 메시지가 N개 이벤트로 분해된다 | `claude-map.ts:1-8` |
| **실패·취소 result 는 terminal 을 2개 낸다** — `[telemetry, error]`. `SDKResultError.subtype` **4멤버** 전부 같은 분기 | `claude-map.ts:474-486` · `sdk.d.ts:4269-4271` |
| `error_during_execution` 은 "API 실패 **또는 취소된 요청**" 겸용 | `docs/spec/claude/agent-sdk/agent-loop.md:274` |
| `terminal_reason`(19멤버)은 **optional** → 취소 판별에 쓰지 않는다 | `sdk.d.ts:4282`, `:6909` |
| `routeEvent` 가 **첫 terminal 에서 프레임을 닫아** 두 번째가 `unframed` 로 샌다 | `session-runtime.ts:354-380`(draining `:360-367` · 프레임 `:368-377` · unframed `:379`) |
| `openFrame()` 이 `unframed` 를 새 프레임 **앞에 합류**시킨다(소속 라벨 없음) | `session-runtime.ts:328-335` |
| `teardownChannel()` 이 `unframed` 를 비운다 → "첫 취소에서만" 증상이 난 이유 | `session-runtime.ts:446` · 첨부 §3 |
| renderer 는 `error` 로 배너를 띄우고 `BEGIN_TURN` 에서 지운다 + **DB 에도 error 파트로 영속**된다 | `chatReducer.ts:546-556`, `:297-309` · `writer.ts:276-285` |
| `orphanUnconfirmed` 호출점 **전수 2곳**, 둘 다 턴-후 루프 안(루프 조건 `!aborted`) | `chat-turn.ts:939`, `:951` |
| `BackgroundTaskTracker` 는 **재조정 지점이 없다**(해제 = provider 통지 + 호출부 `clear`) | `background-tasks.ts:41-46`, `:72-79` |
| **SDK 에 태스크 열거 API 가 없다** — `stopTask`·`backgroundTasks` 뿐 | `sdk.d.ts:2562`, `:2575` |
| listen 턴은 **stall 미무장** — 프레임을 닫는 것은 CLI terminal·릴리즈 밸브·취소뿐 | `turn-coordinator.ts:241-243` · `session-runtime.ts:419-427` |
| 중단 영수증 실측 지연 **6.06초**, 그 사이 respawn | 첨부 §2-2/§3 |
| `discardSubmitted` 는 `submitted` 만 매칭 | `pending-message-queue.ts:309-312` |
| `live.events` 소비처 **3곳**(전부 `session-runtime.ts`), 생산자 **2곳** | `:174`, `:290`, `:342` / `claude.ts`·`mock.ts` |
| 게이트 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed (196 files)** + node:test **28 pass** | 이번 세션 실행 |

## 구조적 결함 (Root Structure)

> **소속 없는 신호, 재조정 없는 누적기, 복제된 상태.**

| # | 발현 | 보고 증상 | 처방 |
|---|---|---|---|
| **F-A** | 프레임 경계 ≠ provider 메시지 경계 → 메시지 꼬리가 `unframed` 로 새어 **다음 턴에 재귀속** | ① (+ 실제 API 실패도 동일) | A1 |
| **F-B** | 턴-후 판정 입력이 **재조정 없는 누적기** → 유령 근거로 listen 이 열리고 끝나지 않는다 | ②-a | A2 · B2 |
| **F-C** | 비동기 신호·예약에 **소속(세대·체인·시도) 표현이 없다** — uuid 는 재사용되므로 소유권이 못 된다(ABA) | ②-b (+ r2 가 만든 새 오염) | A2 |
| **F-D** | 파생 가능한 사실을 **별도 Map 으로 복제**하고 갱신 시점을 놓친다 | ②-b 고착 | A3 |

## 외부 리뷰 처리

### 1차 (r1 → r2) — 전부 수용 완료

| 지적 | 처리 |
|---|---|
| teardown 에서 잔여 해제 = 재실행될 메시지 은폐 | r1 F6 폐기 → 큐 파생(A3) |
| 라우팅 계층 3초 타이머의 오귀속 | r1 F4 폐기 → 라우팅 타이머 0(원칙 ②) |
| 세션 단위 강등 오염 | 스코프 도입 → r3 에서 identity 로 완성(A2) |

### 2차 (r2 → r3)

| # | 지적 | 판정 | 처리 |
|---|---|---|---|
| P1-1 | uuid 스코프만으로는 소유권이 안 된다(ABA) | **타당 — r2 의 결함** | **A2 SubmissionIdentity.** 강등은 `(attemptId, chainId)` 일치 시에만. AC7·AC22 로 잠근다 |
| P1-2 | 잔여가 **큐 변경 시점에** 갱신되지 않는다 | **타당** | **A3 큐 파생 + 전이 즉시 발행.** `residualBySession` Map 폐기. AC15 로 잠근다 |
| P1-3 | listen 신호 1회성 → reason/count 노후 / 증상 미해소로도 검증 통과 | **타당** | **B1 멱등 스냅샷**(AC17) + **B2 유령 listen 제거**로 ②-a 최종 상태를 AC 로 단언(AC21) + 사람 실기에 세 최종 상태 전부 포함(AC5) |
| C1 코멘트 | `eventBatches` 는 선택적 우회로가 아니라 **계약**이어야 한다 | **타당** | A1 에서 **필수 계약**으로 규정, mock 포함 전 어댑터 준수(AC23) |

## 설계

### 원칙

> ① **소속을 붙인다** — 경계(메시지)·세대(채널)·소유(체인·시도).
> ② **시간은 정보를 잃지 않는 층에서만 쓴다** — 라우팅(프레임·드레인·큐)에 타이머 0. 시간은
> *표시* 를 바꿀 뿐 이벤트의 목적지를 바꾸지 않는다.
> ③ **상태는 사실에서 파생하고, 사실이 바뀌는 순간 발행한다** — 별도 Map 으로 복제하지 않는다.

---

### 스테이지 A — main 측 소속·라우팅·큐 진실

#### A1. ProviderBatch 라우팅 (F-A)

**불변식: 한 provider 메시지의 이벤트는 전부 같은 목적지로 간다(프레임 / 드랍 / unframed).**

```ts
interface ProviderBatch {
  channelId: string          // 이 배치를 낸 채널 세대
  sequence: number           // 채널 내 단조 증가
  events: NormalizedEvent[]  // 한 provider 메시지의 정규화 결과
}
```

- `LiveTurn.eventBatches: AsyncIterable<ProviderBatch>` — **선택적 우회로가 아니라 계약**(리뷰
  요구). *어댑터가 한 provider 메시지에서 다중 이벤트를 내면 반드시 하나의 배치로 낸다.*
  단일 이벤트만 내는 어댑터(mock)도 **1-이벤트 배치**로 낸다 — 두 경로를 남기지 않는다.
- `claude.ts` 의 `events()` 는 이미 `claudeToNormalized(msg, ctx)` 의 **배열**을 `yield*` 로 펴고
  있다 — 펴지 않고 배치째 내보낸다. `drainCompactSummaries` 산출물은 같은 배치 뒤에 이어 붙여
  현행 순서를 보존한다.
- `routeEvent` → `routeBatch(batch)`: `channelId` 가 현재 세대와 다르면 통째로 폐기하고, 같으면
  전 이벤트를 한 목적지로 보낸 **뒤** terminal 전이(프레임 닫기·draining 종료·`cliBusy` 해제)를
  적용한다.
- 효과: ① 소멸 + **실제 실패 result 의 일반 누출 동시 소멸**. r1 의 `interruptedPendingResult`
  가변 플래그는 불필요(새 상태 0).

#### A2. SubmissionIdentity — uuid 를 소유권으로 쓰지 않는다 (F-B·F-C, P1-1)

```ts
interface SubmissionIdentity {
  messageId: string   // 논리 메시지(= renderer pending id). respawn 에서도 보존
  attemptId: string   // 제출 시도마다 새로 발급 (= wire uuid / promptUuid)
  chainId: string     // handleChatSend 체인마다 발급
  channelId: string   // 채널 spawn 마다 발급
}
```

- **강등 조건**: `(attemptId, chainId)` 가 **모두** 일치할 때만 `submitted → orphaned`.
  지각한 체인 A의 `finally` 는 체인 B가 새로 발급한 attemptId 와 어긋나 아무것도 못 건드린다.
- **respawn**: `messageId` 보존 · `attemptId`·`channelId` **재발급**.
  - 0067 의 "uuid 보존 = renderer pending id 정합" 은 **`ids`(messageId 목록)가 담당**한다
    (`message.cancelled`·`committed`·`submitted` 전부 `ids` 기반) → wire uuid 갱신은 UI 정합을
    깨지 않는다.
  - 반대로 지금의 uuid 보존은 **죽은 채널의 영수증이 산 배치와 교집합**을 만든다 —
    attemptId 재발급이 그 오탐의 뿌리를 뽑는다.
- **영수증·echo**: `still_queued`(= attemptId 목록)는 **발행 당시 channelId 가 현재와 같을 때만**
  반영한다. 지각 echo 도 attemptId 불일치면 무시된다.
- **백그라운드 트래커**: 엔트리를 `channelId` 로 스코프한다 → forced teardown 경로(설정·모델
  변경 respawn, draining respawn)가 `clear` 를 호출하지 않아 생기던 **잔류 클래스**가 호출부
  기억 없이 사라진다. 트래커는 channelId 를 **주입**받는다(feature 교차 import 금지 준수).

#### A3. 잔여를 큐의 즉시 파생값으로 (F-D, P1-2)

- `residualBySession` Map **폐기**. 배치에 사실만 표시한다 — `TrackedBatch.survivedInterrupt: boolean`
  (영수증 화해가 세운다).
- 파생: `residualCount(sessionId) = open(batches).filter(b => b.survivedInterrupt).length`
  (open = `submitted | orphaned`). 순수 함수 — 단위 테스트 대상.
- **큐의 모든 전이가 단일 mutation 경계를 지나고, 전이 직후 변경을 알린다.** 큐(`features/chat`)는
  IPC 를 모르므로 **컴포지션 루트가 구독해 발행**한다(레이어 경계 유지).
  - `confirm → drainConfirmed` → 잔여 **즉시 0** (체인 종료를 기다리지 않는다 — P1-2 의 핵심)
  - `takeForRespawn` → `survivedInterrupt` 보존, identity 재발급
  - `discardSubmitted` → 제거 + draft 복원. **open(submitted|orphaned) 매칭으로 확장**한다
    (강등이 늘어난 대가 상쇄 — 빼면 잔여 경고의 유일한 조치가 조용히 무력화된다)
  - 이전 attempt 의 지각 신호 → identity 불일치로 무시

---

### 스테이지 B — 표시 신선도 (0143 **유지** · 사용자 결정 ⑤)

#### B1. 엣지 이벤트 → 멱등 스냅샷 (P1-3 전반)

- `chat.listen` 을 **스냅샷**으로 확장한다(additive):
  ```ts
  { type: 'chat.listen'; sessionId: string
    transport: 'idle' | 'listening'
    reason: 'tasks' | 'unconfirmed' | 'flush' | null
    pendingCount: number; residualCount: number; backgroundTaskCount: number }
  ```
  기존 `phase` 는 `transport` 로 대체하되 **동일 의미**(started↔listening / ended↔idle)를 유지한다.
- **값이 바뀔 때마다 재발행**한다(엣지 1회 아님) → flush→tasks 전이·태스크 감소가 즉시 반영.
  동일 값 재발행은 하지 않는다(소음 0).
- **0143 유지**: renderer busy 판정은 `inflight || transport === 'listening'` — `sessionBusy` 단일
  정의를 **바꾸지 않는다**(`chatStore.ts:1286-1292`). **애니메이션을 끄지 않는다.**
- 추가 필드는 **라벨 전용**: StatusLine 이 `reason`/`backgroundTaskCount` 로 문구를 바꾼다
  ("백그라운드 작업 N건 대기 중"). 장시간 무이벤트면 라벨만 "종료 확인 대기" 로 전환한다 —
  **표시 계층 타이머는 허용**(프레임·큐·라우팅 불변이라 원칙 ②를 위반하지 않는다).
- 중단 버튼·steer 라우팅·concurrency 자기-차감은 **현행 유지**(0136/0153 계약 보존).

#### B2. ②-a 를 "유령 listen 제거" 로 해소 (P1-3 후반)

0143 을 유지하면 **애니메이션이 도는 것 자체는 결함이 아니다** — 진짜 백그라운드 작업이 있을
때는 그것이 올바른 표시다. 결함은 **없는 근거로 listen 이 열리는 것**이다.

- A2 가 유령 근거 2종을 제거한다 — ⓐ 취소·stall 로 끝난 체인이 남긴 예약(강등이 이제 확실히
  실행되고 ABA 로 되살아나지 않는다) ⓑ 세대가 지난 태스크 엔트리(channelId 스코프).
- 그 결과 **미정착 태스크 0 + 열린 예약 0** 이면 턴-후 루프가 `break` 하고 `transport:'idle'`
  스냅샷이 나가 **애니메이션이 멈춘다** → AC21 로 단언한다.
- **남는 경우의 귀결을 명시한다**: 진짜 백그라운드 태스크의 provider 통지가 유실되면 (SDK 에
  열거 API 가 없어 재조정 불가) 애니메이션은 0143 결정대로 유지된다. 사용자는 라벨·개수로 무엇을
  기다리는지 알고, 이미 있는 중단 버튼으로 벗어난다. **이는 결정 ⑤의 귀결이지 결함의 은폐가
  아니다** — 검증은 AC21(유령 근거 없음 → 정지)로 판정한다.

| 신규 모듈 / 확장 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `ProviderBatch` + `LiveTurn.eventBatches` | 메시지-원자 스트림 계약 | adapters | 어댑터 단위(claude·mock) + 라우팅 단위 |
| `SessionRuntime.routeBatch` · `channelId` | 배치 라우팅 · 세대 발급/검사 | features/sessions | 순수 단위 — 기존 `session-runtime.test.ts` fake live 채널 harness |
| `SubmissionIdentity` · `survivedInterrupt` · 파생 selector · mutation 알림 | 예약 수명·잔여 진실 | features/chat | 순수 단위 — `pending-message-queue.test.ts` |
| `BackgroundTaskTracker` channelId 스코프 | 태스크 추적 세대화 | features/chat | 순수 단위(channelId **주입**이라 electron 비의존) |
| chainId 발급 · identity 강등 · 큐 변경 구독 · 활동 스냅샷 | 배선 | app(컴포지션 루트) | **기존 harness seam** — `chat-turn.runtime-tools.test.ts` 방식으로 신규 `chat-turn.cancel-residue.test.ts` |
| StatusLine 라벨 · 스냅샷 수용 | 표시 | renderer features/chat | `chatReducer.listen.test.ts` + 시각 확인(사람) |

## 인수 기준 (Acceptance Criteria)

> 스테이지 A = AC1~16, 스테이지 B = AC17~21, 공통 = AC22~23.

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 실패 result 가 만든 `[telemetry, error]` **두 이벤트가 같은 프레임으로 배달**된다 | `session-runtime.test.ts::"실패 result 배치는 같은 프레임으로 전부 배달된다"` | CLI result → `claude.ts` eventBatches → pump → `routeBatch` → `consumeFrame` → `TurnCoordinator` |
| 2 | 취소 draining 중 도착한 실패 result 배치는 **전부 드랍되고 `hasUnframedBacklog` 가 false 로 남는다** | `session-runtime.test.ts::"취소 draining 중 result 배치는 통째로 드랍된다"` | `chat:cancel` → `abortTurn` → `markAborted` → `routeBatch` |
| 3 | **이전 세대(channelId)의 배치는 통째로 폐기**된다 | `session-runtime.test.ts::"세대 불일치 배치는 라우팅되지 않는다"` | respawn 직후 도착하는 구 채널 잔여 |
| 4 | claude 어댑터가 **한 SDK 메시지의 정규화 결과를 한 배치로** 내보낸다 | `adapters/claude.eventbatches.test.ts::"한 SDK 메시지 = 한 배치"` | `ClaudeAdapter.sendMessage` → `LiveTurn.eventBatches` |
| 5 | 취소 후 재전송 흐름에서 ⓐ 에러 배너 부재 ⓑ 답변 완료 후 애니메이션 정지 ⓒ 커밋 순간 잔여 해제 ⓓ 재시작 후 error 카드 부재 — **네 최종 상태가 모두 관측**된다 | **사람 실기** — `cd app && npm run dev`, 아래 §재현 절차 4단계 | 앱 전체 |
| 6 | 취소로 끝난 턴 체인이 **자기 체인·자기 시도**의 예약을 `orphaned` 로 강등한다 | `chat-turn.cancel-residue.test.ts::"취소로 끝난 체인이 자기 시도를 강등한다"` | `chat:cancel` → `abortTurn` → `handleChatSend` 의 `finally` |
| 7 | **같은 messageId 가 새 체인에 재귀속된 뒤** 이전 체인의 `finally` 가 실행돼도 **새 시도는 `submitted` 로 남는다**(ABA) | `pending-message-queue.test.ts::"attemptId 불일치 강등은 새 시도를 건드리지 않는다"` + `chat-turn.cancel-residue.test.ts::"listen release 창에서 시작된 새 체인이 오염되지 않는다"` | listen `release` → `hasSession=false` 창 → 새 send |
| 8 | `orphaned` 배치가 **지각 echo 로 `confirmed` 된다**(강등이 커밋을 잃게 하지 않는다) | `pending-message-queue.test.ts::"orphaned 배치도 지각 echo 로 확정된다"` | 취소 후 CLI 가 큐 잔여를 뒤늦게 픽업 |
| 9 | "세션 전체 중단" 이 **`orphaned` 배치도 폐기**해 텍스트를 draft 로 되돌린다 | `pending-message-queue.test.ts::"discardSubmitted 는 orphaned 도 폐기한다"` | 잔여 Notice → `chat:discardSession` |
| 10 | **채널이 교체된 뒤 도착한 중단 영수증은 잔여 판정에 반영되지 않는다** | `session-runtime.test.ts::"세대 불일치 영수증은 폐기된다"` | `markAborted` → `live.interrupt()` promise → delegate |
| 11 | **같은 세대**의 영수증은 그대로 반영된다 | `session-runtime.test.ts::"같은 세대의 중단 영수증은 배달된다"` | 동 10 |
| 12 | 채널 교체 후 **이전 세대의 태스크 추적은 `hasAny` 가 false** 다 | `background-tasks.test.ts::"세대가 바뀌면 이전 세대 엔트리는 조회되지 않는다"` | 설정·모델 변경 respawn · draining respawn |
| 13 | **같은 세대 안에서는** 등록한 태스크가 `hasAny`/`isAsyncLaunched` 로 계속 조회된다 | `background-tasks.test.ts::"같은 세대 엔트리는 유지된다"` | 백그라운드 서브에이전트 세션 |
| 14 | **respawn 재주입 후에도 `residualCount` 가 유지**된다(`survivedInterrupt` 보존) | `pending-message-queue.test.ts::"takeForRespawn 은 survivedInterrupt 를 보존한다"` | `chat:send` respawn → `takeForRespawn` |
| 15 | 잔여 배치가 커밋되는 **그 순간**(백그라운드 listen 진행 중, **체인 종료 전**) `residualCount` 가 0으로 갱신돼 발행된다 | `pending-message-queue.test.ts::"drain 직후 파생 잔여가 0이 된다"` + `chat-turn.cancel-residue.test.ts::"listen 중 커밋이 잔여 경고를 즉시 해제한다"` | `commitConsumed` → `drainConfirmed` → 큐 변경 알림 → `chat.residual` |
| 16 | `residualCount` 파생 함수가 **open(submitted+orphaned) 중 `survivedInterrupt` 만** 센다 | `pending-message-queue.test.ts::"잔여 파생은 open·survivedInterrupt 교집합이다"` | A3 파생 계산 |
| 17 | 대기 **이유·태스크 수가 바뀌면 스냅샷이 재발행**된다(flush→tasks 전이·태스크 감소) | `chat-turn.cancel-residue.test.ts::"활동 스냅샷은 값이 바뀔 때마다 재발행된다"` | 턴-후 루프 → `sendChatEvent` → renderer |
| 18 | 동일 값 스냅샷은 재발행되지 않는다(소음 0) | `chat-turn.cancel-residue.test.ts::"값이 같으면 스냅샷을 재발행하지 않는다"` | 동 17 |
| 19 | `reason:'tasks'` 대기에서 **StatusLine 이 대기 라벨과 개수를 표시하고 애니메이션은 유지**된다(0143 보존) | `chatReducer.listen.test.ts::"스냅샷이 상태에 반영된다"` + **사람 실기**(백그라운드 서브에이전트 실행 후 라벨·애니메이션 동시 확인) | `PendingAssistant.tsx:42` → `StatusLine` |
| 20 | `sessionBusy` 정의가 **`inflight \|\| listening` 그대로**여서 중단 버튼·steer 라우팅·concurrency 차감이 현행과 동일하게 동작한다(0143·0153·0136 보존) | `chatStore.test.ts::"busy 정의는 스냅샷 도입 후에도 동일하다"` | Composer(중단·전송) · `shouldQueueAsPending` |
| 21 | 취소→재전송→답변 완료 후 **미정착 태스크 0 + 열린 예약 0** 이면 `transport:'idle'` 스냅샷이 발행된다 (**②-a 최종 상태**) | `chat-turn.cancel-residue.test.ts::"유령 근거가 없으면 턴-후 루프가 종료 신호를 낸다"` + 사람 실기(AC5-2) | 턴-후 루프 `break` → `endListenPhase` |
| 22 | 이전 attempt 의 **지각 echo 는 현재 시도의 상태를 바꾸지 않는다** | `pending-message-queue.test.ts::"이전 attempt 의 지각 echo 는 무시된다"` | respawn 후 구 채널 echo |
| 23 | **mock 어댑터도 배치 계약을 지킨다**(단일 이벤트 = 1-이벤트 배치) — 우회로 0 | `adapters/mock.test.ts::"mock 도 ProviderBatch 로 낸다"` | dev mock 백엔드 |
| 24 | `docs/IPC_CONTRACT.md` 의 `chat.listen` 행이 **스냅샷 필드를 반영**한다 | 문서 육안 대조(verify 체크) | 문서 SSOT |

### 사람 실기 재현 절차 (AC5)

`cd app && npm run dev` 후:

1. 전송 → 응답 중 **중단** → 재전송 → transcript 에 **에러 배너 없음**(①).
2. 답변 완료 후(백그라운드 작업 없음) → **애니메이션 정지**(②-a).
3. 잔여 경고가 떴다면 → 그 메시지가 커밋되는 순간 **경고 즉시 해제**(②-b).
4. 앱 재시작 후 같은 대화 → 답변 위에 **error 카드 없음**(① 영속 경로).

## 범위 / 비범위

- **범위**: 스테이지 A + B, AC 24건, `IPC_CONTRACT.md` 동기화.
- **비범위**:
  - **foreground/transport UI 분리**(리뷰 2차 제안) — **사용자 결정 ⑤로 미채택.** 0143 유지.
  - **provider 통지 유실의 재조정** — SDK 에 태스크 열거 API 없음(`sdk.d.ts:2562,2575`).
  - 대기 라벨 **최종 문구** — verify 사람 실기에서 확정(i18n **키는 이번에 확정**).

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| foreground/transport UI 분리 | **아니오** — 스냅샷이 이미 `transport`·`backgroundTaskCount` 를 싣고 있어, 나중에 채택하면 **selector 한 줄**(`sessionBusy`)만 바꾸면 된다. r3 가 그 문을 열어둔다 |
| provider 통지 유실 재조정 | **아니오** — SDK 가 열거 API 를 주면 붙인다. 지금 대체 구현은 두 벌이 된다 |
| 대기 라벨 문구 | **아니오**(문자열). 단 **i18n 키 이름은 이번에 확정**(코드 참조가 생기는 일방향 문) |

## 의존 기술 / 전제

- 기댈 기존 모듈: `claudeToNormalized`(배열 반환) · `PendingMessageQueue` · `SessionRuntime` 프레임
  모델 · `decidePostTurnStep` · `BackgroundTaskTracker` · `sendChatEvent` · `StatusLine` ·
  `sessionBusy`.
- 전제 1: `live.events` 소비처는 `session-runtime.ts` **3곳뿐**(`:174`·`:290`·`:342`) — A1 면적의 근거.
- 전제 2: `orphaned` 는 여전히 확정 가능(`confirm` 의 `open` 술어, `pending-message-queue.ts:250`).
- 전제 3: in-process 백그라운드 태스크는 서브프로세스와 함께 죽는다(0136 승계) — A2 트래커
  세대화의 근거.
- 전제 4: renderer pending id 정합은 `ids`(messageId)가 담당한다 — A2 의 attemptId 재발급 근거.
- **신규 의존성: 없음.**

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **0143** listen 대기 = 작업 중(inflight 지속) | `ChatTile.tsx:51-53` · `chatReducer.ts:92-96` | §B1 "애니메이션을 끄지 않는다" · §B2 | **유지 — 사용자 결정 ⑤.** 리뷰의 UI 분리 제안 미채택. 대신 유령 listen 제거로 "근거 없는 지속" 을 없앤다 |
| **0067** "uuid 보존 = renderer pending id 정합" | `pending-message-queue.ts:328-332` 주석 | §A2 "정합은 `ids` 가 담당한다" | **정밀화** — 정합 주체를 `ids`(messageId)로 명시하고 wire uuid(attemptId)는 시도마다 갱신. 정합은 그대로 유지된다 |
| 0154 "재주입도 폐기도 아닌 기다림" / "orphaned 는 폐기 대상 아님" | `chat-turn.ts:920-936` · `pending-message-queue.ts:294-305` | §A2·AC8 | **유지** — 강등은 폐기가 아니다 |
| 0151 "잔여는 교집합만 / 처분은 사용자 선택" | `interrupt-reconcile.ts:1-16` | §A2·A3 | **유지** — 판정 규칙·선택지 불변, *유효 범위*와 *파생 시점*만 정한다 |
| 0136 릴리즈 밸브 no-op 규칙 | `session-runtime.ts:416-418` | §B1 "현행 유지" | **유지** — 밸브 미변경 |
| 0153 send admission(`inflight‖listening‖pendingCount`) | `sendAdmission.ts:15-24` | §B1·AC20 | **유지** — `sessionBusy` 정의 불변 |
| 0067 "unframed 는 무손실 이월" | `session-runtime.ts:330-332` | §A1 | **유지·정밀화** — 이월은 유지하되 메시지 꼬리가 섞이지 않게 한다 |
| main 레이어 DAG(feature 교차 금지) | `eslint.config.mjs` · `src/main/AGENTS.md` | §A2 "트래커는 channelId 를 주입받는다" · §A3 "컴포지션 루트가 구독해 발행" | **준수** |
| IPC variant 변경 시 `IPC_CONTRACT.md` 동시 갱신 | `docs/AGENTS.md` · `IPC_CONTRACT.md §6` | §B1 | **준수** — AC24 |

## 파생 UX / 엣지케이스

- **listen release 창의 즉시 재전송**: A2 가 attemptId 로 소유권을 가르므로 새 체인이 오염되지
  않는다(AC7).
- **취소 직후 즉시 재전송**: A1 이 result 배치를 통째로 드레인에 걸어 다음 턴이 오염되지 않는다.
- **중단했는데 result 가 영영 안 오는 경우**: 채널 사망 → `finishPump` 가 세대를 올려 영수증·
  트래커 잔류가 함께 무효화된다.
- **취소 + 백그라운드 태스크 병존**: 예약만 강등되고 태스크는 유지 → 애니메이션도 유지(0143),
  라벨이 "백그라운드 작업 N건 대기 중" 으로 이유를 말한다.
- **잔여 경고 중 세션 전체 중단**: A3 의 open 확장으로 강등분도 폐기되고 draft 복원된다.
  `chat.residual{0}` 은 renderer 에서 멱등(`chatStore.ts:476-483`).
- **창 종료/renderer 소멸**: 라우팅 타이머가 없어 정리 대상이 없다. 표시 계층 타이머는 컴포넌트
  언마운트로 정리된다.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| A1 이 프레임 모델의 핵심 경로를 바꾼다 | 소비처 3곳·생산자 2곳으로 면적이 실측 확정. 배치 라우팅은 순수 단위 테스트 대상이고, 세대 검사(AC3)가 잘못된 배치를 폐기해 실패 모드가 "조용한 오염" 이 아니라 "명시적 폐기" 가 된다 |
| A2 가 wire uuid 를 바꾼다 — 지각 echo 매칭이 깨질 수 있다 | 지각 echo 는 **죽은 채널 소속**이라 애초에 도달하지 않는다(채널이 죽으면 스트림도 끝난다). 산 채널의 echo 는 같은 attemptId 다. AC8(지각 echo 확정)·AC22(구 attempt 무시)를 **양쪽 다** 잠근다 |
| A2 트래커 세대화가 **살아 있는 태스크를 지울** 수 있다 | AC13(같은 세대 유지)을 양성 단언으로 잠근다. 세대는 채널 교체 시에만 증가하고, 채널이 죽으면 in-process 태스크도 죽는다(전제 3) |
| A3 의 mutation 알림이 **발행 폭풍**을 낼 수 있다 | 값이 바뀔 때만 발행(AC18). 잔여는 정수 1개라 비교가 싸다 |
| 0143 유지의 귀결 — 진짜 통지 유실 시 애니메이션 지속 | **사용자 결정 ⑤의 명시적 귀결**로 문서화. 라벨·개수·중단 버튼으로 항해 가능. 검증은 AC21(유령 근거 없음 → 정지)로 판정하며, 나중에 UI 분리를 채택하면 `sessionBusy` 한 줄로 전환된다 |
| 스테이지 A/B 를 한 PR 로 묶으면 diff 가 커진다 | 스테이지 경계를 커밋 단위로 유지(A → B 순), verify 는 스테이지별 AC 그룹으로 대조 |

- 되돌리기 어려운 결정: `chat.listen` 스냅샷 필드(공개 IPC variant) — additive 로 두고
  `IPC_CONTRACT.md` 동시 기재. i18n 키 이름도 이번에 확정.
- **단독 결정 금지 항목(Open Question)**: 없음(결정 ⑤·⑥ 으로 해소).

## 영향 받는 파일

**스테이지 A**
- `app/src/main/adapters/types.ts` — `ProviderBatch` · `LiveTurn.eventBatches`(계약)
- `app/src/main/adapters/claude.ts` · `mock.ts` — 배치 생산(우회로 없음)
- `app/src/main/features/sessions/session-runtime.ts` — `routeBatch` · `channelId` 발급/검사
- `app/src/main/features/chat/pending-message-queue.ts` — `SubmissionIdentity` ·
  `survivedInterrupt` · 파생 selector · mutation 알림 · `discardSubmitted` open 확장
- `app/src/main/features/chat/background-tasks.ts` — channelId 스코프
- `app/src/main/app/chat-turn.ts` — chainId 발급 · identity 강등 · 큐 변경 구독 → 잔여 발행

**스테이지 B**
- `app/src/shared/ipc.ts` — `chat.listen` 스냅샷(additive)
- `app/src/main/app/chat-turn.ts` — 스냅샷 발행(값 변화 시)
- renderer — `chatReducer.ts`(스냅샷 수용) · `chatStore.ts`(**`sessionBusy` 불변**) ·
  `PendingAssistant.tsx` · `StatusLine.tsx` · `shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md` — `chat.listen` 행

**변경 없음**: `features/chat/post-turn.ts` (r1 의 `isUnconfirmedGraceListen`·`UNCONFIRMED_GRACE_MS`
폐기 — 라우팅 타이머 0)

## 참고 문서

- `docs/arch/backend/adapters.md` · `docs/arch/backend/observability.md`
- `docs/IPC_CONTRACT.md` §2/§3 — **`chat.listen` variant 변경 동시 갱신 필수**(§6 절차)
- `docs/handoff/0154-…` · `0151-…` · `0143` · `0136` · `0153` · `0067`

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed
  (196 files)** + node:test **28 pass**.
- 신규 테스트: session-runtime 6 · pending-message-queue 7 · background-tasks 2 · 어댑터 2 ·
  chat-turn harness 6 · renderer 2.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 4건 + **사용자 결정 2건**(0143 유지·2 스테이지)을 인용, 추론은 표기
- [x] 자료조사 — r3 신규 5행 + r2 계승 15행, 전부 `파일:라인`. **인용 앵커를 직접 열어 확인**
- [x] 의존 기술 — 전제 4건, 신규 의존성 0
- [x] 파생 UX — listen release 창·취소 직후 재전송·채널 사망·태스크 병존·세션 중단·창 종료 6건
- [x] 리스크 — 6건 + 완화책, Open Question 0
- [x] 요구 비판적 검토 5질문 — **전제 3차 정정**(r2 가 만든 ABA 를 자기 결함으로 기록)하고도 요구 범위를 줄이지 않았다
- [x] `검증 수단` 공란 0 — AC 24건 중 21건 `파일::케이스`, AC5·AC19 사람 실기(절차 명시), AC24 문서 대조
- [x] 부정형/"불변" 기준 0개 — AC2·AC3·AC7·AC10·AC18·AC22 는 "드랍되고 …가 false 로 남는다"·"폐기된다"·"submitted 로 남는다"·"재발행되지 않는다"·"무시된다" 로 **관측 가능한 상태**를 단언
- [x] AC 간 모순 없음 — 짝 확인: AC8↔AC22(같은 attempt 의 지각 echo 는 확정 / 다른 attempt 는 무시) · AC12↔AC13(세대 무효화 vs 과잉 삭제) · AC6↔AC7(자기 시도 vs 타 시도) · AC17↔AC18(변화 시 발행 vs 동일 값 미발행) · AC19↔AC21(근거 있으면 유지 / 없으면 정지) · AC20 이 0143·0153 보존을 잠근다
- [x] 인용 수치 직접 측정 — SDK subtype 4·`TerminalReason` 19·task 제어 2메서드는 설치본 `sdk.d.ts`, 호출점 전수(`orphanUnconfirmed` 2 · `live.events` 3 · 생산자 2 · `teardownChannel` 3)는 `rg`, 영수증 지연 6.06초는 로그 타임스탬프 차, 게이트 기준선은 이번 세션 실행
- [x] 신규 모듈 테스트 방법 — 6항목 전부. electron 의존은 **기존 harness seam**, channelId 는 **주입**이라 순수 테스트 가능
- [x] 전수 조사 N — `orphanUnconfirmed` **2** · `live.events` 소비처 **3** · 생산자 **2** · `teardownChannel()` **3** · SDK result subtype **4** · `TerminalReason` **19**
- [x] 각 AC 에 프로덕션 도달 경로 — 유일한 호출자가 테스트인 AC 0개
- [x] "사람 실기" AC(5·19)에 실행 경로가 있고 비범위에 막혀 있지 않다
- [x] 선택적 필드 미지정 케이스 — `eventBatches` 를 **선택적 우회로가 아닌 계약**으로 규정했으므로 미지정 케이스 자체를 없앴다(AC23 이 mock 준수를 잠근다). `terminal_reason` 은 optional 이라 **판정에 쓰지 않기로** 결정하고 근거를 기록
- [x] 소비 계약의 제약 필드 강제 지점 — 세대(누가 발급·누가 검사)·시도/체인(누가 발급·강등 조건)·배치 경계(누가 terminal 전이를 적용)·잔여(누가 파생·언제 발행)를 §A1~A3 에 명시
- [x] 참조 구현 전수 커버리지 — `SDKResultError.subtype` 4멤버가 모두 같은 분기를 타므로 A1 이 전수 커버
- [x] 미룬 항목 일방향 여부 — 3건 답변. **UI 분리는 selector 한 줄로 전환 가능**하도록 스냅샷에 필드를 미리 싣는다. i18n 키는 이번에 확정
- [x] 관문 4 를 본문 완성 후 실행 — 기존 결정 표 9행을 본문 문장 인용으로 채웠고, 인용 경로를 실제로 열어 확인
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

**스테이지 A**
- [ ] A1 ProviderBatch 라우팅 (claude·mock·session-runtime)
- [ ] A2 SubmissionIdentity (큐·영수증·트래커 세대화)
- [ ] A3 잔여 파생 + mutation 알림 + `discardSubmitted` open 확장

**스테이지 B**
- [ ] B1 활동 스냅샷(값 변화 시 발행) + `IPC_CONTRACT.md`
- [ ] B2 유령 listen 제거 확인(AC21) + StatusLine 라벨·i18n 키

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
| D1 | ②-a 의 실제 판정 입력이 실기 로그로 확정되지 않았다 | r2 자체 검토(r1 원인 귀속 철회) | r3 는 유령 근거 2종을 각각 제거하고 AC21 로 최종 상태를 단언한다. 재현 시에도 남으면 활동 스냅샷의 `reason`/`backgroundTaskCount` 가 입력을 가린다 | open |
| D2 | 진짜 백그라운드 통지 유실 시 애니메이션 지속(0143 유지의 귀결) | 사용자 결정 ⑤ | 라벨·개수·중단 버튼으로 항해. UI 분리 채택 시 `sessionBusy` 한 줄 전환 | 결정됨(유지) |
