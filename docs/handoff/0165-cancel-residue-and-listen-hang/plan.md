# Plan — 0165-cancel-residue-and-listen-hang (r6 · 범위 축소)

> **개정 이력**
> - **r1** 증상 3개 ↔ 점 수정 3개 → 리뷰 P1 3건.
> - **r2** 구조(경계·세대·소유) 전환 → 리뷰 P1 3건(1건은 r2 가 만든 uuid ABA).
> - **r3** identity·큐 파생·멱등 스냅샷 → 리뷰 P1 3건(체인 중첩·토큰 결합 시점·breaking).
> - **r4** 체인 lease·제출 트랜잭션 → 리뷰 P1 3건(nullable child·`all()`·steer push 미포괄).
> - **r5** 세션 제어 권위·제출 포트 → 리뷰 **24건**(P1 15 / P2 8 / P3 1).
> - **r6 (본 문서)** — 사용자 결정으로 **3개 핸드오프로 분할**한다. 본 문서는 **보고된 증상에
>   직결되고 `features/sessions`·큐 내부에서 닫히는 것만** 남긴다. 소유권 lease → **0166**,
>   활동 스냅샷·대기 UX → **0167**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0165-cancel-residue-and-listen-hang` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 (r1 → r6) |
| 상태 | r6 DRAFT → **READY** |
| 후속 | **0166**(세션 소유권 lease) · **0167**(활동 스냅샷·대기 UX) — 본 문서가 이월한 항목 소유 |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "첫 취소에서 어시스턴트의 **에러 메시지 버블 노출**. 이후 delta 도착 시작하자 삭제 후 delta 출력" | 라이브 세션 + 첨부 `orcacancelresendanalysis.md` §1 |
| 명시 요구 ② | "마지막 어시스턴트 답변 이후 **inflight 애니메이션 지속** + **'중단했지만 대기 중인 메시지가 남아 있습니다'** 표기" | 동상 + 첨부 §2 |
| 명시 요구 ③ | "**구조적 결함을 반드시 극복하되 사용자 경험을 해치지 말 것**" (반복 지시) | 라이브 세션 ×3 |
| 명시 요구 ④ | "**이 작업의 목적은 핸드오프 문서 작성까지만이다**" | 라이브 세션 |
| 명시 요구 ⑤ | "**지금까지의 제안 및 피드백에 대해 비판적 검토를 하라**" — 리뷰도 무비판 수용 금지 | 라이브 세션 ×2 |
| 사용자 결정 ⑥ | 0143(listen 대기 = inflight 지속) **유지 — 라벨만 추가** | 라이브 세션 |
| **사용자 결정 ⑦** | **3개 핸드오프로 분할** | 라이브 세션 (r5 리뷰 후) |
| **사용자 결정 ⑧** | ②-a 는 **0165 에 최소분만**(체인 종료 강등 + 판정 입력 로깅), 나머지는 0166/0167 | 동상 |

## Context (왜)

실기 세션 `8f6ad70c` 의 취소→재전송에서 세 증상이 났고 로그에는 `error`/`warn` 이 0건이다 —
정상 경로의 오판이라 관측 없이 UI 만 틀어진다.

설계가 5라운드를 돌며 **결함의 범위가 계속 바깥으로 확장**됐다(큐 → 이벤트 경계 → 채널 세대 →
체인 소유권 → 세션 제어 권위). 5라운드 리뷰 24건을 한 문서에 담으면 AC 38→60+ 로 늘고
**소유권·제출·UI 상태를 동시에 재작성**하는 단일 변경이 된다 — 저장소 규칙이 경고하는 FAIL 루프의
전형이다. 그래서 **의존이 끊기는 지점에서 셋으로 자르고**, 본 문서는 사용자가 보고한 증상에
직결되며 **레이어 경계를 넘지 않는** 조각만 갖는다.

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **①은 원인이 확정**됐다(아래 F-A). **②-b 는 오탐 원인이 확정**됐다(죽은 채널의 지각 영수증). **②-a 는 원인 미확정**이다 — r1 의 귀속(`haveUnconfirmed`)은 반증됐고, 남은 후보(예약 잔류 / 트래커 잔류)를 로그로 가릴 수 없다. 그래서 본 문서는 **증명된 것만 고치고**, ②-a 는 *증명된 한 조각*(체인 종료 강등)과 *판정 입력 관측*만 담는다 | `turn-coordinator.ts:232-236`, `:283-289` · 첨부 §2-1 |
| 이미 있는 것 아닌가 | 아니다. 다만 **`takeForRespawn` 의 "uuid 보존"**(0067)이 함정이었다 — pending id 정합은 실제로 `ids` 가 담당하는데 wire uuid 까지 보존해 **죽은 채널의 영수증이 산 배치와 교집합**을 만든다 | `pending-message-queue.ts:328-354` · `chat-turn.ts:1096`, `:1120` |
| 더 작은 해법이 있는가 | **이 문서가 그 답이다.** 5라운드 동안 매번 "한 겹 더 바깥" 을 고치려다 문서가 비대해졌다. 분할 후 본 문서는 **신규 모듈 0개, 레이어 경계 무변경, 포트 신설 0개** 로 줄었다 | §설계 |
| **인용 자료(리뷰)가 요구를 부풀리지 않았나** (요구 ⑤) | **5라운드 전부 검증했다.** 3차 1건은 **등급 하향**(버전 스큐 근거가 패키징 앱에 성립하지 않음), 5차 1건은 **정정**(P1-6 은 현행 결함이 아님 — 아래), 5차 제안 3건은 **미채택**(근거 기재). 나머지는 수용해 셋으로 분산 | §외부 리뷰 처리 |
| 기존 채택 결정을 뒤집는가 | **0건.** 0143 유지(결정 ⑥) · 0067 정밀화 · 0154/0151/0136/0153 유지 | §기존 결정 표 |

- **사용자에게 올릴 것**: 없음(결정 ⑥·⑦·⑧ 로 해소).

## 자료조사 (Research)

> 인용 라인은 이번 세션에서 직접 열어 확인했다. SDK 는 `npm ci` 로 설치한 `0.3.220` 실물.

### 본 문서 범위의 확정 사실

| 발견 | 레퍼런스 |
|---|---|
| 한 SDK 메시지가 N개 이벤트로 분해된다 | `claude-map.ts:1-8` |
| **실패·취소 result 는 terminal 을 2개 낸다** — `[telemetry, error]`. `SDKResultError.subtype` **4멤버** 전부 같은 분기 | `claude-map.ts:474-486` · `sdk.d.ts:4269-4271` |
| `error_during_execution` = "API 실패 **또는 취소된 요청**" | `docs/spec/claude/agent-sdk/agent-loop.md:274` |
| `terminal_reason`(19멤버)은 **optional** → 취소 판별에 쓰지 않는다 | `sdk.d.ts:4282`, `:6909` |
| **`routeEvent` 가 첫 terminal 에서 프레임을 닫아** 두 번째가 `unframed` 로 샌다 | `session-runtime.ts:354-380`(프레임 분기 `:368-377`, unframed `:379`) |
| `openFrame()` 이 `unframed` 를 새 프레임 **앞에 합류**시킨다(소속 라벨 없음) | `session-runtime.ts:328-335` |
| `teardownChannel()` 이 `unframed` 를 비운다 → "첫 취소에서만" 인 이유 | `session-runtime.ts:446` · 첨부 §3 |
| renderer 는 `error` 로 배너를 띄우고 `BEGIN_TURN` 에서 지운다 + **DB 에도 error 파트로 영속** | `chatReducer.ts:546-556`, `:297-309` · `writer.ts:276-285` |
| **중단 영수증 실측 지연 6.06초**(02:12:04.142 발행 → 02:12:10.202 수신), 그 사이 respawn(02:12:06.989) | 첨부 §2-2/§3 · `session-runtime.ts:485-504` |
| `takeForRespawn` 은 미확정 배치를 **uuid 보존 재주입** → 죽은 큐 영수증과 교집합이 생긴다 | `pending-message-queue.ts:333-354` |
| **`reserveHeld` 는 여러 사용자 메시지를 `ids: string[]` 한 배치로 병합**한다 — identity 는 배치 단위여야 한다 | `pending-message-queue.ts` `toBatch`/`reserveHeld` |
| `discardSubmitted` 는 `submitted` 만 매칭 → 강등분이 폐기되지 않는다 | `pending-message-queue.ts:309-312` |
| 배치가 큐를 떠나는 실제 지점은 `commitConsumed → drainConfirmed` | `turn-coordinator.ts:167-187` |
| `orphanUnconfirmed` 호출점 **전수 2곳**, 둘 다 턴-후 루프 안(조건 `!aborted`) → 취소·stall 로 끝난 체인은 도달하지 않는다 | `chat-turn.ts:939`, `:951` |
| **coordinator 는 `eventsReceived===0` 이면 같은 요청을 최대 2회 재전송**하고 `turnOpenUuids` 는 retry 루프 **밖**에서 1회 계산된다 | `turn-coordinator.ts:232-236`, `:283-296` |
| `live.events` 소비처 **3곳**(전부 `session-runtime.ts`), 생산자 **2곳** | `:174`, `:290`, `:342` / `claude.ts`·`mock.ts` |
| `consumeTurnScoped`(mock/oneshot)는 pump 를 쓰지 않는다 — 배치 경로가 따로 필요하다 | `session-runtime.ts:287-309` |
| 게이트 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed (196 files)** + node:test **28 pass** | 이번 세션 실행 |

### 이월한 사실 (0166/0167 문서가 인용)

동시 전송 2건의 이중 체인·이중 런타임(`chat-turn.ts:394`↔`:552` 사이 `await`) · 재시작 게이트와
shutdown 이 `all()` 로 판정 · 제어 상태가 `freshTurnLocalState()` 로 턴마다 리셋 · steer push 가
어댑터에 있음 · `settleTrackedTasks` 의 ids 의존 → **0166**. 스냅샷 소스·broadcast·hydrate →
**0167**.

## 구조적 결함 — 본 문서가 닫는 것

> 공통 주제는 **"소속 없는 신호"** 다. 본 문서는 그중 **메시지 경계**와 **채널 세대**를 세운다.

| # | 발현 | 보고 증상 | 처방 |
|---|---|---|---|
| **F-A** | 프레임 경계 ≠ provider 메시지 경계 → 메시지 꼬리가 `unframed` 로 새어 **다음 턴에 재귀속** | ① (+ 실제 API 실패도 동일) | **A** |
| **F-C′** | 중단 영수증이 **어느 채널의 큐를 가리키는지** 표현이 없다 → 죽은 큐로 잔여 오탐 | ②-b 오탐 | **B** |
| **F-D** | 파생 가능한 사실(잔여)을 **별도 Map 으로 복제**하고 갱신 시점을 놓친다 | ②-b 고착 | **C** |
| **F-B′** | 취소·stall 로 끝난 체인이 예약을 `submitted` 로 방치 → 이후 무관한 턴이 유예 listen 을 연다 | ②-a **일부** | **D** |

**이월**: F-E(세션 소유권), F-F(turn-local 제어 상태), F-G(제출 경로 이원화) → **0166**.
표시·관측 계층 → **0167**.

## 외부 리뷰 처리 (5라운드 · 24건)

| 라운드 | 지적 | 처리 |
|---|---|---|
| 1차 | teardown 잔여 은폐 / 라우팅 타이머 오귀속 / 세션 단위 강등 | 큐 파생(C) · **라우팅 타이머 0** · attempt 스코프(D) |
| 2차 | uuid 소유권 ABA / 잔여 파생 시점 / listen 신호 1회성 | D(attempt) · C · **0167** |
| 3차 | 체인 중첩 / 토큰 결합 시점 / `chat.listen` breaking | **0166** · B · **0167** |
| 4차 | nullable child / `all()` / steer push 미포괄 | **0166** ×3 |
| 5차 | 24건 | 아래 매핑 |

### 5차 24건 매핑

| 항목 | 착지 |
|---|---|
| **P1-4** 배치 단위 identity(`messageIds[]`) · **P1-5** channel incarnation token · **P1-7** retry↔attempt 규칙 · **P2-16** turn-scoped 토큰 · **P2-19** count 단위 · **P2-21** mutation 경계 전수 · **P2-22** 취소 버블 프로덕션 테스트 · **P3-24** PR 상태 표기 | **0165 (본 문서)** |
| P1-1 Preparing 상태머신 · P1-2 leaseId 해제·반납 순서 · P1-3 포트 2종/DAG · P1-6 expectedToken · P1-8 `retireChannel` 정착 · P1-9 gate refresh observer · P1-10 shutdown 순서 · P1-15 discard CAS · P2-17 population · P2-18 control 정리 | **0166** |
| P1-11 projector 4소스 · P1-12 broadcast/viewer · P1-13 hydrate·revision · P1-14 transport⊥residual · P2-20 lastActivityAt↔dedupe · P2-23 대기 UX 상세 | **0167** |

### **정정 — P1-6 은 현행 결함이 아니다** (요구 ⑤)

리뷰는 "이전 채널의 지각 PostToolBatch 훅이 **새 채널 stdin 에** 오래된 steer 를 밀어 넣는다" 고
했다. 코드상 **불가능**하다 — `input` 은 `sendMessage` 마다(= spawn 마다) 생성되고(`claude.ts:327`)
훅 클로저가 **그 채널의 input** 을 캡처한다(`:393-397`). 지각 훅은 자기 채널의 닫힌 스트림에 push 해
`false` 를 받고 롤백된다(`claude-adapt.ts:157-162`).

**다만 지적의 실질은 유효하다** — **0166 이 push 를 Runtime(`submitSteer`)으로 옮기는 순간**
클로저가 `this.live`(현재 채널)를 읽게 되어 그때 비로소 이 위험이 생긴다. 따라서 0166 의
`submitSteer` 는 **생성 시점 expectedToken 을 캡처**해야 한다 — 0166 의 필수 설계 요구사항으로 이관.

### 5차 제안 중 **미채택 3건**

| 제안 | 판단 | 근거 |
|---|---|---|
| CAS 실패 시 **채널 폐기** | 미채택 | 순서가 `CAS → push` 이므로 CAS 실패 시점엔 **아직 push 하지 않았다**. 되돌릴 것이 없는데 백그라운드까지 죽이는 최대 비용 행위를 쓰면 순손실 |
| 결합 전 도착 이벤트 **공개 게이트** | 미채택 | 토큰은 **push 전에** 발급되므로 그 사이 이벤트도 이미 올바른 세대로 라우팅된다. `Frame` 이 이미 버퍼링한다 — 상태만 하나 늘린다 |
| `providerBinding.model`·`settingsRevision` 복제 | 미채택 | runtime 이 이미 권위(`spawnedModel`·`spawnedProviderSettings`)이고 `decideRespawn` 이 그걸로 판정한다 — 두 번째 사본 금지 |

## 설계

### 원칙

> ① **소속을 붙인다** — 메시지 경계 · 채널 세대 · 시도(attempt).
> ② **시간은 표시 계층에서만** — 라우팅(프레임·드레인·큐)에 타이머 0.
> ③ **상태는 사실에서 파생하고, 사실이 바뀌는 순간 발행한다** — 별도 Map 복제 금지.

### A. 메시지-원자 배치 라우팅 (F-A)

**불변식: 한 provider 메시지의 이벤트는 전부 같은 목적지로 간다(프레임 / 드랍 / unframed).**

- `LiveTurn.eventBatches: AsyncIterable<ProviderMessageBatch>`,
  `ProviderMessageBatch = { sequence: number; events: NormalizedEvent[] }`.
  **선택적 우회로가 아니라 계약** — 다중 이벤트를 내는 어댑터는 반드시 한 배치로, 단일 이벤트만
  내는 어댑터(mock)도 1-이벤트 배치로. 두 경로를 남기지 않는다.
- `claude.ts` 의 `events()` 는 이미 `claudeToNormalized()` **배열**을 `yield*` 로 펴고 있다 —
  펴지 않고 배치째 내보낸다. `drainCompactSummaries` 산출물은 같은 배치 뒤에 이어 붙여 순서 보존.
- `routeEvent` → `routeBatch(token, batch)`: 배치 전 이벤트를 한 목적지로 보낸 **뒤** terminal
  전이(프레임 닫기·draining 종료·`cliBusy` 해제)를 적용한다.
- **`consumeTurnScoped`(mock/oneshot)도 같은 경로**를 탄다(P2-16).
- 효과: **① 소멸 + 실제 실패 result 의 일반 누출 동시 소멸.** 새 가변 상태 0.

### B. Channel incarnation token (F-C′)

- `SessionRuntime` 내부에 **채널 화신(incarnation) 토큰**을 둔다. **`ensureChannel()` 이 기존
  토큰을 반환**하고 **spawn/respawn 때만 새로 발급**한다(P1-5 — "제출마다 발급" 은 r5 의 오류였다.
  그러면 두 번째 steer 이후 정상 이벤트가 전부 stale 로 폐기된다).
- 용도 2가지: ⓐ `routeBatch` 세대 검사(구 채널 잔여 폐기) ⓑ **중단 영수증 정합** — `markAborted`
  가 발행 시점 토큰을 캡처하고, resolve 시 토큰이 같을 때만 `onInterruptReceipt` 로 올린다.
  → 죽은 큐 기준 잔여 오탐(②-b) 소멸.
- 토큰은 **`features/sessions` 내부에 머문다** — 레이어 경계를 넘지 않는다(포트 신설 0).

### C. 잔여를 큐의 즉시 파생값으로 (F-D)

- `residualBySession` Map **폐기**. 배치에 사실만 표시: `TrackedBatch.survivedInterrupt: boolean`.
- 파생(순수): `residualMessageCount = open(batches).filter(survivedInterrupt).sum(ids.length)`
  (open = `submitted | orphaned`). **사용자에게 보이는 수는 메시지 수**로 통일한다(P2-19 —
  배치 수로 세면 3건 flush 시 3→1 로 줄어 "사라졌다" 로 보인다).
- **큐의 모든 전이가 단일 mutation 경계를 지나고 전이 직후 변경을 알린다** — 전수:
  `enqueue`·`cancel`·`cancelAllHeld`·`reserveHeld`·`reserveItem`·`rollback`·`confirm`·
  `drainConfirmed`·`orphanUnconfirmed`·`discardSubmitted`·`rekey`·`takeForRespawn`·`freeze`·
  `dispose`·`disposeAll` (P2-21). 큐는 IPC 를 모르므로 **컴포지션 루트가 구독해 발행**한다.
- `discardSubmitted` 를 **open(submitted|orphaned) 매칭**으로 확장 — 강등이 늘어난 대가를 상쇄한다
  (빼면 잔여 Notice 의 유일한 조치가 조용히 무력화).
- **한계 명시**: 발행 대상은 **그 체인의 owner**다. **체인 종료 후 도착한 변경의 발행은 0167**
  (broadcast/viewer 계약 필요).

### D. attempt 스코프 강등 + retry 규칙 (F-B′ · ②-a 최소분)

- 배치 identity 를 **배치 단위**로 둔다(P1-4):
  `SubmissionAttempt { messageIds: string[]; attemptId: string; chainId: string; origin }`.
  `attemptId` 는 **재제출마다** 새로 발급하고 wire uuid 로 쓴다. `takeForRespawn` 은
  `messageIds`·`survivedInterrupt` 를 보존하고 `attemptId` 를 **재발급**한다.
  (0067 의 "uuid 보존 = pending id 정합" 은 실제로 **`ids`(messageIds)가 담당**하므로 정합은 유지된다.)
- 체인 종료 `finally` 에서 **`(attemptId, chainId)` 일치분만** `orphaned` 로 강등한다 — 취소·stall·
  throw 전 경로를 덮으면서, 지각한 이전 체인이 새 시도를 건드리지 못한다(ABA 차단).
- **retry 규칙**(P1-7 — coordinator 는 `eventsReceived===0` 이면 같은 요청을 최대 2회 재전송한다):
  - push **전** 실패(예약 거부·채널 부재) → 안전 재시도, 같은 attempt 유지.
  - push 가 **명시적으로 거절**(`push()` false) → 롤백 후 **새 attemptId** 로 재시도.
  - **push 성공 후 이벤트 0건 → 자동 재전송 금지**(수용 여부 불명 — 중복 도구 실행 위험).
    이 경우 retry 를 중단하고 기존 실패 경로(에러 이벤트)로 마감한다.
  - 재전송 시 `turnOpenUuids`(확정 대상)도 새 attemptId 로 **함께 교체**한다.

### E. 관측 — ②-a 원인 확정 수단

- listen/flush 개시 시 `chat.postturn.step` 에 `step` + 판정 입력 5종(`havePending`·`haveTasks`·
  `haveUnconfirmed`·`channelBusy`·`hasBacklog`) + `taskCount`·`pendingMessageCount` 를 남긴다.
  **카운트·불리언만**(원문 금지 — `observability.md` 원칙).
- 이 레코드가 다음 재현에서 ②-a 의 실제 입력을 가른다(D1).

| 신규 모듈 / 확장 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `ProviderMessageBatch` + `LiveTurn.eventBatches` | 메시지-원자 계약 | adapters | 어댑터 단위(claude·mock) |
| `SessionRuntime.routeBatch` · incarnation token · `ensureChannel()` | 배치 라우팅 · 세대 | features/sessions | 순수 단위 — 기존 fake live 채널 harness |
| `SubmissionAttempt` · `survivedInterrupt` · 파생 selector · mutation 알림 · `discardSubmitted` 확장 | 예약 수명 · 잔여 진실 | features/chat | 순수 단위 — `pending-message-queue.test.ts` |
| 체인 종료 강등 · 큐 구독 발행 · `chat.postturn.step` | 배선 | app | **기존 harness seam** — 신규 `chat-turn.cancel-residue.test.ts` |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 실패 result 가 만든 `[telemetry, error]` **두 이벤트가 같은 프레임으로 배달**된다 | `session-runtime.test.ts::"실패 result 배치는 같은 프레임으로 전부 배달된다"` | CLI result → `eventBatches` → `routeBatch` → `consumeFrame` |
| 2 | 취소 draining 중 도착한 result 배치는 **전부 드랍되고 `hasUnframedBacklog` 가 false 로 남는다** | `session-runtime.test.ts::"취소 draining 중 배치는 통째로 드랍된다"` | `chat:cancel` → `markAborted` → `routeBatch` |
| 3 | **이전 세대(토큰)의 배치는 통째로 폐기**된다 | `session-runtime.test.ts::"세대 불일치 배치는 라우팅되지 않는다"` | respawn 직후 구 채널 잔여 |
| 4 | `ensureChannel()` 은 **채널이 살아 있으면 같은 토큰을 반환**하고 spawn/respawn 때만 새 토큰을 낸다 | `session-runtime.test.ts::"토큰은 채널 화신 단위다"` | 연속 steer/턴 |
| 5 | claude 어댑터가 **한 SDK 메시지 = 한 배치**로 낸다 | `adapters/claude.eventbatches.test.ts::"한 SDK 메시지 = 한 배치"` | `ClaudeAdapter.sendMessage` |
| 6 | **mock 어댑터도 배치 계약을 지키고 `consumeTurnScoped` 도 같은 경로**를 탄다 | `adapters/mock.test.ts::"mock 도 배치로 낸다"` · `session-runtime.test.ts::"turn-scoped 소비도 배치 라우팅을 쓴다"` | dev mock 백엔드 |
| 7 | **채널이 교체된 뒤 도착한 중단 영수증은 잔여 판정에 반영되지 않는다** | `session-runtime.test.ts::"세대 불일치 영수증은 폐기된다"` | `markAborted` → `interrupt()` promise |
| 8 | **같은 세대**의 영수증은 그대로 반영된다 | `session-runtime.test.ts::"같은 세대의 영수증은 배달된다"` | 동 7 |
| 9 | `residualMessageCount` 는 **open(submitted+orphaned) 중 `survivedInterrupt` 인 배치의 `ids` 합**이다(메시지 수) | `pending-message-queue.test.ts::"잔여 파생은 메시지 수로 센다"` | 잔여 Notice |
| 10 | **큐 전이 15종 전수**가 mutation 경계를 지나 변경을 알린다 | `pending-message-queue.test.ts::"모든 전이가 변경을 알린다"` | 큐 전 경로 |
| 11 | 잔여 배치가 커밋되는 **그 순간**(체인 진행 중) `chat.residual` 이 갱신 발행된다 | `chat-turn.cancel-residue.test.ts::"drain 직후 잔여가 갱신 발행된다"` | `commitConsumed` → `drainConfirmed` → 구독 |
| 12 | **respawn 재주입 후에도 `survivedInterrupt` 가 보존**되어 잔여 수가 유지된다 | `pending-message-queue.test.ts::"takeForRespawn 은 survivedInterrupt 를 보존한다"` | respawn |
| 13 | "세션 전체 중단" 이 **`orphaned` 배치도 폐기**해 텍스트를 draft 로 되돌린다 | `pending-message-queue.test.ts::"discardSubmitted 는 open 상태를 폐기한다"` | 잔여 Notice → `chat:discardSession` |
| 14 | 취소로 끝난 턴 체인이 **`(attemptId, chainId)` 일치분만** `orphaned` 로 강등한다 | `chat-turn.cancel-residue.test.ts::"취소로 끝난 체인이 자기 시도만 강등한다"` · `pending-message-queue.test.ts::"attemptId 불일치 강등은 다른 시도를 건드리지 않는다"` | outer `finally` |
| 15 | `orphaned` 배치가 **지각 echo 로 `confirmed` 된다**(강등이 커밋을 잃게 하지 않는다) | `pending-message-queue.test.ts::"orphaned 배치도 지각 echo 로 확정된다"` | 늦은 CLI 픽업 |
| 16 | **push 성공 후 이벤트 0건이면 자동 재전송하지 않는다**(중복 실행 방지). push 거절이면 **새 attemptId** 로 재시도한다 | `turn-coordinator.test.ts::"push 성공 후 무이벤트는 재전송하지 않는다"` · `::"push 거절은 새 attempt 로 재시도한다"` | coordinator retry 루프 |
| 17 | listen/flush 개시 시 `chat.postturn.step` 이 **판정 입력 5종 + 개수 2종**을 남긴다(원문 0) | `chat-turn.cancel-residue.test.ts::"턴-후 판정 입력이 로그에 남는다"` | `~/.config/orca/logs/` JSONL |
| 18 | **취소 → 재전송 프로덕션 경로**에서 renderer 로 가는 `error` 이벤트 0건, history `error` 파트 0건, 다음 턴 첫 delta 정상 출력. **반복 취소에서도 동일** | `chat-turn.cancel-residue.test.ts::"취소 후 재전송에 에러 이벤트가 없다(반복 포함)"` | `chat:send`→`chat:cancel`→`chat:send` |
| 19 | 실기: ⓐ 에러 배너 부재 ⓑ 잔여 경고가 커밋 시 해제(체인 진행 중) ⓒ 재시작 후 error 카드 부재 | **사람 실기** — `cd app && npm run dev`, 아래 절차 | 앱 전체 |

### 사람 실기 절차 (AC19)

1. 전송 → 응답 중 **중단** → 재전송 → transcript 에 **에러 배너 없음**(①).
2. **중단을 3회 반복**해도 동일(반복 취소 — P2-22).
3. 잔여 경고가 떴다면, 그 메시지가 커밋되는 순간 **경고 즉시 해제**(체인 진행 중, ②-b).
4. 앱 재시작 후 같은 대화 → 답변 위에 **error 카드 없음**(① 영속 경로).

## 범위 / 비범위

- **범위**: 설계 A~E + AC 19건. **신규 모듈 0 · 신규 포트 0 · 레이어 경계 무변경 · IPC 채널 무변경**
  (`chat.residual` 은 기존 variant, count 의미만 "메시지 수" 로 문서화).
- **비범위(이월)**:

| 이월 항목 | 어디로 | 나중에 하면 더 비싼가 |
|---|---|---|
| 세션 소유권(이중 체인·이중 런타임) · 작업 중 업데이트 설치 · 종료 시 서브프로세스 잔존 · 서브에이전트 중단 열화 · 제출 포트 단일화 | **0166** | **아니오** — 본 문서와 파일이 거의 겹치지 않고(`supervisor`/`bootstrap` 대 `session-runtime`/큐), 본 문서의 토큰·attempt 가 오히려 0166 의 전제를 미리 세워준다 |
| 체인 종료 **후** 잔여 해제 · 활동 스냅샷 · 대기 라벨/접근성 | **0167** | **아니오** — IPC 는 additive 이고, 본 문서가 만든 큐 파생값이 그대로 스냅샷의 입력이 된다 |
| ②-a 의 근본 원인 규명 | 재현 로그(E) 후 결정 | **아니오** — 지금 특정 입력을 겨냥해 고치는 것이 r1 의 실패였다 |

## 의존 기술 / 전제

- 기댈 기존 모듈: `claudeToNormalized`(배열 반환) · `SessionRuntime` 프레임 모델 ·
  `PendingMessageQueue`(rollback 반쪽 존재) · `Frame` 버퍼 · `sendChatEvent`.
- 전제 1: `live.events` 소비처는 `session-runtime.ts` **3곳뿐** — A 의 면적 근거.
- 전제 2: `orphaned` 는 여전히 확정 가능(`confirm` 의 `open` 술어).
- 전제 3: renderer pending id 정합은 `ids`(messageIds)가 담당 — attemptId 재발급의 근거.
- 전제 4: 지각 echo 는 **죽은 채널 소속이라 도달하지 않는다**(채널이 죽으면 스트림도 끝난다).
- **신규 의존성: 없음.**

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **0143** listen 대기 = 작업 중 | `ChatTile.tsx:51-53` | (본 문서는 표시를 건드리지 않음) | **유지 — 결정 ⑥** |
| **0067** "uuid 보존 = renderer pending id 정합" | `pending-message-queue.ts:328-332` 주석 | §D "정합은 `ids` 가 담당한다" | **정밀화** — wire uuid(attemptId)는 재제출마다 갱신 |
| 0154 "재주입도 폐기도 아닌 기다림" | `chat-turn.ts:920-936` | §D · AC15 | **유지** — 강등은 폐기가 아니다 |
| 0151 "잔여는 교집합만 / 처분은 사용자 선택" | `interrupt-reconcile.ts:1-16` | §B·C | **유지** — 판정 규칙·선택지 불변, *영수증 유효 범위*와 *파생 시점*만 정한다 |
| 0136 릴리즈 밸브 · 0153 send admission | `session-runtime.ts:416-418` · `sendAdmission.ts:15-24` | (무변경) | **유지** |
| 0067 "unframed 는 무손실 이월" | `session-runtime.ts:330-332` | §A | **유지·정밀화** — 이월은 유지하되 메시지 꼬리가 섞이지 않게 |
| main 레이어 DAG | `eslint.config.mjs` · `src/main/AGENTS.md` | §B "토큰은 features/sessions 내부" · §C "컴포지션 루트가 구독" | **준수** — 신규 포트 0 |
| IPC variant 변경 시 `IPC_CONTRACT.md` 갱신 | `docs/AGENTS.md` §6 | §범위 "IPC 채널 무변경" | **해당 없음**(0167 에서 발생) |

## 파생 UX / 엣지케이스

- **취소 직후 즉시 재전송**: A 가 result 배치를 통째로 드레인에 걸어 다음 턴이 오염되지 않는다.
- **반복 취소**: teardown 이 `unframed` 를 비우므로 2·3번째는 원래 증상이 없었다 — AC18 이
  **반복까지** 포함해 회귀를 고정한다.
- **채널 사망**: 토큰이 무효화돼 영수증·구 배치가 함께 걸러진다.
- **강등 후 지각 echo**: `confirm` 의 `open` 술어가 orphaned 를 포함해 커밋이 유실되지 않는다(AC15).
- **"세션 전체 중단"**: open 확장으로 강등분도 폐기되고 draft 복원된다. 단 **active runtime 을
  못 죽이는 현행 한계는 0166 소관**(본 문서는 큐만 정리).

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| A 가 프레임 모델의 핵심 경로를 바꾼다 | 소비처 3곳·생산자 2곳으로 면적 실측 확정. 세대 검사(AC3)가 잘못된 배치를 **명시적으로 폐기**해 실패 모드가 "조용한 오염" 이 아니게 된다 |
| D 가 wire uuid 를 바꾼다 — 지각 echo 매칭 | 지각 echo 는 죽은 채널 소속이라 도달하지 않는다(전제 4). AC15(같은 시도 확정)로 정상 경로를 잠근다 |
| retry 규칙 변경이 **일시적 오류의 자동 복구를 약화**시킬 수 있다 | 약화되는 것은 **push 성공 후 무이벤트** 한 경우뿐이고, 그건 중복 도구 실행 위험이 더 크다(P1-7). push 전 실패의 재시도는 그대로 유지 |
| 큐 mutation 알림이 발행 폭풍을 낼 수 있다 | 값(정수)이 바뀔 때만 발행. 잔여는 정수 1개라 비교가 싸다 |
| 분할로 ②-a 가 이번에 안 닫힐 수 있다 | **의도된 결과**(결정 ⑧) — 원인이 미확정이라 E 로 관측을 먼저 세운다. 0166/0167 이 남은 후보를 각각 닫는다 |

- 되돌리기 어려운 결정: 없음(공개 계약·스키마·식별자 무변경).
- **Open Question**: 없음.

## 영향 받는 파일

- `app/src/main/adapters/types.ts` — `ProviderMessageBatch` · `LiveTurn.eventBatches`(계약)
- `app/src/main/adapters/claude.ts` · `mock.ts` — 배치 생산(우회로 0)
- `app/src/main/features/sessions/session-runtime.ts` — `routeBatch` · incarnation token ·
  `ensureChannel()` · 영수증 정합 · `consumeTurnScoped` 배치 경로
- `app/src/main/features/chat/pending-message-queue.ts` — `SubmissionAttempt`(`messageIds[]`) ·
  `survivedInterrupt` · 파생 selector · mutation 경계/알림 · `discardSubmitted` open 확장
- `app/src/main/features/chat/turn-coordinator.ts` — retry ↔ attempt 규칙 · `turnOpenUuids` 교체
- `app/src/main/app/chat-turn.ts` — chainId·attemptId 배선 · 체인 종료 강등 · 큐 구독 발행 ·
  `chat.postturn.step`
- **변경 없음**: `features/chat/post-turn.ts`(라우팅 타이머 0) · renderer · `docs/IPC_CONTRACT.md`

## 참고 문서

- `docs/arch/backend/adapters.md` · `docs/arch/backend/observability.md`
- 후속: `docs/handoff/0166-session-chain-lease/plan.md` · `0167-session-activity-projection/plan.md`
- 선행 결정: 0154 · 0151 · 0143 · 0136 · 0153 · 0067

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed
  (196 files)** + node:test **28 pass**.
- 신규 테스트: session-runtime 7 · pending-message-queue 7 · turn-coordinator 2 · 어댑터 2 ·
  chat-turn harness 4.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 5건 + 사용자 결정 3건 인용, 추론은 표기
- [x] 자료조사 — 본 범위 17행 전부 `파일:라인`, 앵커를 직접 열어 확인. 이월 사실은 별도 절로 분리
- [x] 의존 기술 — 전제 4건, 신규 의존성 0
- [x] 파생 UX — 취소 직후 재전송·반복 취소·채널 사망·지각 echo·세션 중단 5건
- [x] 리스크 — 5건 + 완화책, Open Question 0
- [x] **요구 ⑤(비판적 검토) 이행** — 5라운드 리뷰를 전부 검증: 1건 **등급 하향**, 1건 **정정**(P1-6 은 현행 결함 아님 — 근거 `claude.ts:327`), 제안 3건 **미채택**(근거 기재), 나머지는 셋으로 분산 매핑(누락 0)
- [x] `검증 수단` 공란 0 — AC 19건 중 18건 `파일::케이스`, 1건 사람 실기(절차 명시)
- [x] 부정형/"불변" 기준 0개 — AC2·AC3·AC7·AC16 은 "드랍되고 false 로 남는다"·"폐기된다"·"재전송하지 않는다" 로 **관측 가능한 상태**를 단언
- [x] AC 간 모순 없음 — 짝 확인: AC1↔AC2(프레임 생존 vs draining) · AC3↔AC4(세대 교체 시 폐기 / 같은 채널은 같은 토큰) · AC7↔AC8(불일치 폐기 / 일치 배달) · AC14↔AC15(강등 후에도 확정 가능) · AC13↔AC15(폐기 vs 확정 — 서로 다른 종착지) · AC16 두 절(무이벤트 금지 / 거절 시 새 attempt)
- [x] 인용 수치 직접 측정 — `live.events` 소비처 **3** · 생산자 **2** · `orphanUnconfirmed` 호출점 **2** · 큐 전이 **15종** · SDK subtype **4** · `TerminalReason` **19** · 영수증 지연 **6.06초** · 게이트 기준선 전부 이번 세션
- [x] 신규 모듈 테스트 방법 — 4항목 전부. electron 의존은 **기존 harness seam**
- [x] 전수 조사 N — 위 수치 + `teardownChannel()` **3**
- [x] 각 AC 에 프로덕션 도달 경로 — 유일한 호출자가 테스트인 AC 0개
- [x] "사람 실기" AC(19)에 4단계 절차가 있고 비범위에 막혀 있지 않다
- [x] 선택적 필드 미지정 케이스 — `eventBatches` 를 **계약**으로 규정해 미지정 케이스를 없앴다(AC6 이 mock·turn-scoped 준수를 잠근다). `terminal_reason` 은 optional 이라 판정에 쓰지 않는다(근거 기록)
- [x] 소비 계약의 제약 필드 강제 지점 — 토큰(누가 발급·누가 검사)·attempt(누가 발급·강등 조건)·배치 경계(누가 terminal 전이)·잔여(누가 파생·언제 발행)를 §A~D 에 명시
- [x] 미룬 항목 일방향 여부 — 3건 전부 "아니오" + 근거(파일 비중첩·additive IPC·원인 미확정)
- [x] 관문 4 를 본문 완성 후 실행 — 기존 결정 표 8행을 본문 문장 인용으로 채웠고 인용 경로를 열어 확인
- [x] "확정돼 있다" 류 서술 — 문서 `§표제어` 근거 0건(코드·`sdk.d.ts`·실측 로그·사용자 결정만)

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

- [ ] A 메시지-원자 배치 라우팅 (claude · mock · `routeBatch` · `consumeTurnScoped`)
- [ ] B channel incarnation token (`ensureChannel` · 라우팅 세대 검사 · 영수증 정합)
- [ ] C 잔여 큐 파생 + mutation 경계 15종 + `discardSubmitted` open 확장
- [ ] D `SubmissionAttempt` + 체인 종료 강등 + retry 규칙
- [ ] E `chat.postturn.step` 관측

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
| D1 | ②-a 의 실제 판정 입력이 로그로 확정되지 않았다 | r2 자체 검토(r1 귀속 철회) | §E 관측으로 다음 재현에서 확정 → 결과에 따라 0166/0167 중 하나로 귀속 | open |
| D2 | 진짜 백그라운드 통지 유실 시 애니메이션 지속(0143 유지의 귀결) | 사용자 결정 ⑥ | **0167** 이 라벨·개수로 설명 | 이관(0167) |
| D3 | "세션 전체 중단" 이 active runtime 을 못 죽인다 | r4 자체 발견(`supervisor.ts:141-149`) | **0166** | 이관(0166) |
| D4 | 작업 중 업데이트 설치가 허용될 수 있다 | r5 검증(`bootstrap.ts:490-494`) | **0166** | 이관(0166) |
| D5 | 종료 시 active 서브프로세스 잔존 | r5 검증(`bootstrap.ts:553-560`) | **0166** | 이관(0166) |
| D6 | 서브에이전트 중단이 연속·listen 턴에서 `stopTask` 에 도달 못함 | r5 자체 발견(`chat-turn.ts:96-112`) | **0166** | 이관(0166) |
| D7 | 동시 전송 2건이 이중 체인·이중 런타임을 만든다 | r6 검증(`chat-turn.ts:394`↔`:552`) | **0166** | 이관(0166) |
